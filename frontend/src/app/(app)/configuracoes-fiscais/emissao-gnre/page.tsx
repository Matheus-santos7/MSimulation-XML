import type { Metadata } from "next";
import { EmissaoGnreEditor } from "./emissao-gnre-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Emissão da GNRE" };

export default async function EmissaoGnrePage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = tenantId ? await getFiscalEmitterSettings(tenantId) : null;

  return (
    <EmissaoGnreEditor
      initial={
        cfg?.settings.taxes.emissaoGnre ?? {
          mode: "DEFAULT",
          estadosIeCount: 0,
          estadosComIe: [],
        }
      }
    />
  );
}
