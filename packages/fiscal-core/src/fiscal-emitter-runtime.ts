import type { NFeTipoValue } from "./nfe-tipo.js";
import type {
  BaseCalcAction,
  ComposicaoLinha,
  ComposicaoTributo,
  CstDevolucaoMap,
  DifalCalculo,
  FiscalEmitterSettingsData,
} from "./fiscal-emitter-settings-types.js";

export type TaxSnapshot = {
  ruleId?: string;
  icms: Record<string, unknown>;
  ipi: Record<string, unknown>;
  pis: Record<string, unknown>;
  cofins: Record<string, unknown>;
  ibsCbs: Record<string, unknown>;
  emitter?: EmitterSnapshot;
};

export type EmitterSnapshot = {
  modFrete: string;
  freteNoCalculo: boolean;
  acrescimoNoProduto: boolean;
  mensagemInfCpl: string;
  bases: {
    vProd: number;
    vFrete: number;
    vDesc: number;
    vIpi: number;
    vIcms: number;
    vBcIcms: number;
    vBcPisCofins: number;
    vBcIpi: number;
  };
  difal: {
    mode: DifalCalculo;
    aplica: boolean;
    vDifal: number;
  };
};

export type EnrichTaxContext = {
  settings: FiscalEmitterSettingsData;
  tipo: NFeTipoValue;
  valor: number;
  valorIcms: number;
  emitUf: string;
  destUf: string;
  indFinal?: number;
  /** CST da NF-e de venda referenciada (devolução). */
  cstVendaReferencia?: { icms?: string; pis?: string; cofins?: string };
};

export function normalizeTaxStCode(raw: unknown): string {
  if (raw == null) return "";
  const text = String(raw).trim();
  const match = text.match(/^(\d{2,3})/);
  return match?.[1] ?? text.slice(0, 2);
}

export function mapCstDevolucao(vendaCst: string, maps: CstDevolucaoMap[]): string {
  const code = normalizeTaxStCode(vendaCst);
  if (!code) return vendaCst.slice(0, 2);

  const exact = maps.find((m) => m.venda === code);
  if (exact) return exact.devolucao;

  if (code.length >= 3) {
    const by3 = maps.find((m) => m.venda === code.slice(0, 3));
    if (by3) return by3.devolucao;
  }

  const by2 = maps.find((m) => m.venda === code.slice(0, 2));
  if (by2) return by2.devolucao;

  return code.slice(0, 2);
}

export function resolveModFrete(settings: FiscalEmitterSettingsData, tipo: NFeTipoValue): string {
  const m = settings.taxes.modalidadeFrete;
  if (m.mode === "DEFAULT") return "0";
  switch (tipo) {
    case "REMESSA":
    case "REMESSA_SIMBOLICA":
      return m.coleta;
    case "RETORNO_SIMBOLICO":
      return m.fullfilmentEntrada;
    default:
      return m.fullfilmentVendas;
  }
}

export function composicaoChannel(tipo: NFeTipoValue): keyof ComposicaoLinha {
  return tipo === "REMESSA" || tipo === "REMESSA_SIMBOLICA" || tipo === "RETORNO_SIMBOLICO"
    ? "remessa"
    : "venda";
}

function actionDelta(action: BaseCalcAction, amount: number): number {
  switch (action) {
    case "INCLUIR_NA_BASE":
      return amount;
    case "SUBTRAIR_DA_BASE":
      return -amount;
    default:
      return 0;
  }
}

function lineAction(
  composicao: ComposicaoTributo,
  key: keyof ComposicaoTributo,
  channel: keyof ComposicaoLinha,
): BaseCalcAction | null {
  const line = composicao[key];
  if (!line || typeof line !== "object" || !("venda" in line)) return null;
  return (line as ComposicaoLinha)[channel];
}

export function calcTributoBase(
  vProd: number,
  parts: {
    frete: number;
    desconto: number;
    icms: number;
    difal: number;
    fcpIcms: number;
    fcpDifal: number;
    ipi: number;
    acrescimo: number;
  },
  composicao: ComposicaoTributo,
  channel: keyof ComposicaoLinha,
): number {
  let base = vProd;
  const entries: [keyof ComposicaoTributo, number][] = [
    ["frete", parts.frete],
    ["desconto", parts.desconto],
    ["icms", parts.icms],
    ["difal", parts.difal],
    ["fcpIcms", parts.fcpIcms],
    ["fcpDifal", parts.fcpDifal],
    ["ipi", parts.ipi],
    ["acrescimoPreco", parts.acrescimo],
  ];
  for (const [key, amount] of entries) {
    const action = lineAction(composicao, key, channel);
    if (action) base += actionDelta(action, amount);
  }
  return Math.max(0, Math.round(base * 100) / 100);
}

export function resolveDifalMode(settings: FiscalEmitterSettingsData, destUf: string): DifalCalculo {
  const d = settings.taxes.calculoDifal;
  if (d.mode === "DEFAULT") return "PADRAO";
  return d.porUf[destUf.toUpperCase()] ?? d.bulk;
}

function applyDifal(
  snapshot: TaxSnapshot,
  mode: DifalCalculo,
  valor: number,
  emitUf: string,
  destUf: string,
  indFinal: number,
): { valorIcms: number; vDifal: number; aplica: boolean } {
  const interestadual = emitUf.toUpperCase() !== destUf.toUpperCase();
  const aplica = interestadual && indFinal === 1;
  if (!aplica || mode === "SEM_DIFAL") {
    return {
      valorIcms: valor * (asNum(snapshot.icms.aliquota, 0) / 100),
      vDifal: 0,
      aplica: false,
    };
  }

  const pInternal = asNum(snapshot.icms.aliquota, 18);
  const pInter = asNum(snapshot.icms.pIcmsInterstate, 12);
  const pRedDifal = asNum(snapshot.icms.pRedBcDifal, 0);
  let vBc = valor * (1 - pRedDifal / 100);

  if (mode === "BASE_DUPLA_COM_ICMS") {
    const vIcmsOrigem = Math.round(vBc * (pInter / 100) * 100) / 100;
    const vBcDest = Math.max(0, (vBc - vIcmsOrigem) / (1 - pInternal / 100));
    const vIcmsDest = Math.round(vBcDest * (pInternal / 100) * 100) / 100;
    const vDifal = Math.max(0, Math.round((vIcmsDest - vIcmsOrigem) * 100) / 100);
    return { valorIcms: vIcmsOrigem, vDifal, aplica: true };
  }

  const pDif = asNum(snapshot.icms.pDif, 0);
  const vDifal =
    pDif > 0
      ? Math.round(vBc * (pDif / 100) * 100) / 100
      : Math.max(0, Math.round(vBc * ((pInternal - pInter) / 100) * 100) / 100);
  const valorIcms = Math.round(vBc * (pInter / 100) * 100) / 100;
  return { valorIcms, vDifal, aplica: true };
}

function asNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Bases e modFrete do emissor — usado no backend (`enrichTaxSnapshot`) e no fallback de preview XML. */
export function buildEmitterSnapshot(
  settings: FiscalEmitterSettingsData,
  tipo: NFeTipoValue,
  valor: number,
  valorIcms: number,
  emitUf: string,
  destUf: string,
  indFinal?: number,
): EmitterSnapshot {
  const channel = composicaoChannel(tipo);
  const comp = settings.taxes.composicaoBaseCalculo;
  const frete = settings.nfe.freteNoCalculo ? 0 : 0;
  const parts = {
    frete,
    desconto: 0,
    icms: valorIcms,
    difal: 0,
    fcpIcms: 0,
    fcpDifal: 0,
    ipi: 0,
    acrescimo: settings.nfe.acrescimoPrecoProduto ? 0 : 0,
  };

  const vBcIcms = calcTributoBase(valor, parts, comp.icms, channel);
  const difalMode = resolveDifalMode(settings, destUf);
  const ind = indFinal ?? (tipo === "VENDA" ? 1 : 0);
  const difalStub: TaxSnapshot = { icms: { aliquota: 0 }, ipi: {}, pis: {}, cofins: {}, ibsCbs: {} };
  const difal = applyDifal(difalStub, difalMode, vBcIcms, emitUf, destUf, ind);

  return {
    modFrete: resolveModFrete(settings, tipo),
    freteNoCalculo: settings.nfe.freteNoCalculo,
    acrescimoNoProduto: settings.nfe.acrescimoPrecoProduto,
    mensagemInfCpl: settings.nfe.mensagemPadrao?.trim() ?? "",
    bases: {
      vProd: valor,
      vFrete: frete,
      vDesc: 0,
      vIpi: 0,
      vIcms: valorIcms,
      vBcIcms,
      vBcPisCofins: calcTributoBase(valor, parts, comp.pisCofins, channel),
      vBcIpi: calcTributoBase(valor, parts, comp.ipi, channel),
    },
    difal: {
      mode: difalMode,
      aplica: difal.aplica,
      vDifal: difal.vDifal,
    },
  };
}

export function enrichTaxSnapshot(snapshot: TaxSnapshot, ctx: EnrichTaxContext): TaxSnapshot {
  const { settings, tipo, valor, emitUf, destUf } = ctx;
  const channel = composicaoChannel(tipo);
  const comp = settings.taxes.composicaoBaseCalculo;
  const frete = settings.nfe.freteNoCalculo ? 0 : 0;
  const parts = {
    frete,
    desconto: 0,
    icms: ctx.valorIcms,
    difal: 0,
    fcpIcms: 0,
    fcpDifal: 0,
    ipi: 0,
    acrescimo: settings.nfe.acrescimoPrecoProduto ? 0 : 0,
  };

  const icmsAliq = snapshot.icms.aliquota ?? 0;
  const pisAliq = typeof snapshot.pis.aliquota === "number" ? snapshot.pis.aliquota : null;
  const ipiAliq = typeof snapshot.ipi.aliquota === "number" ? snapshot.ipi.aliquota : null;

  const vBcIcms = icmsAliq === 0 ? 0 : calcTributoBase(valor, parts, comp.icms, channel);
  const vBcPis =
    pisAliq === 0 ? 0 : calcTributoBase(valor, parts, comp.pisCofins, channel);
  const vBcIpi = ipiAliq === 0 ? 0 : calcTributoBase(valor, parts, comp.ipi, channel);

  const difalMode = resolveDifalMode(settings, destUf);
  const indFinal = ctx.indFinal ?? (tipo === "VENDA" ? 1 : 0);
  const difal = applyDifal(snapshot, difalMode, vBcIcms, emitUf, destUf, indFinal);

  let icms = { ...snapshot.icms };
  let pis = { ...snapshot.pis };
  let cofins = { ...snapshot.cofins };

  if (tipo === "DEVOLUCAO" && settings.taxes.cstDevolucao.mode !== "DEFAULT") {
    const ref = ctx.cstVendaReferencia;
    if (ref?.icms) icms = { ...icms, cst: mapCstDevolucao(ref.icms, settings.taxes.cstDevolucao.icms) };
    if (ref?.pis) {
      const cst = mapCstDevolucao(ref.pis, settings.taxes.cstDevolucao.pisCofins);
      pis = { ...pis, st: `${cst} - Devolução` };
      cofins = { ...cofins, st: `${cst} - Devolução` };
    }
  }

  const emitter: EmitterSnapshot = {
    modFrete: resolveModFrete(settings, tipo),
    freteNoCalculo: settings.nfe.freteNoCalculo,
    acrescimoNoProduto: settings.nfe.acrescimoPrecoProduto,
    mensagemInfCpl: settings.nfe.mensagemPadrao?.trim() ?? "",
    bases: {
      vProd: valor,
      vFrete: frete,
      vDesc: 0,
      vIpi: 0,
      vIcms: ctx.valorIcms,
      vBcIcms,
      vBcPisCofins: vBcPis,
      vBcIpi,
    },
    difal: {
      mode: difalMode,
      aplica: difal.aplica,
      vDifal: difal.vDifal,
    },
  };

  return {
    ...snapshot,
    icms: {
      ...icms,
      vBc: vBcIcms,
      aliquota: icms.aliquota ?? 0,
      valorIcms: Math.round(difal.valorIcms * 100) / 100,
    },
    pis: { ...pis, vBc: vBcPis },
    cofins: { ...cofins, vBc: vBcPis },
    ipi: { ...snapshot.ipi, vBc: vBcIpi },
    emitter,
  };
}
