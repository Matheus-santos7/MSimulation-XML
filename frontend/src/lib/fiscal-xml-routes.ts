import type { FiscalEventDto } from "./fiscal-types";

export type FiscalXmlDocKind = "nfe" | "nfe-evento" | "cte" | "inutilizacao";

export type FiscalXmlHref = {
  view: string;
  download: string;
};

function withDownload(base: string, download: boolean): string {
  if (!download) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}download=1`;
}

/** Monta URLs de visualização e download para documentos fiscais XML. */
export function fiscalXmlHref(kind: FiscalXmlDocKind, id: string): FiscalXmlHref {
  switch (kind) {
    case "nfe":
      return {
        view: `/nfe/${id}/xml`,
        download: withDownload(`/nfe/${id}/xml`, true),
      };
    case "nfe-evento":
      return {
        view: `/nfe/${id}/xml?doc=evento`,
        download: withDownload(`/nfe/${id}/xml?doc=evento`, true),
      };
    case "cte":
      return {
        view: `/cte/${id}/xml`,
        download: withDownload(`/cte/${id}/xml`, true),
      };
    case "inutilizacao":
      return {
        view: `/nfe/inutilizacao/${id}/xml`,
        download: withDownload(`/nfe/inutilizacao/${id}/xml`, true),
      };
  }
}

/** Eventos com XML disponível: cancelamento (110111) e inutilização (INUT). */
export function fiscalEventXmlHref(
  event: Pick<FiscalEventDto, "id" | "tipo" | "chaveRef">,
): FiscalXmlHref | null {
  if (event.tipo === "INUT") return fiscalXmlHref("inutilizacao", event.id);
  if (event.tipo === "110111" && event.chaveRef) {
    return fiscalXmlHref("nfe-evento", event.chaveRef);
  }
  return null;
}

export function fiscalEventHasXml(event: Pick<FiscalEventDto, "tipo" | "chaveRef">): boolean {
  if (event.tipo === "INUT") return true;
  return event.tipo === "110111" && Boolean(event.chaveRef);
}
