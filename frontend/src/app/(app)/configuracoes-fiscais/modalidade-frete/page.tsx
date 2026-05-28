import type { Metadata } from "next";
import { ModalidadeFreteEditor } from "./modalidade-frete-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Modalidade de Frete" };

export default async function ModalidadeFretePage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = tenantId ? await getFiscalEmitterSettings(tenantId) : null;

  return (
    <ModalidadeFreteEditor
      initial={
        cfg?.settings.taxes.modalidadeFrete ?? {
          mode: "CUSTOM",
          fullfilmentVendas: "0",
          fullfilmentEntrada: "0",
          coleta: "0",
          flex: "0",
          turbo: "0",
        }
      }
    />
  );
}
