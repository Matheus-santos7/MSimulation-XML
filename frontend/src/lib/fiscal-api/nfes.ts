import type {
  NFeDto,
} from "../fiscal-types";
import {
  authHeaders,
  buildApiUrl,
  getJson,
  mutateJson,
  readApiError,
} from "./client";

export async function listNfes(): Promise<NFeDto[]> {
  return getJson<NFeDto[]>(buildApiUrl("/api/nfes"));
}

export async function getNfeByChave(chave: string): Promise<NFeDto | null> {
  const href = buildApiUrl(`/api/nfes/${chave}`);
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
  const href = buildApiUrl(`/api/nfes/${chave}/xml`, {
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
  await mutateJson(buildApiUrl(`/api/nfes/${chave}`), "DELETE");
}

export type DevolucaoResult = {
  devolucao: NFeDto;
  remessaSimbolica?: NFeDto;
  saldoEstornado: { remessaNfeId: string; quantidade: number }[];
};

export async function emitirDevolucao(chave: string): Promise<DevolucaoResult> {
  return mutateJson<DevolucaoResult>(
    buildApiUrl(`/api/nfes/${chave}/devolucao`),
    "POST",
  ) as Promise<DevolucaoResult>;
}

export type CancelamentoResult = {
  venda: NFeDto;
  retorno?: NFeDto;
  saldoEstornado: { remessaNfeId: string; quantidade: number }[];
};

export async function cancelarVenda(chave: string, xJust?: string): Promise<CancelamentoResult> {
  return mutateJson<CancelamentoResult>(buildApiUrl(`/api/nfes/${chave}/cancelamento`), "POST", {
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
  return mutateJson<InutilizacaoResult>(buildApiUrl("/api/nfes/inutilizar"), "POST", input) as Promise<InutilizacaoResult>;
}
