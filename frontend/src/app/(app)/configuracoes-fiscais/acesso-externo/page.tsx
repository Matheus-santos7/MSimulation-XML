import type { Metadata } from "next";
import { AcessoExternoEditor } from "./acesso-externo-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Acesso externo a NF-e" };

export default async function AcessoExternoPage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = tenantId ? await getFiscalEmitterSettings(tenantId) : null;

  return <AcessoExternoEditor initial={cfg?.settings.nfe.contatos ?? []} />;
}
