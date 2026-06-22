"use client";

import { highlightXML } from "@/lib/highlight-xml";
import { useState, type ReactNode } from "react";

const SYNTAX_CLASS: Record<string, string> = {
  tag: "text-emerald-700 dark:text-emerald-400",
  attr: "text-amber-700 dark:text-amber-400",
  value: "text-sky-700 dark:text-sky-400",
  comment: "text-muted-foreground",
  text: "text-foreground/90 dark:text-zinc-300",
};

export function XMLViewer({
  xml,
  filename = "documento.xml",
  toolbarExtra,
}: {
  xml: string;
  filename?: string;
  toolbarExtra?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const tokens = highlightXML(xml);

  const onCopy = async () => {
    await navigator.clipboard.writeText(xml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="border border-border rounded-lg bg-zinc-50 dark:bg-zinc-950 overflow-hidden flex flex-col h-full shadow-sm dark:shadow-none">
      <div className="px-4 py-2 border-b border-border bg-muted/70 dark:bg-zinc-900/80 flex justify-between items-center shrink-0">
        <span className="text-[12px] font-mono text-muted-foreground truncate pr-3">{filename}</span>
        <div className="flex items-center gap-3 shrink-0">
          {toolbarExtra}
          <button
            type="button"
            onClick={onCopy}
            className="text-[12px] text-brand-xml font-bold uppercase tracking-wider hover:underline"
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
      <pre className="p-4 font-mono text-[13px] leading-relaxed overflow-auto flex-1 whitespace-pre-wrap break-all select-text bg-zinc-50 dark:bg-zinc-950">
        {tokens.map((t, i) => (
          <span key={i} className={SYNTAX_CLASS[t.kind] ?? SYNTAX_CLASS.text}>
            {t.text}
          </span>
        ))}
      </pre>
    </div>
  );
}
