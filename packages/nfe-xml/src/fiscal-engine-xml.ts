/**
 * Contrato UI/XML (fase 3): tributos e ICMSTot vêm de `fiscalPayload.engine`
 * persistido pelo backend (`tax-engine`). O `xml-generator` monta apenas o envelope
 * de simulação (ide, emit, dest, assinatura fake, protNFe).
 */

export type EngineIcms = {
  cst: string;
  orig: number;
  modBC?: number;
  vBC: number;
  pICMS: number;
  vICMS: number;
  pFCP?: number;
  vFCP?: number;
};

export type EngineIpi = {
  cst: string;
  cEnq?: string;
  vBC: number;
  pIPI: number;
  vIPI: number;
};

export type EnginePisCofins = {
  cst: string;
  vBC: number;
  pPIS?: number;
  pCOFINS?: number;
  vPIS: number;
  vCOFINS: number;
  aliquota?: number;
};

export type EngineDifal = {
  vICMSUFDest: number;
  vFCPUFDest?: number;
  vICMSUFRemet?: number;
};

export type EngineItem = {
  vProd: number;
  quantidade: number;
  valorUnitario: number;
  icms: EngineIcms;
  ipi?: EngineIpi;
  pis: EnginePisCofins;
  cofins: EnginePisCofins;
  difal?: EngineDifal;
};

export type EngineTotais = {
  vBC: number;
  vICMS: number;
  vFCP?: number;
  vProd: number;
  vFrete?: number;
  vIPI: number;
  vPIS: number;
  vCOFINS: number;
  vNF: number;
  vFCPUFDest?: number;
  vICMSUFDest?: number;
  vICMSUFRemet?: number;
};

export type EngineNota = {
  itens: EngineItem[];
  totais: EngineTotais;
};

export type IcmsTotInput = {
  vBC: number;
  vICMS: number;
  vProd: number;
  vFrete: number;
  vIPI: number;
  vPIS: number;
  vCOFINS: number;
  vNF: number;
  vFCPUFDest?: number;
  vICMSUFDest?: number;
  vICMSUFRemet?: number;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function fiscalCodeText(v: unknown, fallback: string): string {
  if (v == null) return fallback;
  if (typeof v === "string") {
    const t = v.trim();
    return t || fallback;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function parseEngineFromFiscalPayload(
  fiscalPayload?: Record<string, unknown>,
): EngineNota | null {
  const engine = asRecord(fiscalPayload?.engine);
  if (!engine) return null;

  const totaisRaw = asRecord(engine.totais);
  const itensRaw = Array.isArray(engine.itens) ? engine.itens : [];
  if (!totaisRaw || itensRaw.length === 0) return null;

  const itens: EngineItem[] = itensRaw.map((row) => {
    const item = asRecord(row) ?? {};
    const icms = asRecord(item.icms) ?? {};
    const pis = asRecord(item.pis) ?? {};
    const cofins = asRecord(item.cofins) ?? {};
    const ipi = asRecord(item.ipi);
    const difal = asRecord(item.difal);

    return {
      vProd: num(item.vProd),
      quantidade: num(item.quantidade, 1),
      valorUnitario: num(item.valorUnitario),
      icms: {
        cst: String(icms.cst ?? "00"),
        orig: num(icms.orig),
        modBC: num(icms.modBC, 3),
        vBC: num(icms.vBC),
        pICMS: num(icms.pICMS),
        vICMS: num(icms.vICMS),
        pFCP: num(icms.pFCP),
        vFCP: num(icms.vFCP),
      },
      ipi: ipi
        ? {
            cst: String(ipi.cst ?? "50"),
            cEnq: String(ipi.cEnq ?? "999"),
            vBC: num(ipi.vBC),
            pIPI: num(ipi.pIPI),
            vIPI: num(ipi.vIPI),
          }
        : undefined,
      pis: {
        cst: String(pis.cst ?? "01"),
        vBC: num(pis.vBC),
        pPIS: num(pis.pPIS ?? pis.aliquota),
        vPIS: num(pis.vPIS),
        vCOFINS: 0,
        aliquota: num(pis.aliquota),
      },
      cofins: {
        cst: String(cofins.cst ?? "01"),
        vBC: num(cofins.vBC),
        pCOFINS: num(cofins.pCOFINS ?? cofins.aliquota),
        vPIS: 0,
        vCOFINS: num(cofins.vCOFINS),
        aliquota: num(cofins.aliquota),
      },
      difal: difal
        ? {
            vICMSUFDest: num(difal.vICMSUFDest),
            vFCPUFDest: num(difal.vFCPUFDest),
            vICMSUFRemet: num(difal.vICMSUFRemet),
          }
        : undefined,
    };
  });

  const totais: EngineTotais = {
    vBC: num(totaisRaw.vBC),
    vICMS: num(totaisRaw.vICMS),
    vFCP: num(totaisRaw.vFCP),
    vProd: num(totaisRaw.vProd),
    vFrete: num(totaisRaw.vFrete),
    vIPI: num(totaisRaw.vIPI),
    vPIS: num(totaisRaw.vPIS),
    vCOFINS: num(totaisRaw.vCOFINS),
    vNF: num(totaisRaw.vNF),
    vFCPUFDest: num(totaisRaw.vFCPUFDest),
    vICMSUFDest: num(totaisRaw.vICMSUFDest),
    vICMSUFRemet: num(totaisRaw.vICMSUFRemet),
  };

  return { itens, totais };
}

/** ICMSTot alinhado ao backend — frete do emissor ainda pode ser injetado na UI. */
export function icmsTotFromEngine(totais: EngineTotais, vFrete: number): IcmsTotInput {
  return {
    vBC: totais.vBC,
    vICMS: totais.vICMS,
    vProd: totais.vProd,
    vFrete,
    vIPI: totais.vIPI,
    vPIS: totais.vPIS,
    vCOFINS: totais.vCOFINS,
    vNF: totais.vNF,
    vFCPUFDest: totais.vFCPUFDest,
    vICMSUFDest: totais.vICMSUFDest,
    vICMSUFRemet: totais.vICMSUFRemet,
  };
}

export function buildIcmsXmlFromEngineItem(icms: EngineIcms): string {
  const cst = icms.cst.slice(0, 2);
  const modBC = icms.modBC ?? 3;
  const pFcpXml =
    (icms.pFCP ?? 0) > 0
      ? `<pFCP>${icms.pFCP!.toFixed(4)}</pFCP><vFCP>${(icms.vFCP ?? 0).toFixed(2)}</vFCP>`
      : "";

  if (cst === "00") {
    return `<ICMS><ICMS00><orig>${icms.orig}</orig><CST>00</CST><modBC>${modBC}</modBC><vBC>${icms.vBC.toFixed(2)}</vBC><pICMS>${icms.pICMS.toFixed(4)}</pICMS><vICMS>${icms.vICMS.toFixed(2)}</vICMS>${pFcpXml}</ICMS00></ICMS>`;
  }

  return `<ICMS><ICMS${cst}><orig>${icms.orig}</orig><CST>${cst}</CST><modBC>${modBC}</modBC><vBC>${icms.vBC.toFixed(2)}</vBC><pICMS>${icms.pICMS.toFixed(4)}</pICMS><vICMS>${icms.vICMS.toFixed(2)}</vICMS>${pFcpXml}</ICMS${cst}></ICMS>`;
}

const IPI_CST_NAO_TRIBUTADO = new Set(["53", "54", "55"]);

export function isIpiNaoTributadoCst(cst: string): boolean {
  return IPI_CST_NAO_TRIBUTADO.has(cst.slice(0, 2));
}

export function buildIpiXmlFromEngine(ipi: EngineIpi): string {
  const cst = ipi.cst.slice(0, 2);
  const cEnq = ipi.cEnq ?? "999";
  if (isIpiNaoTributadoCst(cst)) {
    return `<IPI><cEnq>${cEnq}</cEnq><IPINT><CST>${cst}</CST></IPINT></IPI>`;
  }
  return `<IPI><cEnq>${cEnq}</cEnq><IPITrib><CST>${cst}</CST><vBC>${ipi.vBC.toFixed(2)}</vBC><pIPI>${ipi.pIPI.toFixed(2)}</pIPI><vIPI>${ipi.vIPI.toFixed(2)}</vIPI></IPITrib></IPI>`;
}

/** Fallback quando o item da engine não traz IPI — lê snapshot da regra no fiscalPayload. */
export function buildIpiXmlFromFiscalSnapshot(
  ipi: Record<string, unknown>,
  vBcFallback: number,
): string {
  const cstIpi =
    typeof ipi.st === "string"
      ? ipi.st.slice(0, 2)
      : fiscalCodeText(ipi.st, "55").slice(0, 2);
  const cEnq = fiscalCodeText(ipi.codEnq, "103");
  if (isIpiNaoTributadoCst(cstIpi)) {
    return buildIpiXmlFromEngine({ cst: cstIpi, cEnq, vBC: 0, pIPI: 0, vIPI: 0 });
  }
  const vBcIpi = num(ipi.vBc, vBcFallback);
  const pIpi = num(ipi.aliquota, 0);
  const vIpi = Math.round(vBcIpi * (pIpi / 100) * 100) / 100;
  return buildIpiXmlFromEngine({ cst: cstIpi, cEnq, vBC: vBcIpi, pIPI: pIpi, vIPI: vIpi });
}

const PIS_COFINS_NT = new Set(["04", "05", "06", "07", "08", "09"]);
const PIS_COFINS_OUTR = new Set(["49", "99"]);

function cst2(value: string): string {
  return value.slice(0, 2);
}

function pisCofinsNtXml(cstPis: string, cstCofins: string): string {
  return `<PIS><PISNT><CST>${cstPis}</CST></PISNT></PIS>
          <COFINS><COFINSNT><CST>${cstCofins}</CST></COFINSNT></COFINS>`;
}

function pisCofinsOutrXml(
  cstPis: string,
  cstCofins: string,
  pis: { vBC: number; pPIS: number; vPIS: number },
  cofins: { vBC: number; pCOFINS: number; vCOFINS: number },
): string {
  return `<PIS><PISOutr><CST>${cstPis}</CST><vBC>${pis.vBC.toFixed(2)}</vBC><pPIS>${pis.pPIS.toFixed(4)}</pPIS><vPIS>${pis.vPIS.toFixed(2)}</vPIS></PISOutr></PIS>
          <COFINS><COFINSOutr><CST>${cstCofins}</CST><vBC>${cofins.vBC.toFixed(2)}</vBC><pCOFINS>${cofins.pCOFINS.toFixed(4)}</pCOFINS><vCOFINS>${cofins.vCOFINS.toFixed(2)}</vCOFINS></COFINSOutr></COFINS>`;
}

function pisCofinsAliqXml(
  cstPis: string,
  cstCofins: string,
  pis: { vBC: number; pPIS: number; vPIS: number },
  cofins: { vBC: number; pCOFINS: number; vCOFINS: number },
): string {
  return `<PIS><PISAliq><CST>${cstPis}</CST><vBC>${pis.vBC.toFixed(2)}</vBC><pPIS>${pis.pPIS.toFixed(2)}</pPIS><vPIS>${pis.vPIS.toFixed(2)}</vPIS></PISAliq></PIS>
          <COFINS><COFINSAliq><CST>${cstCofins}</CST><vBC>${cofins.vBC.toFixed(2)}</vBC><pCOFINS>${cofins.pCOFINS.toFixed(2)}</pCOFINS><vCOFINS>${cofins.vCOFINS.toFixed(2)}</vCOFINS></COFINSAliq></COFINS>`;
}

/** Monta `<PIS>`/`<COFINS>` conforme o grupo do CST (NT, Outr ou Aliq). */
export function buildPisCofinsXmlFromEngine(pis: EnginePisCofins, cofins: EnginePisCofins): string {
  const cstPis = cst2(String(pis.cst ?? "01"));
  const cstCofins = cst2(String(cofins.cst ?? "01"));
  const pPis = pis.pPIS ?? pis.aliquota ?? 0;
  const pCofins = cofins.pCOFINS ?? cofins.aliquota ?? 0;

  if (PIS_COFINS_NT.has(cstPis) && PIS_COFINS_NT.has(cstCofins)) {
    return pisCofinsNtXml(cstPis, cstCofins);
  }

  if (PIS_COFINS_OUTR.has(cstPis) || PIS_COFINS_OUTR.has(cstCofins)) {
    return pisCofinsOutrXml(cstPis, cstCofins, { vBC: pis.vBC, pPIS: pPis, vPIS: pis.vPIS }, {
      vBC: cofins.vBC,
      pCOFINS: pCofins,
      vCOFINS: cofins.vCOFINS,
    });
  }

  return pisCofinsAliqXml(
    cstPis,
    cstCofins,
    { vBC: pis.vBC, pPIS: pPis, vPIS: pis.vPIS },
    { vBC: cofins.vBC, pCOFINS: pCofins, vCOFINS: cofins.vCOFINS },
  );
}

