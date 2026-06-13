import { z } from "zod";
import { validateProductNfciForOrigem } from "../../domain/services/product-nfci.js";

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

const optionalTrimmed = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().trim().optional(),
);

const eanField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || [8, 12, 13, 14].includes(digitsOnly(v).length),
      "EAN/GTIN deve ter 8, 12, 13 ou 14 dígitos",
    )
    .transform((v) => (v ? digitsOnly(v) : undefined)),
);

const ncmField = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 8, "NCM deve ter 8 dígitos");

const cestField = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .refine((v) => v.length === 7, "CEST deve ter 7 dígitos");

const exTipiField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v || /^(-|n\/a|na|null)$/i.test(v)) return undefined;
      const digits = digitsOnly(v);
      if (!digits || /^0+$/.test(digits)) return undefined;
      if (digits.length === 1) return digits.padStart(2, "0");
      return digits;
    })
    .refine((v) => !v || /^\d{2,3}$/.test(v), "EXTIPI deve ter 2 ou 3 dígitos"),
);

const nfciField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().trim().max(36, "nFCI deve ter no máximo 36 caracteres").optional(),
);

const productBodyFields = {
  sku: z.string().trim().min(1, "SKU obrigatório").max(60),
  ean: eanField,
  nome: z.string().trim().min(1, "Descrição obrigatória").max(120, "Descrição deve ter no máximo 120 caracteres"),
  ncm: ncmField,
  cest: cestField,
  exTipi: exTipiField,
  origem: z.coerce.number().int().min(0).max(8),
  nfci: nfciField,
  unidade: z.string().trim().min(1, "Unidade obrigatória").max(6),
  preco: z.coerce.number().positive("Preço de venda deve ser maior que zero"),
  precoCusto: z.coerce.number().min(0, "Preço de custo não pode ser negativo"),
  estoque: z.coerce.number().int().min(0, "Estoque não pode ser negativo").default(0),
  taxRuleBaseId: optionalTrimmed.pipe(
    z.string().max(120, "Regra fiscal deve ter no máximo 120 caracteres").optional(),
  ),
};

function refineProductNfci<T extends { origem: number; nfci?: string }>(data: T, ctx: z.RefinementCtx) {
  const message = validateProductNfciForOrigem(data.origem, data.nfci);
  if (message) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["nfci"] });
  }
}

export const productCreateBody = z.object(productBodyFields).superRefine(refineProductNfci);

export const productUpdateBody = z.object(productBodyFields).partial();

export const productIdParam = z.object({
  id: z.string().uuid(),
});

export type ProductCreateInput = z.infer<typeof productCreateBody>;
export type ProductUpdateInput = z.infer<typeof productUpdateBody>;

/** Linha bruta da planilha — validação fiscal ocorre no BulkUpsertProductsUseCase. */
export const productImportRawRowSchema = z.object({
  line: z.number().int().positive(),
  sku: z.string(),
  ean: z.string().optional(),
  nome: z.string(),
  ncm: z.string(),
  cest: z.string(),
  exTipi: z.string().optional(),
  origem: z.union([z.string(), z.number()]).optional(),
  nfci: z.string().optional(),
  unidade: z.string().optional(),
  preco: z.union([z.string(), z.number()]),
  precoCusto: z.union([z.string(), z.number()]),
  estoque: z.union([z.string(), z.number()]).optional(),
  taxRuleBaseId: z.string().optional(),
});

export const productBulkUpsertBody = z.object({
  rows: z
    .array(productImportRawRowSchema)
    .min(1, "Planilha vazia")
    .max(500, "Máximo de 500 linhas por importação"),
});

export type ProductBulkUpsertInput = z.infer<typeof productBulkUpsertBody>;
export type ProductImportRawRowInput = z.infer<typeof productImportRawRowSchema>;
