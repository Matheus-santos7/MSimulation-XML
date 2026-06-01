import { getEmitente, listFiscalEvents } from "./fiscal-api";
import { buildProcInutNFeXML } from "./inutilizacao-xml";

export async function resolveInutilizacaoXml(
  id: string,
): Promise<{ xml: string; filename: string } | null> {
  const events = await listFiscalEvents();
  const inut = events.find((e) => e.id === id && e.tipo === "INUT");
  if (!inut || inut.serie == null || inut.numeroIni == null) return null;

  const emit = await getEmitente();
  const xml = buildProcInutNFeXML(emit, inut);
  const nFim = inut.numeroFim ?? inut.numeroIni;
  const filename = `${inut.serie}-${inut.numeroIni}${nFim !== inut.numeroIni ? `-${nFim}` : ""}-inutNFe.xml`;
  return { xml, filename };
}
