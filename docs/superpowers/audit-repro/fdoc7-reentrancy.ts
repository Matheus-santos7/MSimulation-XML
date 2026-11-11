/**
 * FDOC-7: devolução de venda (a), retorno físico (b) e conferência (c) checam antes de emitir,
 * sem lock. 5 chamadas simultâneas por cenário, 5 rodadas.
 */
import { runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { SaleReturnUseCase } from "../../../backend/src/modules/fiscal-documents/document-return/use-cases/sale-return.usecase.js";
import { PhysicalReturnUseCase } from "../../../backend/src/modules/fiscal-documents/document-return/use-cases/physical-return.usecase.js";
import { InboundConferenceUseCase } from "../../../backend/src/modules/fiscal-documents/inbound-conference/use-cases/inbound-conference.usecase.js";
import { makePrisma, seedTenants } from "./harness/db.js";
import { ownerDb, seedNfe, seedNfeItem, seedProduct } from "./harness/fixtures.js";

const CALLS = 5;
const app = makePrisma("app");
const only = process.argv[2];

type Scenario = {
  name: string;
  setup: (tenantId: string) => Promise<{ run: () => Promise<unknown>; measure: () => Promise<{ bad: boolean; info: string }> }>;
};

const scenarios: Scenario[] = [
  {
    name: "a) devolução total da mesma venda",
    async setup(tenantId) {
      const p = await seedProduct(tenantId);
      const venda = await seedNfe(tenantId, { productId: p.id, tipo: "VENDA", quantidade: 2 });
      const uc = new SaleReturnUseCase();
      return {
        run: () => uc.execute({ tenantId, saleNfeKey: venda.chave } as never),
        measure: async () => {
          const devs = await ownerDb().nFe.findMany({ where: { nfeReferenciaId: venda.id, tipo: "DEVOLUCAO" }, select: { quantidade: true } });
          const total = devs.reduce((s, d) => s + d.quantidade, 0);
          return { bad: total > 2, info: `devoluções=${devs.length}, quantidade devolvida=${total} de 2 vendidas` };
        },
      };
    },
  },
  {
    name: "b) retorno físico da mesma remessa",
    async setup(tenantId) {
      const p = await seedProduct(tenantId);
      const remessa = await seedNfe(tenantId, { productId: p.id, tipo: "REMESSA", quantidade: 10, saldo: 10 });
      await seedNfeItem(tenantId, remessa.id, p.id, 10, 10);
      const uc = new PhysicalReturnUseCase();
      return {
        run: () => uc.execute({ tenantId, remessaNfeKey: remessa.chave } as never),
        measure: async () => {
          const n = await ownerDb().nFe.count({ where: { nfeReferenciaId: remessa.id, tipo: "RETORNO_FISICO" } });
          return { bad: n > 1, info: `retornos físicos=${n}` };
        },
      };
    },
  },
  {
    name: "c) conferência da mesma remessa (recebido 7 de 10)",
    async setup(tenantId) {
      const p = await seedProduct(tenantId);
      const remessa = await seedNfe(tenantId, { productId: p.id, tipo: "REMESSA", quantidade: 10, saldo: 10 });
      await seedNfeItem(tenantId, remessa.id, p.id, 10, 10);
      const uc = new InboundConferenceUseCase();
      return {
        run: () => uc.execute({ tenantId, remessaNfeKey: remessa.chave, receivedQty: 7 } as never),
        measure: async () => {
          const n = await ownerDb().nFe.count({ where: { nfeReferenciaId: remessa.id } });
          return { bad: n > 1, info: `notas de diferença=${n}` };
        },
      };
    },
  },
];

for (const sc of scenarios) {
  if (only && !sc.name.startsWith(only)) continue;
  let confirmed = 0;
  let errors = new Set<string>();
  for (let round = 1; round <= 5; round++) {
    const [t] = await seedTenants(1);
    const { run, measure } = await sc.setup(t!.tenantId);
    const results = await Promise.allSettled(Array.from({ length: CALLS }, () => runWithDbContext(app, { tenantId: t!.tenantId }, run)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    for (const r of results) if (r.status === "rejected") errors.add(String((r.reason as Error)?.message).slice(0, 90));
    const m = await measure();
    if (m.bad) confirmed++;
    console.log(`[${sc.name}] rodada ${round}: aceitos=${ok}/${CALLS}, ${m.info}${m.bad ? " ← reentrante" : ""}`);
  }
  if (errors.size) console.log(`  erros: ${[...errors].join(" | ")}`);
  console.log(`VEREDITO [${sc.name}]: ${confirmed > 0 ? `Confirmado (${confirmed}/5)` : "Refutado (5/5 limpas)"}`);
}
await app.$disconnect();
await ownerDb().$disconnect();
