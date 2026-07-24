import type { CompradorCheckoutInput, PedidoCheckoutInput, PedidoDto } from "@/lib/fiscal-types";
import type { PedidoFormValues } from "./pedido-form-types";
export type { PedidoFormValues, PedidoItemFormValues } from "./pedido-form-types";
export { PEDIDO_FORM_EMPTY, PEDIDO_ITEM_EMPTY } from "./pedido-form-types";
export {
  findPedidoFormExample,
  PEDIDO_FORM_EXAMPLE_GROUPS,
  PEDIDO_FORM_EXAMPLES,
  type PedidoFormExample,
  type PedidoFormExampleKind,
} from "./pedido-form-examples";
import { PEDIDO_FORM_EXAMPLES } from "./pedido-form-examples";

export type PedidoFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string[]>;
};

/** @deprecated Preferir `PEDIDO_FORM_EXAMPLES` ou `findPedidoFormExample`. */
export const PEDIDO_FORM_EXAMPLE: PedidoFormValues =
  PEDIDO_FORM_EXAMPLES.find((e) => e.id === "cpf-pr")?.values ?? PEDIDO_FORM_EXAMPLES[0]!.values;

function brValueToInput(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return String(Math.round(n * 100) / 100);
}

export function pedidoToFormValues(p: PedidoDto): PedidoFormValues {
  const c = p.comprador;
  return {
    items: p.items.map((item) => ({
      productId: item.productId,
      quantidade: String(item.quantidade),
      desconto: brValueToInput(item.desconto),
      xPed: item.xPed ?? "",
    })),
    pedidoMl: p.pedidoMl ?? "",
    freteConsumidor: brValueToInput(p.freteConsumidor),
    freteSeller: brValueToInput(p.freteSeller),
    cpf: c.cpf,
    nome: c.nome,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento ?? "",
    bairro: c.bairro,
    codigoMunicipio: c.codigoMunicipio,
    municipio: c.municipio,
    uf: c.uf,
    cep: c.cep,
    telefone: c.telefone ?? "",
    indIEDest: String(c.indIEDest ?? 9),
    ie: c.ie ?? "",
  };
}

function parseMonetaryInput(raw: FormDataEntryValue | null): number {
  if (raw == null) return 0;
  const normalized = String(raw).replace(",", ".").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Parses wizard FormData into API checkout input.
 *
 * Items are encoded as `items[0].productId`, `items[0].quantidade`, etc.
 */
export function parsePedidoForm(formData: FormData): PedidoCheckoutInput {
  const opt = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length > 0 ? v : undefined;
  };

  const comprador: CompradorCheckoutInput = {
    cpf: String(formData.get("cpf") ?? "").replace(/\D/g, ""),
    nome: String(formData.get("nome") ?? "").trim(),
    logradouro: String(formData.get("logradouro") ?? "").trim(),
    numero: String(formData.get("numero") ?? "SN").trim(),
    complemento: opt("complemento"),
    bairro: String(formData.get("bairro") ?? "").trim(),
    codigoMunicipio: String(formData.get("codigoMunicipio") ?? "").replace(/\D/g, ""),
    municipio: String(formData.get("municipio") ?? "").trim(),
    uf: String(formData.get("uf") ?? "SP").trim().toUpperCase(),
    cep: String(formData.get("cep") ?? "").replace(/\D/g, ""),
    telefone: opt("telefone"),
    codigoPais: 1058,
    nomePais: "Brasil",
    indIEDest: Number(formData.get("indIEDest") ?? 9),
    ie: opt("ie"),
  };

  const itemCount = Number(formData.get("itemCount") ?? 0);
  const items = Array.from({ length: itemCount }, (_, index) => {
    const xPed = String(formData.get(`items[${index}].xPed`) ?? "").trim();
    return {
      productId: String(formData.get(`items[${index}].productId`) ?? ""),
      quantidade: Number(formData.get(`items[${index}].quantidade`) ?? 1),
      desconto: parseMonetaryInput(formData.get(`items[${index}].desconto`)),
      ...(xPed ? { xPed } : {}),
    };
  }).filter((item) => item.productId);

  const pedidoMl = String(formData.get("pedidoMl") ?? "").trim();

  return {
    items,
    comprador,
    ...(pedidoMl ? { pedidoMl } : {}),
    freteConsumidor: parseMonetaryInput(formData.get("freteConsumidor")),
    freteSeller: parseMonetaryInput(formData.get("freteSeller")),
  };
}

export function formValuesToFormData(v: PedidoFormValues): FormData {
  const fd = new FormData();
  fd.set("itemCount", String(v.items.length));
  v.items.forEach((item, index) => {
    fd.set(`items[${index}].productId`, item.productId);
    fd.set(`items[${index}].quantidade`, item.quantidade);
    fd.set(`items[${index}].desconto`, item.desconto);
    fd.set(`items[${index}].xPed`, item.xPed);
  });
  fd.set("pedidoMl", v.pedidoMl);
  fd.set("freteConsumidor", v.freteConsumidor);
  fd.set("freteSeller", v.freteSeller);
  fd.set("cpf", v.cpf);
  fd.set("nome", v.nome);
  fd.set("logradouro", v.logradouro);
  fd.set("numero", v.numero);
  fd.set("complemento", v.complemento);
  fd.set("bairro", v.bairro);
  fd.set("codigoMunicipio", v.codigoMunicipio);
  fd.set("municipio", v.municipio);
  fd.set("uf", v.uf);
  fd.set("cep", v.cep);
  fd.set("telefone", v.telefone);
  fd.set("indIEDest", v.indIEDest);
  fd.set("ie", v.ie);
  return fd;
}
