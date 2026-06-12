import type { CustomerType, TransactionType } from "../../domain/services/tax-rule-ids.js";
import type { TaxRuleImportRow } from "../../domain/entities/tax-rule-import-row.entity.js";
import type { TaxRuleSpreadsheetRawRow } from "../../domain/entities/tax-rule-spreadsheet-raw-row.entity.js";

export type TaxRuleSpreadsheetMapResult = {
  rows: TaxRuleImportRow[];
  errors: { line: number; message: string }[];
};

function detectTransactionType(customerLabel: string): TransactionType {
  const t = customerLabel.toLowerCase();
  if (t.includes("envio de estoque") || t.includes("transfer") || t.includes("remessa")) {
    return "inbound";
  }
  return "sale";
}

function detectCustomerType(customerLabel: string): CustomerType {
  const t = customerLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (t.includes("nao contribuinte") || t.includes("consumidor final")) return "non_taxpayer";
  return "taxpayer";
}

function destinationLabel(transactionType: TransactionType, customerType: CustomerType): string {
  if (transactionType === "inbound") return "Envio de estoque (Transferência ou Remessa)";
  return customerType === "taxpayer" ? "Contribuinte" : "Não contribuinte";
}

function buildTaxPayload(
  cells: Record<string, unknown>,
  uf: string,
  transactionType: TransactionType,
  customerType: CustomerType,
): Record<string, unknown> {
  return {
    operation: {
      transactionType,
      customerType,
    },
    taxes: {
      ipi: {
        st: cells.IPI_ST,
        aliquota: cells.IPI_ALIQUOTA,
        codEnq:
          cells.IPI_COD_ENQ != null && String(cells.IPI_COD_ENQ).trim() !== ""
            ? String(cells.IPI_COD_ENQ).trim()
            : undefined,
      },
      pis: { st: cells.PIS_ST, aliquota: cells.PIS_ALIQUOTA },
      cofins: { st: cells.COFINS_ST, aliquota: cells.COFINS_ALIQUOTA },
      ibsCbs: {
        st: cells.IBS_CBS_ST,
        cClassTrib: cells.IBS_CBS_CCLASSTRIB,
        reducao: cells.IBS_CBS_REDUCAO,
      },
    },
    icmsByUf: Object.fromEntries(
      Object.entries(cells)
        .filter(([k]) => k.startsWith("ICMS_"))
        .map(([k, v]) => [k, v]),
    ),
  };
}

function resolveAliquota(cells: Record<string, unknown>, uf: string): string {
  const icmsKey = `ICMS_${uf}_PICMS_INTERNAL`;
  return String(cells[icmsKey] ?? cells.IPI_ALIQUOTA ?? "");
}

/**
 * Converte linhas brutas da planilha ML em entidades de importação persistíveis.
 */
export function mapTaxRuleSpreadsheetRows(rawRows: TaxRuleSpreadsheetRawRow[]): TaxRuleSpreadsheetMapResult {
  const rows: TaxRuleImportRow[] = [];
  const errors: { line: number; message: string }[] = [];

  for (const raw of rawRows) {
    const originTrim = raw.origin.trim();
    const uf = (originTrim.length === 2 ? originTrim : originTrim.slice(0, 2)).toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) {
      errors.push({ line: raw.line, message: "ORIGIN inválida (esperado UF com 2 letras)" });
      continue;
    }

    const transactionType = detectTransactionType(raw.transactionTypeLabel);
    const customerType = detectCustomerType(raw.transactionTypeLabel);
    const tipo = "MELI_RULE";
    const cfop = "";
    const aliquota = resolveAliquota(raw.cells, uf);
    const payload = buildTaxPayload(raw.cells, uf, transactionType, customerType);

    rows.push({
      ruleId: `${raw.ruleId}-${uf}-${customerType}-${transactionType}`,
      nome: `${raw.ruleName} (${destinationLabel(transactionType, customerType)})`,
      tipo,
      uf,
      cfop,
      aliquota,
      transactionType,
      customerType,
      origin: raw.origin,
      payload,
    });
  }

  return { rows, errors };
}
