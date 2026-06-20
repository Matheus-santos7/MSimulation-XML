import type {
  CTeDto,
  EmitenteDto,
  FiscalEventDto,
  AuditEntryDto,
  TimelineRemessaGroupDto,
  TimelineStepDto,
} from "../fiscal-types";
import {
  authHeaders,
  buildApiUrl,
  getJson,
  mutateJson,
  readApiError,
} from "./client";

export async function getEmitente(): Promise<EmitenteDto> {
  return getJson<EmitenteDto>(buildApiUrl("/api/emitente"));
}

export async function listCtes(): Promise<CTeDto[]> {
  return getJson<CTeDto[]>(buildApiUrl("/api/ctes"));
}

export async function getCteByChave(chave: string): Promise<CTeDto | null> {
  const href = buildApiUrl(`/api/ctes/${chave}`);
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
  const href = buildApiUrl(`/api/ctes/${chave}/xml`, options?.download ? { download: "1" } : undefined);
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
  const href = buildApiUrl(`/api/fiscal-events/${id}/xml`, options?.download ? { download: "1" } : undefined);
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
  await mutateJson(buildApiUrl(`/api/ctes/${chave}`), "DELETE");
}

export async function listFiscalEvents(): Promise<FiscalEventDto[]> {
  return getJson<FiscalEventDto[]>(buildApiUrl("/api/fiscal-events"));
}

export async function listAuditLogs(): Promise<AuditEntryDto[]> {
  return getJson<AuditEntryDto[]>(buildApiUrl("/api/audit-logs"));
}

export async function listTimeline(): Promise<TimelineRemessaGroupDto[]> {
  return getJson<TimelineRemessaGroupDto[]>(buildApiUrl("/api/timeline"));
}

export async function listTimelineSteps(): Promise<TimelineStepDto[]> {
  return getJson<TimelineStepDto[]>(buildApiUrl("/api/timeline/steps"));
}
