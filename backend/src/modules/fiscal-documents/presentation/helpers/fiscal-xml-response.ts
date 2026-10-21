import { prepareFiscalXmlForDownload } from "@msimulation-xml/fiscal-core";
import type { FastifyReply } from "fastify";
import { sendFile } from "../../../../nest/http/file-download.js";

const XML_CONTENT_TYPE = "application/xml; charset=utf-8";
const XML_CACHE_CONTROL = "private, max-age=3600";

export type FiscalXmlResponse = {
  xml: string;
  filename: string;
  /** `?download=1`: prepara o XML para download e envia como anexo. */
  download: boolean;
  /** Ex.: `{ "X-NFe-Xml-Source": "db" }`. */
  headers?: Record<string, string>;
};

/** Resposta de XML fiscal (NF-e, CT-e, inutilização) com cache privado de 1 h. */
export function sendFiscalXml(reply: FastifyReply, response: FiscalXmlResponse): FastifyReply {
  return sendFile(reply, {
    content: response.download ? prepareFiscalXmlForDownload(response.xml) : response.xml,
    contentType: XML_CONTENT_TYPE,
    fileName: response.download ? response.filename : undefined,
    headers: { "Cache-Control": XML_CACHE_CONTROL, ...response.headers },
  });
}

/** `?download=1` liga o download; qualquer outro valor devolve o XML para visualização. */
export function isDownloadRequested(query: { download?: string } | undefined): boolean {
  return query?.download === "1";
}
