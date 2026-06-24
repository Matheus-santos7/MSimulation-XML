export type SaleCustomerType = "taxpayer" | "non_taxpayer";

/** Natureza da operação nas NF-es de venda ML Full. */
export const VENDA_ML_NAT_OP = "Venda de mercadorias";

/** `verProc` nos XMLs autorizados pelo emissor ML. */
export const ML_NFE_VER_PROC = "mercadolivre.invoice";

/** Venda intraestadual para consumidor final (não contribuinte). */
export const CFOP_VENDA_NAO_CONTRIB_INTRA = "5106";

/** Venda interestadual para consumidor final (não contribuinte). */
export const CFOP_VENDA_NAO_CONTRIB_INTER = "6106";

/** Venda intraestadual para contribuinte. */
export const CFOP_VENDA_CONTRIB_INTRA = "5102";

/** Venda interestadual para contribuinte. */
export const CFOP_VENDA_CONTRIB_INTER = "6102";

const LEGACY_CFOP_NAO_CONTRIB = new Set(["5105", "5106", "6105", "6106"]);

function isIntraStateOperation(emitUf: string, destUf: string): boolean {
  return emitUf.trim().toUpperCase() === destUf.trim().toUpperCase();
}

function defaultSaleCfop(intra: boolean, customerType: SaleCustomerType): string {
  if (intra) {
    return customerType === "non_taxpayer"
      ? CFOP_VENDA_NAO_CONTRIB_INTRA
      : CFOP_VENDA_CONTRIB_INTRA;
  }
  return customerType === "non_taxpayer"
    ? CFOP_VENDA_NAO_CONTRIB_INTER
    : CFOP_VENDA_CONTRIB_INTER;
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

/**
 * CFOP de venda com base na UF do **emitente** e do **destinatário** (MOC / validação SEFAZ).
 *
 * A comparação usa sempre emitente → comprador, independentemente da UF de saída física
 * do CD fulfillment (Portaria CAT 31/2019). Padrão ML Full para não contribuinte:
 * intra → 5106; inter → 6106. CFOPs legados 5105/6105 são normalizados na fonte.
 */
export function resolveSaleCfop(
  emitUf: string,
  destUf: string,
  customerType: SaleCustomerType,
  explicitCfop?: string | null,
): string {
  const intra = isIntraStateOperation(emitUf, destUf);
  const trimmed = explicitCfop?.trim() ?? "";

  if (!/^\d{4}$/.test(trimmed)) {
    return defaultSaleCfop(intra, customerType);
  }

  return normalizeExplicitSaleCfop(trimmed, intra, customerType);
}
