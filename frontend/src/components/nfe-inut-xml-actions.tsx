import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { inutId: string };

export function NfeInutXmlActions({ inutId }: Props) {
  const viewHref = `/nfe/inutilizacao/${inutId}/xml`;
  const downloadHref = `/nfe/inutilizacao/${inutId}/xml?download=1`;

  return (
    <div className="flex items-center justify-end gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-8 text-right shrink-0">
        Inut
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Ver XML inutilização">
        <Link href={viewHref} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="sr-only">Ver XML inutilização</span>
        </Link>
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Baixar XML inutilização">
        <a href={downloadHref}>
          <Download className="h-3.5 w-3.5" />
          <span className="sr-only">Baixar XML inutilização</span>
        </a>
      </Button>
    </div>
  );
}
