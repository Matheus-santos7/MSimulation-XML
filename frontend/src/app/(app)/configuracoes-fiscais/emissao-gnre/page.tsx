import type { Metadata } from "next";
import { EmissaoGnreEditor } from "./emissao-gnre-editor";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Emissão da GNRE" };

export default async function EmissaoGnrePage() {
  const cfg = await getFiscalEmitterSettings();

  return (
    <EmissaoGnreEditor
      initial={
        cfg?.settings.taxes.emissaoGnre ?? {
          mode: "DEFAULT",
          estadosIeCount: 0,
          estadosComIe: [],
        }
      }
    />
  );
}
