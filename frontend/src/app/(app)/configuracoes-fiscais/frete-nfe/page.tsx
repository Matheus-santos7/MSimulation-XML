import type { Metadata } from "next";
import { FreteNfeEditor } from "./frete-nfe-editor";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Frete de NF-e" };

export default async function FreteNfePage() {
  const cfg = await getFiscalEmitterSettings();

  return <FreteNfeEditor initial={cfg?.settings.nfe.freteNoCalculo ?? true} />;
}
