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

export function buildIpiXmlFromEngine(ipi: EngineIpi): string {
  const cst = ipi.cst.slice(0, 2);
  const cEnq = ipi.cEnq ?? "999";
  if (cst === "55" || cst === "54" || cst === "53") {
    return `<IPI><cEnq>${cEnq}</cEnq><IPINT><CST>${cst}</CST></IPINT></IPI>`;
  }
  return `<IPI><cEnq>${cEnq}</cEnq><IPITrib><CST>${cst}</CST><vBC>${ipi.vBC.toFixed(2)}</vBC><pIPI>${ipi.pIPI.toFixed(2)}</pIPI><vIPI>${ipi.vIPI.toFixed(2)}</vIPI></IPITrib></IPI>`;
}

export function buildPisCofinsXmlFromEngine(pis: EnginePisCofins, cofins: EnginePisCofins): string {
  const cstPis = pis.cst.slice(0, 2);
  const cstCofins = cofins.cst.slice(0, 2);
  const pPis = pis.pPIS ?? pis.aliquota ?? 0;
  const pCofins = cofins.pCOFINS ?? cofins.aliquota ?? 0;
  return `<PIS><PISAliq><CST>${cstPis}</CST><vBC>${pis.vBC.toFixed(2)}</vBC><pPIS>${pPis.toFixed(2)}</pPIS><vPIS>${pis.vPIS.toFixed(2)}</vPIS></PISAliq></PIS>
          <COFINS><COFINSAliq><CST>${cstCofins}</CST><vBC>${cofins.vBC.toFixed(2)}</vBC><pCOFINS>${pCofins.toFixed(2)}</pCOFINS><vCOFINS>${cofins.vCOFINS.toFixed(2)}</vCOFINS></COFINSAliq></COFINS>`;
}

