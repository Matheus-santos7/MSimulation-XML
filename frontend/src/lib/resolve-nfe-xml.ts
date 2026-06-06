/**
 * XML de NF-e para preview/download.
 *
 * 1. Tenta `GET /api/nfes/:chave/xml` (XML persistido ou regerado no backend).
 * 2. Se indisponível (404), regera localmente via `@msimulation-xml/nfe-xml` (legado).
 */
import { buildNFeXML, buildProcEventoCancelamentoXML, nfeProcXmlFilename } from "@msimulation-xml/nfe-xml";
import {
  getEmitente,
  getFiscalEmitterSettings,
  getNfeByChave,
  getNfeXml,
  listFiscalEvents,
  listProducts,
} from "./fiscal-api";

async function loadNfeXmlContext(chave: string) {
  const nfe = await getNfeByChave(chave);
  if (!nfe) return null;

  const [emit, fiscalCfg, produtos] = await Promise.all([
    getEmitente(),
    getFiscalEmitterSettings(),
    listProducts(),
  ]);

  let product = nfe.productId ? produtos.find((p) => p.id === nfe.productId) : undefined;
  if (!product) {
    product = produtos.find((p) => p.ncm === nfe.ncm) ?? produtos[0];
  }

  return { nfe, emit, product, settings: fiscalCfg?.settings ?? null };
}

export async function resolveNfeXml(chave: string): Promise<{ xml: string; filename: string } | null> {
  const fromApi = await getNfeXml(chave);
  if (fromApi) return fromApi;

  const ctx = await loadNfeXmlContext(chave);
  if (!ctx) return null;

  const xml = buildNFeXML(ctx.nfe, ctx.emit, ctx.product, ctx.settings);
  const filename = nfeProcXmlFilename(ctx.nfe.numero, ctx.nfe.serie);
  return { xml, filename };
}

export async function resolveNfeCancelamentoEventoXml(
  chave: string,
): Promise<{ xml: string; filename: string } | null> {
  const ctx = await loadNfeXmlContext(chave);
  if (!ctx) return null;

  const events = await listFiscalEvents();
  const cancelamento = events.find((e) => e.tipo === "110111" && e.chaveRef === chave);
  if (!cancelamento) {
    if (ctx.nfe.status !== "CANCELADA") return null;
    const fallback = {
      protocolo: `141260056230${String(ctx.nfe.numero).padStart(3, "0")}`.slice(0, 15),
      ocorridoEm: new Date().toISOString(),
      xJust: "Cancelamento solicitado pelo emissor",
    };
    const xml = buildProcEventoCancelamentoXML(ctx.nfe, ctx.emit, fallback);
    const filename = `${ctx.nfe.numero}_serie${ctx.nfe.serie}_${chave.slice(-8)}-110111-procEventoNFe.xml`;
    return { xml, filename };
  }

  const xml = buildProcEventoCancelamentoXML(ctx.nfe, ctx.emit, cancelamento);
  const filename = `${ctx.nfe.numero}_serie${ctx.nfe.serie}_${chave.slice(-8)}-110111-procEventoNFe.xml`;
  return { xml, filename };
}
