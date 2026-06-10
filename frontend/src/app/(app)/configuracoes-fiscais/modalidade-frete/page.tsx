import type { Metadata } from "next";
import { ModalidadeFreteEditor } from "./modalidade-frete-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Modalidade de Frete" };

export default async function ModalidadeFretePage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = await getFiscalEmitterSettings();

  return (
    <ModalidadeFreteEditor
      initial={
        cfg?.settings.taxes.modalidadeFrete ?? {
          mode: "CUSTOM",
          fullfilmentVendas: "0",
          fullfilmentEntrada: "9",
          coleta: "2",
          flex: "0",
          turbo: "0",
        }
      }
    />
  );
}
