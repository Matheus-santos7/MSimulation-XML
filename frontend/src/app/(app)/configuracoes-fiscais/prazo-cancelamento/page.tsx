import type { Metadata } from "next";
import { PrazoCancelamentoEditor } from "./prazo-cancelamento-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Prazo para cancelamento" };

export default async function PrazoCancelamentoPage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = await getFiscalEmitterSettings();

  return (
    <PrazoCancelamentoEditor
      initial={cfg?.settings.nfe.prazoCancelamento ?? { horas: 24, naoInformar: false }}
    />
  );
}
