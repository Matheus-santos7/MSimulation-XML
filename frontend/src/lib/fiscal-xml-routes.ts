import type { FiscalEventDto } from "./fiscal-types";

export type FiscalXmlDocKind = "nfe" | "nfe-evento" | "cte" | "inutilizacao";

export type FiscalXmlHref = {
  viewPath: string;
  downloadPath: string;
};

function withDownload(base: string): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}download=1`;
}

/** Caminhos da API backend para visualização e download de XML fiscal. */
export function fiscalXmlHref(kind: FiscalXmlDocKind, id: string): FiscalXmlHref {
  switch (kind) {
    case "nfe":
      return {
        viewPath: `/api/nfes/${id}/xml`,
        downloadPath: withDownload(`/api/nfes/${id}/xml`),
      };
    case "nfe-evento":
      return {
        viewPath: `/api/nfes/${id}/xml?doc=evento`,
        downloadPath: withDownload(`/api/nfes/${id}/xml?doc=evento`),
      };
    case "cte":
      return {
        viewPath: `/api/ctes/${id}/xml`,
        downloadPath: withDownload(`/api/ctes/${id}/xml`),
      };
    case "inutilizacao":
      return {
        viewPath: `/api/fiscal-events/${id}/xml`,
        downloadPath: withDownload(`/api/fiscal-events/${id}/xml`),
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
