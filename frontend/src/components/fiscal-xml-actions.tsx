"use client";

import { useTransition } from "react";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  fiscalEventHasXml,
  fiscalEventXmlHref,
  fiscalXmlHref,
  type FiscalXmlHref,
} from "@/lib/fiscal-xml-routes";
import { downloadFromApi, openXmlFromApi } from "@/lib/http/authenticated-fetch";
import { toUserFacingError } from "@/lib/user-facing-error";
import type { FiscalEventDto } from "@/lib/fiscal-types";

export type FiscalXmlActionsVariant = "list" | "toolbar";

type XmlLinkPairProps = {
  label: string;
  hrefs: FiscalXmlHref;
  compact: boolean;
};

/** Par ver/baixar reutilizável para qualquer documento fiscal XML. */
export function XmlLinkPair({ label, hrefs, compact }: XmlLinkPairProps) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        const message = toUserFacingError(e instanceof Error ? e.message : undefined, {
          fallback: "Não foi possível acessar o XML. Tente novamente.",
        });
        toast.error(message);
      }
    });
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center justify-end gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-8 text-right shrink-0">
            {label}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={pending}
            title={`Ver XML ${label}`}
            onClick={() => run(() => openXmlFromApi(hrefs.viewPath))}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="sr-only">Ver XML {label}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={pending}
            title={`Baixar XML ${label}`}
            onClick={() => run(() => downloadFromApi(hrefs.downloadPath, `${label}.xml`))}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="sr-only">Baixar XML {label}</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider min-w-[4.5rem]">{label}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => openXmlFromApi(hrefs.viewPath))}
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Ver
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => downloadFromApi(hrefs.downloadPath, `${label}.xml`))}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Baixar
        </Button>
      </div>
    </div>
  );
}

type FiscalXmlDocActionsProps = {
  label: string;
  hrefs: FiscalXmlHref;
  variant?: FiscalXmlActionsVariant;
};

/** Ações genéricas ver/baixar para um único documento XML. */
export function FiscalXmlDocActions({ label, hrefs, variant = "list" }: FiscalXmlDocActionsProps) {
  const compact = variant === "list";
  const content = <XmlLinkPair label={label} hrefs={hrefs} compact={compact} />;

  if (variant === "toolbar") {
    return <div className="flex flex-col gap-2">{content}</div>;
  }

  return <div className="flex flex-col gap-0.5 min-w-[7rem]">{content}</div>;
}

type NfeXmlActionsProps = {
  chave: string;
  status: string;
  cancelamentoEvent?: FiscalEventDto | null;
  variant?: FiscalXmlActionsVariant;
};

export function NfeXmlActions({
  chave,
  status,
  cancelamentoEvent,
  variant = "list",
}: NfeXmlActionsProps) {
  const nfe = fiscalXmlHref("nfe", chave);
  const evento = fiscalXmlHref("nfe-evento", chave);
  const showCancelamento =
    status === "CANCELADA" && (cancelamentoEvent?.tipo === "110111" || !cancelamentoEvent);
  const compact = variant === "list";

  if (variant === "toolbar") {
    return (
      <div className="flex flex-col gap-2">
        <XmlLinkPair label="NF-e" hrefs={nfe} compact={false} />
        {showCancelamento && <XmlLinkPair label="Cancel." hrefs={evento} compact={false} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-[7rem]">
      <XmlLinkPair label="NF-e" hrefs={nfe} compact={compact} />
      {showCancelamento && <XmlLinkPair label="Evt" hrefs={evento} compact={compact} />}
    </div>
  );
}

type CteXmlActionsProps = {
  chave: string;
  variant?: FiscalXmlActionsVariant;
};

export function CteXmlActions({ chave, variant = "toolbar" }: CteXmlActionsProps) {
  return <FiscalXmlDocActions label="CT-e" hrefs={fiscalXmlHref("cte", chave)} variant={variant} />;
}

type NfeInutXmlActionsProps = {
  inutId: string;
  variant?: FiscalXmlActionsVariant;
};

export function NfeInutXmlActions({ inutId, variant = "list" }: NfeInutXmlActionsProps) {
  return (
    <FiscalXmlDocActions
      label="Inut"
      hrefs={fiscalXmlHref("inutilizacao", inutId)}
      variant={variant}
    />
  );
}

type FiscalEventXmlActionsProps = {
  event: FiscalEventDto;
  variant?: FiscalXmlActionsVariant;
};

export function FiscalEventXmlActions({ event, variant = "list" }: FiscalEventXmlActionsProps) {
  const hrefs = fiscalEventXmlHref(event);
  if (!hrefs) return <span className="text-muted-foreground/50 text-[12px]">—</span>;

  const label = event.tipo === "INUT" ? "Inut" : "Evt";
  return <FiscalXmlDocActions label={label} hrefs={hrefs} variant={variant} />;
}

export { fiscalEventHasXml };
