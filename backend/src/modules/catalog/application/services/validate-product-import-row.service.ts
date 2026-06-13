import { productCreateBody } from "../../presentation/schemas/product.schemas.js";
import type { CreateProductCommand } from "../dto/create-product.command.js";
import type { ProductImportRawRow } from "../../domain/entities/product-import-raw-row.entity.js";

export type ProductImportRowValidationResult =
  | { ok: true; row: CreateProductCommand }
  | { ok: false; message: string };

type ParsePriceOptions = {
  allowZero?: boolean;
};

/** Converte preço BR (`846,00` / `1.234,56`) ou numérico para number. */
export function parseBrazilianPrice(
  raw: string | number,
  options: ParsePriceOptions = {},
): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return options.allowZero ? (raw >= 0 ? raw : null) : raw > 0 ? raw : null;
  }
  const t = raw.trim();
  if (!t) return null;
  let normalized = t;
  if (/,\d{1,8}$/.test(t)) {
    normalized = t.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return options.allowZero ? (n >= 0 ? n : null) : n > 0 ? n : null;
}

function mapRawRowToCreateInput(raw: ProductImportRawRow): Record<string, unknown> {
  const preco = parseBrazilianPrice(raw.preco);
  const precoCusto = parseBrazilianPrice(raw.precoCusto, { allowZero: true });
  const origemRaw = raw.origem;
  const origem =
    origemRaw === undefined || origemRaw === ""
      ? 0
      : typeof origemRaw === "number"
        ? origemRaw
        : Number(String(origemRaw).trim());

  const estoqueRaw = raw.estoque;
  const estoque =
    estoqueRaw === undefined || estoqueRaw === ""
      ? 0
      : typeof estoqueRaw === "number"
        ? estoqueRaw
        : Number(String(estoqueRaw).replace(/\D/g, "") || String(estoqueRaw).trim());

  return {
    sku: raw.sku,
    ean: raw.ean,
    nome: raw.nome,
    ncm: raw.ncm,
    cest: raw.cest,
    exTipi: raw.exTipi,
    origem,
    nfci: raw.nfci,
    unidade: raw.unidade?.trim() || "UN",
    preco,
    precoCusto,
    estoque,
    taxRuleBaseId: raw.taxRuleBaseId,
  };
}

/**
 * Valida uma linha bruta da planilha contra as regras de domínio do produto.
 */
export function validateProductImportRow(raw: ProductImportRawRow): ProductImportRowValidationResult {
  const parsed = productCreateBody.safeParse(mapRawRowToCreateInput(raw));
  if (parsed.success) {
    return { ok: true, row: parsed.data };
  }

  const first = parsed.error.flatten().fieldErrors;
  const message =
    Object.values(first)
      .flat()
      .find((m) => typeof m === "string" && m.length > 0) ??
    parsed.error.issues[0]?.message ??
    "Linha inválida";

  return { ok: false, message };
}
