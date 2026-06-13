export type SaleCustomerType = "taxpayer" | "non_taxpayer";

/** Natureza da operação nas NF-es de venda ML Full. */
export const VENDA_ML_NAT_OP = "Venda de mercadorias";

/** `verProc` nos XMLs autorizados pelo emissor ML. */
export const ML_NFE_VER_PROC = "mercadolivre.invoice";

/**
 * CFOP de venda quando a planilha não traz coluna CFOP (padrão ML Full).
 * Intra + não contribuinte → 5105; inter + não contribuinte → 6105.
 */
export function resolveSaleCfop(
  originUf: string,
  destUf: string,
  customerType: SaleCustomerType,
  explicitCfop?: string | null,
): string {
  const trimmed = explicitCfop?.trim() ?? "";
  if (/^\d{4}$/.test(trimmed)) return trimmed;

  const intra = originUf.trim().toUpperCase() === destUf.trim().toUpperCase();
  if (intra) {
    return customerType === "non_taxpayer" ? "5105" : "5102";
  }
  return customerType === "non_taxpayer" ? "6105" : "6102";
}
