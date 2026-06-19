"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadFromApi } from "@/lib/http/authenticated-fetch";

/**
 * Dispara download da planilha XLSX com todos os cenários fiscais do tenant.
 */
export function TimelineExportButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      await downloadFromApi("/api/timeline/spreadsheet/export", "cenarios-fiscais.xlsx");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao exportar cenários");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={pending}
        className="gap-2 h-8 text-[11px] font-bold uppercase tracking-wider"
      >
        <Download className="size-3.5" />
        {pending ? "Exportando..." : "Exportar XLSX"}
      </Button>
      {error && <span className="text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
