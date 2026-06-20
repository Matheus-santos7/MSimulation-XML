import type {
  FiscalEmitterSettingsPatch,
  FiscalEmitterSettingsView,
} from "../fiscal-emitter-settings-types";
import {
  authHeaders,
  buildApiUrl,
  mutateJson,
  readApiError,
} from "./client";

export async function getFiscalEmitterSettings(): Promise<FiscalEmitterSettingsView | null> {
  const href = buildApiUrl("/api/fiscal-settings");
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<FiscalEmitterSettingsView>;
}

export async function patchFiscalEmitterSettings(
  patch: FiscalEmitterSettingsPatch,
): Promise<FiscalEmitterSettingsView> {
  return mutateJson<FiscalEmitterSettingsView>(buildApiUrl("/api/fiscal-settings"), "PATCH", patch) as Promise<FiscalEmitterSettingsView>;
}
