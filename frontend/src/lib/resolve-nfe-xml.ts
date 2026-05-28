import { getEmitente, getFiscalEmitterSettings, getNfeByChave, listProducts } from "./fiscal-api";
import { buildNFeXML } from "./xml-generator";

export async function resolveNfeXml(chave: string): Promise<{ xml: string; filename: string } | null> {
  const nfe = await getNfeByChave(chave);
  if (!nfe) return null;

  const [emit, fiscalCfg, produtos] = await Promise.all([
    getEmitente(nfe.tenantId),
    getFiscalEmitterSettings(nfe.tenantId),
    listProducts(nfe.tenantId),
  ]);

  let product = nfe.productId ? produtos.find((p) => p.id === nfe.productId) : undefined;
  if (!product) {
    product = produtos.find((p) => p.ncm === nfe.ncm) ?? produtos[0];
  }

  const xml = buildNFeXML(nfe, emit, product, fiscalCfg?.settings ?? null);
  const filename = `nfe_${nfe.numero}_serie${nfe.serie}_v4.00.xml`;
  return { xml, filename };
}
