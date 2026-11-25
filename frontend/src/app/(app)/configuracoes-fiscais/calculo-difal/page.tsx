import type { Metadata } from "next";
import { CalculoDifalEditor } from "./calculo-difal-editor";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Cálculo DIFAL" };

export default async function CalculoDifalPage() {
  const cfg = await getFiscalEmitterSettings();

  return (
    <CalculoDifalEditor
      initial={
        cfg?.settings.taxes.calculoDifal ?? {
          mode: "CUSTOM",
          bulk: "PADRAO",
          porUf: {},
        }
      }
    />
  );
}
