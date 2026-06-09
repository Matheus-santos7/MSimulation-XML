import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  chave: string;
};

export function CteXmlActions({ chave }: Props) {
  const viewHref = `/cte/${chave}/xml`;
  const downloadHref = `/cte/${chave}/xml?download=1`;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={viewHref} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Ver XML
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={downloadHref}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Baixar XML
        </a>
      </Button>
    </div>
  );
}
