import type { Metadata } from "next";
import { ComposicaoBaseEditor } from "./composicao-base-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Composição da base de cálculo" };

export default async function ComposicaoBaseCalculoPage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = tenantId ? await getFiscalEmitterSettings(tenantId) : null;

  return (
    <ComposicaoBaseEditor
      initial={
        cfg?.settings.taxes.composicaoBaseCalculo ?? {
          mode: "CUSTOM",
          pisCofins: {} as never,
          icms: {} as never,
          ipi: {} as never,
        }
      }
    />
  );
}
