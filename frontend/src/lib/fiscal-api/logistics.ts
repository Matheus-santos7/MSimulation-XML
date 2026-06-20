import type {
  NFeDto,
  CTeDto,
} from "../fiscal-types";
import {
  authHeaders,
  buildApiUrl,
  getJson,
  mutateJson,
  readApiErrorPayload,
} from "./client";

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
    buildApiUrl("/api/unidades-logisticas", {
      q: opts?.q,
      cnpj: opts?.cnpj,
      ativa: opts?.ativa === false ? "false" : opts?.ativa === true ? "true" : undefined,
    }),
  );
}

/** Envia planilha ML (.xlsx) para parse e importação no backend. */
export async function importUnidadesLogisticasSpreadsheet(
  file: File,
  options?: { enrichCep?: boolean },
): Promise<UnidadeLogisticaBulkImportResult> {
  const body = new FormData();
  body.append("file", file);
  if (options?.enrichCep === false) {
    body.append("enrichCep", "false");
  }

  const href = buildApiUrl("/api/unidades-logisticas/bulk-import");
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

  return res.json() as Promise<UnidadeLogisticaBulkImportResult>;
}

export async function setUnidadeLogisticaPadrao(unidadeId: string): Promise<UnidadeLogisticaDto> {
  return mutateJson<UnidadeLogisticaDto>(
    buildApiUrl(`/api/unidades-logisticas/${unidadeId}/padrao`),
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
  return mutateJson<AvancoCdResult>(buildApiUrl("/api/movimentacoes/avanco-cd"), "POST", body) as Promise<AvancoCdResult>;
}

export async function listSaldoRemessaPorCd(
  productId: string,
  productSku?: string,
): Promise<SaldoRemessaCdDto[]> {
  return getJson<SaldoRemessaCdDto[]>(
    buildApiUrl("/api/movimentacoes/saldo-cd", { productId, productSku }),
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
    buildApiUrl("/api/movimentacoes/remessa"),
    "POST",
    body,
  ) as Promise<RemessaManualResult>;
}
