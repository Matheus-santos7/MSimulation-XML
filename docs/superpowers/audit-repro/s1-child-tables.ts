/** S-1: `pedido_itens` e `nfe_remessa_consumos` sem tenant_id/RLS — o papel app no tenant A vê linhas de B. */
import { runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { makePrisma, seedTenants } from "./harness/db.js";
import { ownerDb, seedNfe, seedNfeItem, seedPedido, seedProduct } from "./harness/fixtures.js";

const [a, b] = await seedTenants(2);
const ids: Record<string, { itens: string[]; consumos: string[] }> = {};
for (const t of [a!, b!]) {
  const p = await seedProduct(t.tenantId);
  const pedido = await seedPedido(t.tenantId, [p.id]);
  const remessa = await seedNfe(t.tenantId, { productId: p.id, tipo: "REMESSA", saldo: 10 });
  const item = await seedNfeItem(t.tenantId, remessa.id, p.id, 10, 10);
  const retorno = await seedNfe(t.tenantId, { productId: p.id, tipo: "RETORNO_SIMBOLICO", referenciaId: remessa.id });
  const consumo = await ownerDb().nfeRemessaConsumo.create({
    data: { retornoNfeId: retorno.id, remessaNfeId: remessa.id, nfeItemId: item.id, quantidade: 1 } as never,
  });
  const itens = await ownerDb().pedidoItem.findMany({ where: { pedidoId: pedido.id }, select: { id: true } });
  ids[t.tenantId] = { itens: itens.map((i) => i.id), consumos: [consumo.id] };
}

const app = makePrisma("app");
const seen = await runWithDbContext(app, { tenantId: a!.tenantId }, async (tx) => ({
  itens: (await tx.pedidoItem.findMany({ select: { id: true } })).map((r) => r.id),
  consumos: (await tx.nfeRemessaConsumo.findMany({ select: { id: true } })).map((r) => r.id),
  pedidosB: await tx.pedido.count({ where: { tenantId: b!.tenantId } }),
}));
await app.$disconnect();

const leakItens = ids[b!.tenantId]!.itens.filter((id) => seen.itens.includes(id)).length;
const leakCons = ids[b!.tenantId]!.consumos.filter((id) => seen.consumos.includes(id)).length;
console.log(`tenant A (papel app) vê pedido_itens de B: ${leakItens}; nfe_remessa_consumos de B: ${leakCons}; pedidos de B (tabela com RLS): ${seen.pedidosB}`);
console.log(`VEREDITO: ${leakItens > 0 && leakCons > 0 && seen.pedidosB === 0 ? "Confirmado" : "Refutado"}`);
await ownerDb().$disconnect();
