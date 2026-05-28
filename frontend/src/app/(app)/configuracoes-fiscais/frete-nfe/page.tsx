import type { Metadata } from "next";
import { FreteNfeEditor } from "./frete-nfe-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Frete de NF-e" };

export default async function FreteNfePage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = tenantId ? await getFiscalEmitterSettings(tenantId) : null;

  return <FreteNfeEditor initial={cfg?.settings.nfe.freteNoCalculo ?? true} />;
}
