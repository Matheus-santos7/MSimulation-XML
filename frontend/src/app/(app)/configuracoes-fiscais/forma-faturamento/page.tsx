import type { Metadata } from "next";
import { FormaFaturamentoForm } from "./forma-faturamento-form";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Forma de Faturamento" };

export default async function FormaFaturamentoPage() {
  const cfg = await getFiscalEmitterSettings();
  return <FormaFaturamentoForm initial={cfg?.settings.basic ?? { formaFaturamento: "EMISSOR_PROPRIO", dadosFiscaisAnunciosOk: false }} />;
}
