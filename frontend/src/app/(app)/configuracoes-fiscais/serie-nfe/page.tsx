import type { Metadata } from "next";
import { SerieNfeForm } from "./serie-nfe-form";
import { resolveActiveTenantId } from "@/lib/active-tenant";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Série da NF-e" };
export const dynamic = "force-dynamic";

export default async function SerieNfePage() {
  await resolveActiveTenantId();
  const cfg = await getFiscalEmitterSettings();
  const numeracaoRemessa =
    cfg?.numeracaoNfe.remessa ?? { numeroInicial: 1, ultimoEmitido: null, proximoNumero: 1 };
  const numeracaoTransferencia =
    cfg?.numeracaoNfe.transferencia ?? { numeroInicial: 1, ultimoEmitido: null, proximoNumero: 1 };

  return (
    <SerieNfeForm
      key={`${cfg?.serieRemessa ?? 5}-${cfg?.serieTransferencia ?? 8}-${numeracaoRemessa.numeroInicial}-${numeracaoRemessa.proximoNumero}-${numeracaoTransferencia.numeroInicial}-${numeracaoTransferencia.proximoNumero}`}
      serieRemessa={cfg?.serieRemessa ?? 5}
      serieTransferencia={cfg?.serieTransferencia ?? 8}
      serieCte={cfg?.serieCte ?? 1}
      numeracaoRemessa={numeracaoRemessa}
      numeracaoTransferencia={numeracaoTransferencia}
    />
  );
}
