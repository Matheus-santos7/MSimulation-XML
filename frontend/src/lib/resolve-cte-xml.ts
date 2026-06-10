/**
 * XML de CT-e para preview/download.
 *
 * 1. Tenta `GET /api/ctes/:chave/xml` (XML persistido ou regerado no backend).
 * 2. Se indisponível, regera localmente via `@msimulation-xml/fiscal-core` (legado).
 */
import { fiscalXmlDownloadFilename } from "@msimulation-xml/fiscal-core";
import { buildCTeXML } from "./cte-xml-generator";
import { getCteByChave, getCteXml, getTenant } from "./fiscal-api";

export async function resolveCteXml(chave: string): Promise<{ xml: string; filename: string } | null> {
  const fromApi = await getCteXml(chave);
  if (fromApi) return fromApi;

  const cte = await getCteByChave(chave);
  if (!cte) return null;

  const tenant = await getTenant(cte.tenantId);
  if (!tenant) return null;

  const xml = buildCTeXML(cte, tenant);
  const filename = fiscalXmlDownloadFilename("CTe", chave);
  return { xml, filename };
}
