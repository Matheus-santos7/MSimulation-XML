import { cache } from "react";
import { resolveAccessToken } from "@/lib/auth/session";
import type {
  AuditEntryDto,
  CTeDto,
  EmitenteDto,
  FiscalEventDto,
  NFeDto,
  PedidoCheckoutInput,
  PedidoDto,
  PedidoFaturarResult,
  ProductDto,
  ProductInput,
  TaxRuleCatalogEntry,
  TaxRuleDto,
  TenantDto,
  TenantInput,
  UserDto,
  UserInput,
  UserUpdateInput,
  TimelineRemessaGroupDto,
  TimelineStepDto,
} from "./fiscal-types";
import type {
  FiscalEmitterSettingsPatch,
  FiscalEmitterSettingsView,
} from "./fiscal-emitter-settings-types";
import { apiBase } from "@/lib/api-base";
import { toUserFacingError } from "./user-facing-error";

function url(path: string, query?: Record<string, string | undefined>): string {
  const u = new URL(path.startsWith("/") ? path : `/${path}`, `${apiBase()}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await resolveAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function readApiError(res: Response): Promise<string> {
  return (await readApiErrorPayload(res)).error;
}

type ApiErrorPayload = {
  error: string;
  details?: Record<string, string[]>;
};

async function readApiErrorPayload(res: Response): Promise<ApiErrorPayload> {
  const text = await res.text().catch(() => "");
  if (!text) {
    return { error: toUserFacingError(res.statusText, { status: res.status }) };
  }
  try {
    const parsed = JSON.parse(text) as {
      error?: string;
      message?: string;
      details?: Record<string, string[]>;
    };
    const error =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      text;
    return {
      error: toUserFacingError(error, { status: res.status }),
      details: parsed.details,
    };
  } catch {
    return { error: toUserFacingError(text, { status: res.status }) };
  }
}

export class ApiValidationError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiValidationError";
    this.fieldErrors = fieldErrors;
  }
}

async function getJson<T>(href: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  } catch (err) {
    const base = apiBase();
    const msg =
      err instanceof Error && "cause" in err && err.cause instanceof Error && err.cause.message.includes("ECONNREFUSED")
        ? `API indisponível em ${base}. Rode \`pnpm dev\` na raiz (sobe API + Next) ou \`pnpm dev:backend\` em outro terminal.`
        : err instanceof Error
          ? err.message
          : "Falha ao conectar na API";
    throw new Error(msg);
  }
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<T>;
}

export async function listTenants(): Promise<TenantDto[]> {
  return getJson<TenantDto[]>(url("/api/tenants"));
}

export async function getTenant(id: string): Promise<TenantDto | null> {
  const href = url(`/api/tenants/${id}`);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<TenantDto>;
}

async function mutateJson<T>(
  href: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T | void> {
  let res: Response;
  try {
    const baseHeaders = await authHeaders();
    res = await fetch(href, {
      method,
      headers: {
        ...baseHeaders,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    const base = apiBase();
    throw new Error(
      err instanceof Error && String(err).includes("ECONNREFUSED")
        ? `API indisponível em ${base}. Rode \`pnpm dev\` na raiz.`
        : err instanceof Error
          ? err.message
          : "Falha ao conectar na API",
    );
  }
  if (res.status === 204) return;
  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    if (payload.details) {
      throw new ApiValidationError(payload.error, payload.details);
    }
    throw new Error(payload.error);
  }
  return res.json() as Promise<T>;
}

export async function createTenant(input: TenantInput): Promise<TenantDto> {
  return mutateJson<TenantDto>(url("/api/tenants"), "POST", input) as Promise<TenantDto>;
}

export async function updateTenant(id: string, input: Partial<TenantInput>): Promise<TenantDto> {
  return mutateJson<TenantDto>(url(`/api/tenants/${id}`), "PATCH", input) as Promise<TenantDto>;
}

export async function deleteTenant(id: string): Promise<void> {
  await mutateJson(url(`/api/tenants/${id}`), "DELETE");
}

/** Uma chamada por request (layout + páginas compartilham o mesmo resultado). */
export const getTenants = cache(listTenants);

export async function listUsers(): Promise<UserDto[]> {
  return getJson<UserDto[]>(url("/api/users"));
}

export const getUsers = cache(listUsers);

export async function getUser(id: string): Promise<UserDto | null> {
  const href = url(`/api/users/${id}`);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<UserDto>;
}

export async function createUser(input: UserInput): Promise<UserDto> {
  return mutateJson<UserDto>(url("/api/users"), "POST", input) as Promise<UserDto>;
}

export async function updateUser(id: string, input: UserUpdateInput): Promise<UserDto> {
  return mutateJson<UserDto>(url(`/api/users/${id}`), "PATCH", input) as Promise<UserDto>;
}

export async function deleteUser(id: string): Promise<void> {
  await mutateJson(url(`/api/users/${id}`), "DELETE");
}

export async function listNfes(): Promise<NFeDto[]> {
  return getJson<NFeDto[]>(url("/api/nfes"));
}

export async function getNfeByChave(chave: string): Promise<NFeDto | null> {
  const href = url(`/api/nfes/${chave}`);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<NFeDto>;
}

/** XML da NF-e ou do evento de cancelamento — sempre via backend. */
export async function getNfeXml(
  chave: string,
  options?: { download?: boolean; doc?: "evento" },
): Promise<{ xml: string; filename: string }> {
  const href = url(`/api/nfes/${chave}/xml`, {
    ...(options?.download ? { download: "1" } : {}),
    ...(options?.doc === "evento" ? { doc: "evento" } : {}),
  });
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const xml = await res.text();
  const disp = res.headers.get("Content-Disposition");
  const match = disp?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `NFe_${chave}.xml`;
  return { xml, filename };
}

export async function deleteNfe(chave: string): Promise<void> {
  await mutateJson(url(`/api/nfes/${chave}`), "DELETE");
}

export type DevolucaoResult = {
  devolucao: NFeDto;
  remessaSimbolica?: NFeDto;
  saldoEstornado: { remessaNfeId: string; quantidade: number }[];
};

export async function emitirDevolucao(chave: string): Promise<DevolucaoResult> {
  return mutateJson<DevolucaoResult>(
    url(`/api/nfes/${chave}/devolucao`),
    "POST",
  ) as Promise<DevolucaoResult>;
}

export type CancelamentoResult = {
  venda: NFeDto;
  retorno?: NFeDto;
  saldoEstornado: { remessaNfeId: string; quantidade: number }[];
};

export async function cancelarVenda(chave: string, xJust?: string): Promise<CancelamentoResult> {
  return mutateJson<CancelamentoResult>(url(`/api/nfes/${chave}/cancelamento`), "POST", {
    xJust,
  }) as Promise<CancelamentoResult>;
}

export type InutilizacaoResult = {
  id: string;
  tipo: string;
  descricao: string;
  serie: number;
  numeroIni: number;
  numeroFim: number;
  xJust: string;
  protocolo: string;
  ocorridoEm: string;
};

export async function inutilizarNumeracao(input: {
  serie: number;
  numeroIni: number;
  numeroFim: number;
  xJust?: string;
}): Promise<InutilizacaoResult> {
  return mutateJson<InutilizacaoResult>(url("/api/nfes/inutilizar"), "POST", input) as Promise<InutilizacaoResult>;
}

export async function getEmitente(): Promise<EmitenteDto> {
  return getJson<EmitenteDto>(url("/api/emitente"));
}

export async function listCtes(): Promise<CTeDto[]> {
  return getJson<CTeDto[]>(url("/api/ctes"));
}

export async function getCteByChave(chave: string): Promise<CTeDto | null> {
  const href = url(`/api/ctes/${chave}`);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<CTeDto>;
}

/** XML persistido ou regerado no backend. */
export async function getCteXml(
  chave: string,
  options?: { download?: boolean },
): Promise<{ xml: string; filename: string }> {
  const href = url(`/api/ctes/${chave}/xml`, options?.download ? { download: "1" } : undefined);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const xml = await res.text();
  const disp = res.headers.get("Content-Disposition");
  const match = disp?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `CTe_${chave}.xml`;
  return { xml, filename };
}

/** XML de inutilização de numeração (procInutNFe). */
export async function getFiscalEventXml(
  id: string,
  options?: { download?: boolean },
): Promise<{ xml: string; filename: string }> {
  const href = url(`/api/fiscal-events/${id}/xml`, options?.download ? { download: "1" } : undefined);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const xml = await res.text();
  const disp = res.headers.get("Content-Disposition");
  const match = disp?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `Inut_${id}.xml`;
  return { xml, filename };
}

export async function deleteCte(chave: string): Promise<void> {
  await mutateJson(url(`/api/ctes/${chave}`), "DELETE");
}

export async function listFiscalEvents(): Promise<FiscalEventDto[]> {
  return getJson<FiscalEventDto[]>(url("/api/fiscal-events"));
}

export async function listAuditLogs(): Promise<AuditEntryDto[]> {
  return getJson<AuditEntryDto[]>(url("/api/audit-logs"));
}

export async function listTimeline(): Promise<TimelineRemessaGroupDto[]> {
  return getJson<TimelineRemessaGroupDto[]>(url("/api/timeline"));
}

export async function listTimelineSteps(): Promise<TimelineStepDto[]> {
  return getJson<TimelineStepDto[]>(url("/api/timeline/steps"));
}

export async function listProducts(): Promise<ProductDto[]> {
  return getJson<ProductDto[]>(url("/api/products"));
}

export async function getProduct(id: string): Promise<ProductDto | null> {
  const href = url(`/api/products/${id}`);
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<ProductDto>;
}

export async function checkoutPedido(input: PedidoCheckoutInput): Promise<NFeDto> {
  return mutateJson<NFeDto>(url("/api/pedidos/checkout"), "POST", input) as Promise<NFeDto>;
}

export async function listPedidos(): Promise<PedidoDto[]> {
  return getJson<PedidoDto[]>(url("/api/pedidos"));
}

export async function createPedido(input: PedidoCheckoutInput): Promise<PedidoDto> {
  return mutateJson<PedidoDto>(url("/api/pedidos"), "POST", input) as Promise<PedidoDto>;
}

export async function updatePedido(id: string, input: PedidoCheckoutInput): Promise<PedidoDto> {
  return mutateJson<PedidoDto>(url(`/api/pedidos/${id}`), "PATCH", input) as Promise<PedidoDto>;
}

export async function faturarPedido(id: string): Promise<PedidoFaturarResult> {
  return mutateJson<PedidoFaturarResult>(url(`/api/pedidos/${id}/faturar`), "POST") as Promise<PedidoFaturarResult>;
}

export async function deletePedido(id: string): Promise<void> {
  await mutateJson(url(`/api/pedidos/${id}`), "DELETE");
}

export async function createProduct(input: ProductInput): Promise<ProductDto> {
  return mutateJson<ProductDto>(url("/api/products"), "POST", input) as Promise<ProductDto>;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<ProductDto> {
  return mutateJson<ProductDto>(url(`/api/products/${id}`), "PATCH", input) as Promise<ProductDto>;
}

export async function deleteProduct(id: string): Promise<void> {
  await mutateJson(url(`/api/products/${id}`), "DELETE");
}

/** Linha bruta da planilha — validação fiscal no backend. */
export type ProductImportRawRow = {
  line: number;
  sku: string;
  ean?: string;
  nome: string;
  ncm: string;
  cest: string;
  exTipi?: string;
  origem?: string | number;
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
  return mutateJson<ProductBulkUpsertResult>(url("/api/products/bulk-upsert"), "POST", {
    rows,
  }) as Promise<ProductBulkUpsertResult>;
}

/** Envia planilha CSV/XLSX para parse e importação no backend. */
export async function importProductsSpreadsheet(file: File): Promise<ProductBulkUpsertResult> {
  const body = new FormData();
  body.append("file", file);

  const href = url("/api/products/import-spreadsheet");
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

export async function listTaxRules(): Promise<TaxRuleDto[]> {
  return getJson<TaxRuleDto[]>(url("/api/tax-rules"));
}

export async function listTaxRuleCatalog(): Promise<TaxRuleCatalogEntry[]> {
  return getJson<TaxRuleCatalogEntry[]>(url("/api/tax-rules/catalog"));
}

export type TaxRuleImportRow = {
  ruleId: string;
  nome: string;
  tipo: string;
  uf: string;
  cfop?: string;
  aliquota?: string;
  transactionType?: string;
  customerType?: string;
  origin?: string;
  payload?: Record<string, unknown>;
};

export type TaxRuleBulkUpsertResult = {
  created: number;
  updated: number;
  total: number;
};

export type TaxRuleSpreadsheetImportResult = TaxRuleBulkUpsertResult & {
  parseErrors?: { line: number; message: string }[];
};

export async function bulkUpsertTaxRules(rows: TaxRuleImportRow[]): Promise<TaxRuleBulkUpsertResult> {
  return mutateJson<TaxRuleBulkUpsertResult>(url("/api/tax-rules/bulk-upsert"), "POST", {
    rows,
  }) as Promise<TaxRuleBulkUpsertResult>;
}

/** Envia a planilha ML (.xlsx) para interpretação e persistência no backend. */
export async function importTaxRulesSpreadsheet(file: File): Promise<TaxRuleSpreadsheetImportResult> {
  const body = new FormData();
  body.append("file", file);

  const href = url("/api/tax-rules/import-spreadsheet");
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

  return res.json() as Promise<TaxRuleSpreadsheetImportResult>;
}

export type TaxRuleDeleteResult = {
  deleted: number;
  nome: string;
};

export async function deleteTaxRuleGroup(
  baseId: string,
  origin: string,
): Promise<TaxRuleDeleteResult> {
  const href = url(`/api/tax-rules/${encodeURIComponent(baseId)}`, {
    origin: origin.toUpperCase().slice(0, 2),
  });
  return mutateJson<TaxRuleDeleteResult>(href, "DELETE") as Promise<TaxRuleDeleteResult>;
}

export async function deleteAllTaxRules(): Promise<{ deleted: number }> {
  return mutateJson<{ deleted: number }>(url("/api/tax-rules"), "DELETE") as Promise<{
    deleted: number;
  }>;
}

export async function getFiscalEmitterSettings(): Promise<FiscalEmitterSettingsView | null> {
  const href = url("/api/fiscal-settings");
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<FiscalEmitterSettingsView>;
}

export async function patchFiscalEmitterSettings(
  patch: FiscalEmitterSettingsPatch,
): Promise<FiscalEmitterSettingsView> {
  return mutateJson<FiscalEmitterSettingsView>(url("/api/fiscal-settings"), "PATCH", patch) as Promise<FiscalEmitterSettingsView>;
}

export type UnidadeLogisticaImportRow = {
  unidade: string;
  cnpj: string | number;
  inscricaoEstadual?: string | number;
  idCadIntTran?: string | null;
  logradouro: string;
  numero: string;
  cidade: string;
  uf: string;
  cep: string | number;
};

export type UnidadeLogisticaDto = {
  id: string;
  tenantId: string;
  codigo: string;
  nome: string;
  destNomeFiscal: string;
  cnpj: string;
  ie?: string;
  idCadIntTran?: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
    codigoMunicipio: string;
  };
  ativa: boolean;
  padrao?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UnidadeLogisticaBulkImportResult = {
  totalPlanilha: number;
  unicos: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
  parseErrors?: { line: number; message: string }[];
};

export type AvancoCdResult = {
  remessaSimbolica: NFeDto;
  retornoSimbolico: NFeDto;
  cte: CTeDto;
  alocacoesOrigem: { remessaNfeId: string; quantidade: number }[];
};

export type SaldoRemessaCdDto = {
  unidadeDestinoId: string;
  fifoUnidadeDestinoId?: string;
  productId: string;
  saldo: number;
  unidade: {
    codigo: string;
    nome: string;
    uf: string;
  } | null;
};

export type MovimentacaoProdutoDto = {
  id: string;
  tipoOperacao: string;
  quantidade: number;
  unidadeOrigemId?: string;
  unidadeDestinoId?: string;
  unidadeOrigem?: { codigo: string; nome: string };
  unidadeDestino?: { codigo: string; nome: string };
  nfeId: string;
  nfe?: { chave: string; tipo: string; numero: number; serie: number };
  nfeSecundariaId?: string;
  nfeSecundaria?: { chave: string; tipo: string; numero: number; serie: number };
  observacao?: string;
  createdAt: string;
};

export async function listUnidadesLogisticas(opts?: {
  q?: string;
  cnpj?: string;
  ativa?: boolean;
}): Promise<UnidadeLogisticaDto[]> {
  return getJson<UnidadeLogisticaDto[]>(
    url("/api/unidades-logisticas", {
      q: opts?.q,
      cnpj: opts?.cnpj,
      ativa: opts?.ativa === false ? "false" : opts?.ativa === true ? "true" : undefined,
    }),
  );
}

export async function bulkImportUnidadesLogisticas(
  rows: UnidadeLogisticaImportRow[],
  enrichCep = true,
): Promise<UnidadeLogisticaBulkImportResult> {
  return mutateJson<UnidadeLogisticaBulkImportResult>(
    url("/api/unidades-logisticas/bulk-import"),
    "POST",
    { rows, enrichCep },
  ) as Promise<UnidadeLogisticaBulkImportResult>;
}

export async function setUnidadeLogisticaPadrao(unidadeId: string): Promise<UnidadeLogisticaDto> {
  return mutateJson<UnidadeLogisticaDto>(
    url(`/api/unidades-logisticas/${unidadeId}/padrao`),
    "PATCH",
  ) as Promise<UnidadeLogisticaDto>;
}

export async function emitirAvancoCd(body: {
  productId: string;
  productSku?: string;
  quantidade: number;
  unidadeOrigemId: string;
  unidadeDestinoId: string;
}): Promise<AvancoCdResult> {
  return mutateJson<AvancoCdResult>(url("/api/movimentacoes/avanco-cd"), "POST", body) as Promise<AvancoCdResult>;
}

export async function listSaldoRemessaPorCd(
  productId: string,
  productSku?: string,
): Promise<SaldoRemessaCdDto[]> {
  return getJson<SaldoRemessaCdDto[]>(
    url("/api/movimentacoes/saldo-cd", { productId, productSku }),
  );
}

export type RemessaManualItemInput = {
  productId: string;
  productSku?: string;
  quantidade: number;
};

export type RemessaManualResult = {
  nfe: NFeDto;
  cte: CTeDto;
};

export async function emitirRemessaManual(body: {
  unidadeDestinoId: string;
  items: RemessaManualItemInput[];
}): Promise<RemessaManualResult> {
  return mutateJson<RemessaManualResult>(
    url("/api/movimentacoes/remessa"),
    "POST",
    body,
  ) as Promise<RemessaManualResult>;
}

export async function realignRemessaFifo(productSku: string): Promise<{
  atualizados: number;
  productId: string | null;
}> {
  return mutateJson<{ atualizados: number; productId: string | null }>(
    url("/api/movimentacoes/remessa/realign-fifo"),
    "POST",
    { productSku },
  ) as Promise<{ atualizados: number; productId: string | null }>;
}

export async function listMovimentacoesProduto(opts?: {
  productId?: string;
  limit?: number;
}): Promise<MovimentacaoProdutoDto[]> {
  return getJson<MovimentacaoProdutoDto[]>(
    url("/api/movimentacoes-produto", {
      productId: opts?.productId,
      limit: opts?.limit != null ? String(opts.limit) : undefined,
    }),
  );
}
