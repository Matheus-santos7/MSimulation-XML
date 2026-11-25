import type { Metadata } from "next";
import { CstDevolucaoEditor } from "./cst-devolucao-editor";
import { getFiscalEmitterSettings } from "@/lib/fiscal-api";

export const metadata: Metadata = { title: "CST da NF-e de devolução" };

export default async function CstDevolucaoPage() {
  const cfg = await getFiscalEmitterSettings();
  const initial = cfg?.settings.taxes.cstDevolucao ?? {
    mode: "CUSTOM" as const,
    icms: [],
    pisCofins: [],
  };

  return <CstDevolucaoEditor initial={initial} />;
}
