import type { Metadata } from "next";
import { SerieNfeForm } from "./serie-nfe-form";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Série da NF-e" };

export default async function SerieNfePage() {
  const tenantId = await resolveActiveTenantId();
  const cfg = await getFiscalEmitterSettings();
  return (
    <SerieNfeForm
      serieRemessa={cfg?.serieRemessa ?? 5}
      serieCte={cfg?.serieCte ?? 1}
    />
  );
}
