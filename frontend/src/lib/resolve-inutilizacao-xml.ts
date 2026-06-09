import { fiscalXmlDownloadFilename } from "@msimulation-xml/fiscal-core";
import { getEmitente, listFiscalEvents } from "./fiscal-api";
import { buildProcInutNFeXML, infInutId } from "./inutilizacao-xml";
import { ufToCodigo } from "./nfe-uf";

export async function resolveInutilizacaoXml(
  id: string,
): Promise<{ xml: string; filename: string } | null> {
  const events = await listFiscalEvents();
  const inut = events.find((e) => e.id === id && e.tipo === "INUT");
  if (!inut || inut.serie == null || inut.numeroIni == null) return null;

  const emit = await getEmitente();
  const xml = buildProcInutNFeXML(emit, inut);
  const serie = inut.serie ?? 1;
  const nNFIni = inut.numeroIni ?? 1;
  const nNFFin = inut.numeroFim ?? nNFIni;
  const cUF = String(ufToCodigo(emit.uf)).padStart(2, "0");
  const ano = String(new Date(inut.ocorridoEm).getFullYear()).slice(-2);
  const cnpj = emit.cnpj.replace(/\D/g, "");
  const chave = infInutId(cUF, ano, cnpj, serie, nNFIni, nNFFin);
  const filename = fiscalXmlDownloadFilename("Inut", chave);
  return { xml, filename };
}
