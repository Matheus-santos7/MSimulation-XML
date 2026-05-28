import type { Metadata } from "next";
import { MensagemNfeEditor } from "./mensagem-nfe-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Mensagem na NF-e" };

export default async function MensagemNfePage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = tenantId ? await getFiscalEmitterSettings(tenantId) : null;

  return (
    <MensagemNfeEditor
      initial={{
        mensagemNfeOk: cfg?.settings.nfe.mensagemNfeOk ?? false,
        mensagemPadrao: cfg?.settings.nfe.mensagemPadrao ?? "",
      }}
    />
  );
}
