import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  chave: string;
  size?: "sm" | "default";
  variant?: "list" | "toolbar";
};

export function NfeXmlActions({ chave, size = "sm", variant = "list" }: Props) {
  const viewHref = `/nfe/${chave}/xml`;
  const downloadHref = `/nfe/${chave}/xml?download=1`;

  if (variant === "toolbar") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size={size} asChild>
          <Link href={viewHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Ver no navegador
          </Link>
        </Button>
        <Button variant="outline" size={size} asChild>
          <a href={downloadHref}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Baixar XML
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ver XML no navegador">
        <Link href={viewHref} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          <span className="sr-only">Ver XML</span>
        </Link>
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Baixar XML">
        <a href={downloadHref}>
          <Download className="h-4 w-4" />
          <span className="sr-only">Baixar XML</span>
        </a>
      </Button>
    </div>
  );
}
