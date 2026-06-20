import type {
  NFeDto,
  ProductDto,
  ProductInput,
  PedidoCheckoutInput,
  PedidoDto,
  PedidoFaturarResult,
} from "../fiscal-types";
import {
  authHeaders,
  buildApiUrl,
  getJson,
  mutateJson,
  readApiError,
  readApiErrorPayload,
} from "./client";

export async function listProducts(): Promise<ProductDto[]> {
  return getJson<ProductDto[]>(buildApiUrl("/api/products"));
}

export async function getProduct(id: string): Promise<ProductDto | null> {
  const href = buildApiUrl(`/api/products/${id}`);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<ProductDto>;
}

export async function checkoutPedido(input: PedidoCheckoutInput): Promise<NFeDto> {
  return mutateJson<NFeDto>(buildApiUrl("/api/pedidos/checkout"), "POST", input) as Promise<NFeDto>;
}

export async function listPedidos(): Promise<PedidoDto[]> {
  return getJson<PedidoDto[]>(buildApiUrl("/api/pedidos"));
}

export async function createPedido(input: PedidoCheckoutInput): Promise<PedidoDto> {
  return mutateJson<PedidoDto>(buildApiUrl("/api/pedidos"), "POST", input) as Promise<PedidoDto>;
}

export async function updatePedido(id: string, input: PedidoCheckoutInput): Promise<PedidoDto> {
  return mutateJson<PedidoDto>(buildApiUrl(`/api/pedidos/${id}`), "PATCH", input) as Promise<PedidoDto>;
}

export async function faturarPedido(id: string): Promise<PedidoFaturarResult> {
  return mutateJson<PedidoFaturarResult>(buildApiUrl(`/api/pedidos/${id}/faturar`), "POST") as Promise<PedidoFaturarResult>;
}

export async function deletePedido(id: string): Promise<void> {
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

export async function bulkUpsertProducts(rows: ProductImportRawRow[]): Promise<ProductBulkUpsertResult> {
  return mutateJson<ProductBulkUpsertResult>(buildApiUrl("/api/products/bulk-upsert"), "POST", {
    rows,
  }) as Promise<ProductBulkUpsertResult>;
}

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
