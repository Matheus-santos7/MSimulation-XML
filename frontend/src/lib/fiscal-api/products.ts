import type { ProductDto, ProductInput, PedidoCheckoutInput, PedidoDto, PedidoFaturarResult } from "../fiscal-types";
import { authHeaders, buildApiUrl, getJson, mutateJson, readApiErrorPayload } from "./client";

export async function listProducts(): Promise<ProductDto[]> {
  return getJson<ProductDto[]>(buildApiUrl("/api/products"));
}

export async function listOrders(): Promise<PedidoDto[]> {
  return getJson<PedidoDto[]>(buildApiUrl("/api/pedidos"));
}

export async function createOrder(input: PedidoCheckoutInput): Promise<PedidoDto> {
  return mutateJson<PedidoDto>(buildApiUrl("/api/pedidos"), "POST", input) as Promise<PedidoDto>;
}

export async function updateOrder(id: string, input: PedidoCheckoutInput): Promise<PedidoDto> {
  return mutateJson<PedidoDto>(buildApiUrl(`/api/pedidos/${id}`), "PATCH", input) as Promise<PedidoDto>;
}

export async function invoiceOrder(id: string): Promise<PedidoFaturarResult> {
  return mutateJson<PedidoFaturarResult>(buildApiUrl(`/api/pedidos/${id}/faturar`), "POST") as Promise<PedidoFaturarResult>;
}

export async function deleteOrder(id: string): Promise<void> {
  await mutateJson(buildApiUrl(`/api/pedidos/${id}`), "DELETE");
}

export async function createProduct(input: ProductInput): Promise<ProductDto> {
  return mutateJson<ProductDto>(buildApiUrl("/api/products"), "POST", input) as Promise<ProductDto>;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<ProductDto> {
  return mutateJson<ProductDto>(buildApiUrl(`/api/products/${id}`), "PATCH", input) as Promise<ProductDto>;
}

export async function deleteProduct(id: string): Promise<void> {
  await mutateJson(buildApiUrl(`/api/products/${id}`), "DELETE");
}

/** Linha bruta da planilha — validação fiscal no backend. */
export type ProductImportRawRow = {
  line: number;
  sku: string;
  ean?: string;
  nome: string;
  ncm: string;
  cest?: string | null;
  exTipi?: string;
  origem?: string | number;
  nfci?: string;
  unidade?: string;
  preco: string | number;
  precoCusto: string | number;
  estoque?: string | number;
  taxRuleBaseId?: string;
};

export type ProductBulkUpsertResult = {
  created: number;
  updated: number;
  failed: { line: number; sku: string; error: string }[];
  parseErrors?: { line: number; message: string }[];
  total: number;
};

/** Envia planilha CSV/XLSX para parse e importação no backend. */
export async function importProductsSpreadsheet(file: File): Promise<ProductBulkUpsertResult> {
  const body = new FormData();
  body.append("file", file);

  const href = buildApiUrl("/api/products/import-spreadsheet");
  const res = await fetch(href, {
    method: "POST",
    headers: await authHeaders(),
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    throw new Error(payload.error);
  }

  return res.json() as Promise<ProductBulkUpsertResult>;
}
