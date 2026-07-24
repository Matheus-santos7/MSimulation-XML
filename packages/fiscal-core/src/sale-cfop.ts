import {
  customerTypeToPerfilComprador,
  resolveCfopByDecisionTree,
  type CfopLogistica,
  type CfopPerfilVendedor,
  type CfopRoutingInput,
  type CfopStInterestadualMode,
} from "./cfop-routing.js";
import type { FiscalEmitterSettingsData } from "./fiscal-emitter-settings-types.js";

export type SaleCustomerType = "taxpayer" | "non_taxpayer";

/** Natureza da operação nas NF-es de venda ML Full. */
export const VENDA_ML_NAT_OP = "Venda de mercadorias";

/** `verProc` nos XMLs autorizados pelo emissor ML. */
export const ML_NFE_VER_PROC = "mercadolivre.invoice";

/** Venda Full (armazém geral) comércio — intraestadual. */
export const CFOP_VENDA_NAO_CONTRIB_INTRA = "5106";

/** Venda Full (armazém geral) comércio — interestadual. */
export const CFOP_VENDA_NAO_CONTRIB_INTER = "6106";

/** Venda estoque próprio comércio — intraestadual. */
export const CFOP_VENDA_CONTRIB_INTRA = "5102";

/** Venda estoque próprio comércio — interestadual contribuinte. */
export const CFOP_VENDA_CONTRIB_INTER = "6102";

const LEGACY_CFOP_NAO_CONTRIB = new Set(["5105", "5106", "6105", "6106"]);

export type ResolveSaleCfopRouting = {
  /** Default no simulador Full: `armazem_geral`. */
  logistica?: CfopLogistica;
  perfilVendedor?: CfopPerfilVendedor;
  produtoSt?: boolean;
  stInterestadualMode?: CfopStInterestadualMode;
  /**
   * Quando `true` (default se `logistica` informado), a árvore de decisão
   * define o CFOP; `explicitCfop` só normaliza 5↔6 se ainda for usado no modo legado.
   */
  useDecisionTree?: boolean;
};

function isIntraStateOperation(emitUf: string, destUf: string): boolean {
  return emitUf.trim().toUpperCase() === destUf.trim().toUpperCase();
}

function defaultSaleCfop(intra: boolean, customerType: SaleCustomerType): string {
  if (customerType === "non_taxpayer") {
    return intra ? CFOP_VENDA_NAO_CONTRIB_INTRA : CFOP_VENDA_NAO_CONTRIB_INTER;
  }
  return intra ? CFOP_VENDA_CONTRIB_INTRA : CFOP_VENDA_CONTRIB_INTER;
}

/**
 * Ajusta CFOP explícito (planilha/regra) quando contradiz a natureza da operação
 * emitente → destinatário (ex.: 5105 em SP→MG vira 6106).
 */
function normalizeExplicitSaleCfop(
  cfop: string,
  intra: boolean,
  customerType: SaleCustomerType,
): string {
  if (customerType === "non_taxpayer" && LEGACY_CFOP_NAO_CONTRIB.has(cfop)) {
    return intra ? CFOP_VENDA_NAO_CONTRIB_INTRA : CFOP_VENDA_NAO_CONTRIB_INTER;
  }

  const isEstadual = cfop.startsWith("5");
  const isInterestadual = cfop.startsWith("6");

  if (intra && isInterestadual) {
    if (customerType === "non_taxpayer") return CFOP_VENDA_NAO_CONTRIB_INTRA;
    return `5${cfop.slice(1)}`;
  }

  if (!intra && isEstadual) {
    if (customerType === "non_taxpayer") return CFOP_VENDA_NAO_CONTRIB_INTER;
    return `6${cfop.slice(1)}`;
  }

  return cfop;
}

function normalizePerfilVendedor(raw: unknown): CfopPerfilVendedor {
  return raw === "industria" ? "industria" : "comercio";
}

function normalizeLogistica(raw: unknown): CfopLogistica {
  return raw === "estoque_proprio" ? "estoque_proprio" : "armazem_geral";
}

function normalizeStMode(raw: unknown): CfopStInterestadualMode {
  return raw === "protocolo" ? "protocolo" : "imposto_retido";
}

/**
 * Monta o routing da árvore a partir das settings do emissor + flag ST do produto.
 *
 * ST só entra na árvore com `estoque_proprio` (Full/armazém geral não tem ramo ST).
 */
export function saleRoutingFromEmitterSettings(
  settings: Pick<FiscalEmitterSettingsData, "basic"> | FiscalEmitterSettingsData | null | undefined,
  opts?: { produtoSt?: boolean },
): ResolveSaleCfopRouting {
  const basic = settings?.basic;
  const logistica = normalizeLogistica(basic?.logisticaPadrao);
  const produtoSt = opts?.produtoSt === true && logistica === "estoque_proprio";
  return {
    logistica,
    perfilVendedor: normalizePerfilVendedor(basic?.perfilVendedor),
    produtoSt,
    stInterestadualMode: normalizeStMode(basic?.stInterestadualMode),
    useDecisionTree: true,
  };
}

/**
 * CFOP de venda com base na UF do **emitente** e do **destinatário** (MOC / validação SEFAZ).
 *
 * Com `routing.useDecisionTree` / `routing.logistica`, usa a árvore canônica
 * (`resolveCfopByDecisionTree`). Sem routing: TaxRule explícita + defaults legados.
 */
export function resolveSaleCfop(
  emitUf: string,
  destUf: string,
  customerType: SaleCustomerType,
  explicitCfop?: string | null,
  routing?: ResolveSaleCfopRouting,
): string {
  const useTree = routing?.useDecisionTree === true || routing?.logistica != null;
  if (useTree) {
    const treeInput: CfopRoutingInput = {
      ufOrigem: emitUf,
      ufDestino: destUf,
      operacaoTipo: "venda",
      logistica: routing?.logistica ?? "armazem_geral",
      perfilVendedor: routing?.perfilVendedor ?? "comercio",
      perfilComprador: customerTypeToPerfilComprador(customerType),
      produtoSt: routing?.produtoSt === true,
      stInterestadualMode: routing?.stInterestadualMode,
    };
    return resolveCfopByDecisionTree(treeInput).cfop;
  }

  const intra = isIntraStateOperation(emitUf, destUf);
  const trimmed = explicitCfop?.trim() ?? "";

  if (!/^\d{4}$/.test(trimmed)) {
    return defaultSaleCfop(intra, customerType);
  }

  return normalizeExplicitSaleCfop(trimmed, intra, customerType);
}

export class SaleCfopConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleCfopConsistencyError";
  }
}

/**
 * Garante um único valor de `sujeitoSt` no pedido (NF-e não mistura ST e não-ST).
 * @returns o valor uniforme
 */
export function resolveUniformProdutoSt(flags: readonly boolean[]): boolean {
  if (flags.length === 0) return false;
  const first = flags[0] === true;
  for (let i = 1; i < flags.length; i++) {
    if ((flags[i] === true) !== first) {
      throw new SaleCfopConsistencyError(
        "Pedido mistura produtos com e sem ICMS-ST; emita NF-es separadas (um CFOP por nota).",
      );
    }
  }
  return first;
}

/** CFOPs de saída com ST (árvore estoque próprio). */
export const CFOP_VENDA_ST = new Set(["5405", "6403", "6404"]);

/**
 * CEST obrigatório em operação ST (MOC / regras ST — rejeição SEFAZ sem CEST).
 */
export function assertCestRequiredForStCfop(
  cfop: string,
  items: ReadonlyArray<{ cest?: string | null; sku?: string | null }>,
): void {
  if (!CFOP_VENDA_ST.has(cfop.trim())) return;
  for (const item of items) {
    const cest = item.cest?.replace(/\D/g, "") ?? "";
    if (cest.length < 7) {
      throw new SaleCfopConsistencyError(
        `CFOP ${cfop} (ICMS-ST) exige CEST no produto${item.sku ? ` (${item.sku})` : ""}.`,
      );
    }
  }
}

/**
 * Alinha CFOP da TaxRule ao da árvore: só normaliza prefixo 5↔6 pela UF.
 * Sem CFOP na regra → ok. Natureza diferente (ex. 5102 vs 5106) → erro.
 */
export function assertTaxRuleCfopMatchesTree(
  treeCfop: string,
  taxRuleCfop: string | null | undefined,
  emitUf: string,
  destUf: string,
): void {
  const rule = taxRuleCfop?.trim() ?? "";
  if (!/^\d{4}$/.test(rule)) return;

  const tree = treeCfop.trim();
  if (!/^\d{4}$/.test(tree)) {
    throw new SaleCfopConsistencyError(`CFOP da árvore inválido: "${treeCfop}"`);
  }

  const intra = isIntraStateOperation(emitUf, destUf);
  let ruleNorm = rule;
  if (intra && rule.startsWith("6")) ruleNorm = `5${rule.slice(1)}`;
  if (!intra && rule.startsWith("5")) ruleNorm = `6${rule.slice(1)}`;

  if (ruleNorm !== tree) {
    throw new SaleCfopConsistencyError(
      `TaxRule CFOP ${rule} (normalizado ${ruleNorm}) diverge do CFOP da árvore ${tree}. ` +
        `A planilha XLSX de regras não define CFOP (fica vazio); o CFOP vem da árvore. ` +
        `Se a regra foi cadastrada manualmente com CFOP, alinhe-o ao perfil/logística do emissor ou limpe o campo.`,
    );
  }
}
