/**
 * Política de emissão do FCP (NF-e 4.00 / EC 87/2015).
 *
 * Separação obrigatória:
 * - Operação interna (CFOP 5xxx): FCP no grupo ICMS (`pFCP`/`vFCP`) → `ICMSTot.vFCP`.
 * - Interestadual + consumidor final não contribuinte (DIFAL): FCP só em
 *   `ICMSUFDest` (`pFCPUFDest`/`vFCPUFDest`) → `ICMSTot.vFCPUFDest`; `vFCP` = 0.
 * - ST: FCP-ST independente (`pFCPST` / Ret), totais `vFCPST` / `vFCPSTRet`.
 *
 * Alíquotas NUNCA são hardcodadas aqui — vêm da TaxRule já resolvida por
 * UF destino + produto/NCM (`ICMS_{UF}_PICMS_FCP`, `ICMS_{UF}_PFCPST_RET`).
 */

export type FcpPlacementInput = {
  /** CFOP do item (5xxx interno, 6xxx interestadual). */
  cfop?: string;
  ufOrigem: string;
  ufDestino: string;
  /**
   * Consumidor final não contribuinte (`indFinal=1` + `indIEDest=9`).
   * No projeto: `customerType === "non_taxpayer"`.
   */
  isFinalConsumer: boolean;
  /** DIFAL efetivamente aplicado (settings SEM_DIFAL = false). */
  appliesDifal: boolean;
  /** Alíquota FCP da regra (UF destino / NCM) — % . */
  pFcpFromRule: number;
  /** Alíquota FCP-ST da regra — % . */
  pFcpStFromRule: number;
  /** CST/CSOSN com ST (10/30/70/60 ou 201/202/203/500/900 com ST). */
  hasSt: boolean;
};

export type FcpPlacement = {
  /** FCP no grupo ICMS próprio (`ICMS00` etc.). Zero no cenário DIFAL EC 87. */
  pFCP: number;
  /** FCP no `<ICMSUFDest>`. Só DIFAL EC 87. */
  pFCPUFDest: number;
  /** FCP-ST (operação ou retido). */
  pFCPST: number;
  /** Cenário resolvido — útil para testes/auditoria. */
  scenario: "interno" | "interestadual_sem_difal" | "difal_ec87";
};

function pct(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Interestadual por CFOP (preferência) ou por UF quando CFOP ausente/ambíguo.
 * CFOP 5xxx/1xxx = interno; 6xxx/2xxx = interestadual.
 */
export function isInterstateByCfopOrUf(
  cfop: string | undefined,
  ufOrigem: string,
  ufDestino: string,
): boolean {
  const digit = cfop?.trim().charAt(0);
  if (digit === "5" || digit === "1") return false;
  if (digit === "6" || digit === "2") return true;
  return ufOrigem.trim().toUpperCase() !== ufDestino.trim().toUpperCase();
}

/**
 * Resolve onde o FCP deve ser destacado no XML — sem embutir em `pICMS`.
 */
export function resolveFcpPlacement(input: FcpPlacementInput): FcpPlacement {
  const pFcp = pct(input.pFcpFromRule);
  const pFcpSt = input.hasSt ? pct(input.pFcpStFromRule) : 0;
  const interstate = isInterstateByCfopOrUf(input.cfop, input.ufOrigem, input.ufDestino);

  // EC 87/2015: FCP exclusivo do destino em ICMSUFDest.
  if (interstate && input.isFinalConsumer && input.appliesDifal) {
    return {
      pFCP: 0,
      pFCPUFDest: pFcp,
      pFCPST: pFcpSt,
      scenario: "difal_ec87",
    };
  }

  if (interstate) {
    return {
      pFCP: pFcp,
      pFCPUFDest: 0,
      pFCPST: pFcpSt,
      scenario: "interestadual_sem_difal",
    };
  }

  return {
    pFCP: pFcp,
    pFCPUFDest: 0,
    pFCPST: pFcpSt,
    scenario: "interno",
  };
}
