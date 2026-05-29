import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FiscalEventDto } from "@/lib/fiscal-types";

type Props = {
  chave: string;
  status: string;
  cancelamentoEvent?: FiscalEventDto | null;
  size?: "sm" | "default";
  variant?: "list" | "toolbar";
};

function XmlLinkPair({
  label,
  viewHref,
  downloadHref,
  compact,
}: {
  label: string;
  viewHref: string;
  downloadHref: string;
  compact: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-8 text-right shrink-0">
          {label}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild title={`Ver XML ${label}`}>
          <Link href={viewHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="sr-only">Ver XML {label}</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild title={`Baixar XML ${label}`}>
          <a href={downloadHref}>
            <Download className="h-3.5 w-3.5" />
            <span className="sr-only">Baixar XML {label}</span>
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider min-w-[4.5rem]">{label}</span>
      <Button variant="outline" size="sm" asChild>
        <Link href={viewHref} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Ver
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={downloadHref}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Baixar
        </a>
      </Button>
    </div>
  );
}

export function NfeXmlActions({
  chave,
  status,
  cancelamentoEvent,
  size = "sm",
  variant = "list",
}: Props) {
  const nfeViewHref = `/nfe/${chave}/xml`;
  const nfeDownloadHref = `/nfe/${chave}/xml?download=1`;
  const eventoViewHref = `/nfe/${chave}/xml?doc=evento`;
  const eventoDownloadHref = `/nfe/${chave}/xml?doc=evento&download=1`;

  const showCancelamento =
    status === "CANCELADA" && (cancelamentoEvent?.tipo === "110111" || !cancelamentoEvent);

  const compact = variant === "list";

  if (variant === "toolbar") {
    return (
      <div className="flex flex-col gap-2">
        <XmlLinkPair label="NF-e" viewHref={nfeViewHref} downloadHref={nfeDownloadHref} compact={false} />
        {showCancelamento && (
          <XmlLinkPair
            label="Cancel."
            viewHref={eventoViewHref}
            downloadHref={eventoDownloadHref}
            compact={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-[7rem]">
      <XmlLinkPair label="NF-e" viewHref={nfeViewHref} downloadHref={nfeDownloadHref} compact={compact} />
      {showCancelamento && (
        <XmlLinkPair
          label="Evt"
          viewHref={eventoViewHref}
          downloadHref={eventoDownloadHref}
          compact={compact}
        />
      )}
    </div>
  );
}
