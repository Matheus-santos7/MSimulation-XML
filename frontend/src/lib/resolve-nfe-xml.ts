import {
  getEmitente,
  getFiscalEmitterSettings,
  getNfeByChave,
  listFiscalEvents,
  listProducts,
} from "./fiscal-api";
import { buildNFeXML, buildProcEventoCancelamentoXML } from "./xml-generator";

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
  const ctx = await loadNfeXmlContext(chave);
  if (!ctx) return null;

  const xml = buildNFeXML(ctx.nfe, ctx.emit, ctx.product, ctx.settings);
  const filename = `nfe_${ctx.nfe.numero}_serie${ctx.nfe.serie}_v4.00.xml`;
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
    // Fallback para notas canceladas antes da persistência do evento
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
