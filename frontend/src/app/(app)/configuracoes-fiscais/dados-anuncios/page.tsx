import type { Metadata } from "next";
import { DadosAnunciosEditor } from "./dados-anuncios-editor";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Dados fiscais dos anúncios" };

export default async function DadosAnunciosPage() {
  const cfg = await getFiscalEmitterSettings();

  return (
    <DadosAnunciosEditor
      initial={
        cfg?.settings.basic ?? {
          formaFaturamento: "EMISSOR_PROPRIO",
          dadosFiscaisAnunciosOk: false,
        }
      }
    />
  );
}
