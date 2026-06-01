import type { Metadata } from "next";
import { AcrescimoPrecoEditor } from "./acrescimo-preco-editor";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Acréscimo no preço do produto" };

export default async function AcrescimoPrecoPage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = await getFiscalEmitterSettings();

  return <AcrescimoPrecoEditor initial={cfg?.settings.nfe.acrescimoPrecoProduto ?? false} />;
}
