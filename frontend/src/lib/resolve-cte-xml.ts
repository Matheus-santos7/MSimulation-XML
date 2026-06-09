import { fiscalXmlDownloadFilename } from "@msimulation-xml/fiscal-core";
import { buildCTeXML } from "./cte-xml-generator";
import { getCteByChave, getTenant } from "./fiscal-api";

export async function resolveCteXml(chave: string): Promise<{ xml: string; filename: string } | null> {
  const cte = await getCteByChave(chave);
  if (!cte) return null;

  const tenant = await getTenant(cte.tenantId);
  if (!tenant) return null;

  const xml = buildCTeXML(cte, tenant);
  const filename = fiscalXmlDownloadFilename("CTe", chave);
  return { xml, filename };
}
