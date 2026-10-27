import { z } from "zod";
import { validateProductNfciForOrigem } from "../rules/product-nfci.js";

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

const cestField = z.preprocess(
  (v) => {
    if (v === "" || v === undefined) return undefined;
    if (v === null) return null;
    return v;
  },
  z
    .union([
      z.null(),
      z
        .string()
        .trim()
        .transform((v) => digitsOnly(v))
        .refine((v) => v.length === 7, "CEST deve ter 7 dígitos"),
    ])
    .optional(),
);

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

const booleanField = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "on", "yes"].includes(s)) return true;
    if (["false", "0", "off", "no"].includes(s)) return false;
  }
  return false;
}, z.boolean());

export const productBodyFields = {
  sku: z.string().trim().min(1, "SKU obrigatório").max(60),
  ean: eanField,
  nome: z
    .string()
    .trim()
    .min(1, "Descrição obrigatória")
    .max(120, "Descrição deve ter no máximo 120 caracteres"),
  ncm: ncmField,
  cest: cestField,
  exTipi: exTipiField,
  origem: z.coerce.number().int().min(0).max(8),
  nfci: nfciField,
  unidade: z.string().trim().min(1, "Unidade obrigatória").max(6),
  preco: z.coerce.number().positive("Preço de venda deve ser maior que zero"),
  precoCusto: z.coerce.number().min(0, "Preço de custo não pode ser negativo"),
  estoque: z.coerce.number().int().min(0, "Estoque não pode ser negativo").default(0),
  sujeitoSt: booleanField.optional().default(false),
  taxRuleBaseId: optionalTrimmed.pipe(
    z.string().max(120, "Regra fiscal deve ter no máximo 120 caracteres").optional(),
  ),
};

function refineProductNfci<T extends { origem: number; nfci?: string }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  const message = validateProductNfciForOrigem(data.origem, data.nfci);
  if (message) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["nfci"] });
  }
}

/** Produto novo; nFCI é exigido conforme a origem. */
export const createProductRequestSchema = z
  .object(productBodyFields)
  .superRefine(refineProductNfci);

export type CreateProductRequestDTO = z.infer<typeof createProductRequestSchema>;
