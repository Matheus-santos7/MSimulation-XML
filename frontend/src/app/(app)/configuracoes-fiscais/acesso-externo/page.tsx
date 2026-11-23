import type { Metadata } from "next";
import { AcessoExternoEditor } from "./acesso-externo-editor";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Acesso externo a NF-e" };

export default async function AcessoExternoPage() {
  const cfg = await getFiscalEmitterSettings();

  return <AcessoExternoEditor initial={cfg?.settings.nfe.contatos ?? []} />;
}
