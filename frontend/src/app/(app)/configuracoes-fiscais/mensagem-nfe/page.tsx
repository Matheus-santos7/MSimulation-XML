import type { Metadata } from "next";
import { MensagemNfeEditor } from "./mensagem-nfe-editor";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "Mensagem na NF-e" };

export default async function MensagemNfePage() {
  const cfg = await getFiscalEmitterSettings();

  return (
    <MensagemNfeEditor
      initial={{
        mensagemNfeOk: cfg?.settings.nfe.mensagemNfeOk ?? false,
        mensagemPadrao: cfg?.settings.nfe.mensagemPadrao ?? "",
      }}
    />
  );
}
