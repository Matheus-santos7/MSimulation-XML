/**
 * CAT-1: try/catch por linha dentro de uma transação única. A linha 2 passa no Zod
 * (preco positivo, sem teto) mas estoura Decimal(15,8) no banco; as linhas 3 a 5 são válidas.
 */
import { runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { BulkUpsertProductsUseCase } from "../../../backend/src/modules/catalog/product-import/use-cases/bulk-upsert-products.usecase.js";
import { ProductRepository } from "../../../backend/src/modules/catalog/product/product.repository.js";
import { TaxRuleRepository } from "../../../backend/src/modules/tax/tax-rule/tax-rule.repository.js";
import { TaxRuleService } from "../../../backend/src/modules/tax/tax-rule/tax-rule.service.js";
import { makePrisma, seedTenants } from "./harness/db.js";
import { ownerDb } from "./harness/fixtures.js";

const [t] = await seedTenants(1);
const tenantId = t!.tenantId;
const app = makePrisma("app");
const uc = new BulkUpsertProductsUseCase(new ProductRepository(), new TaxRuleService(new TaxRuleRepository(), app));
const row = (line: number, preco: number) => ({
  line, sku: `CAT1-${line}`, nome: `Produto ${line}`, ncm: "61091000", origem: 0, unidade: "UN", preco, precoCusto: 5, estoque: 1,
});

let outcome: string;
try {
  const r = await runWithDbContext(app, { tenantId }, () =>
    uc.execute({ tenantId, rows: [row(1, 10), row(2, 1e12), row(3, 10), row(4, 10), row(5, 10)] }),
  );
  outcome = `resposta: created=${r.created}, failed=${r.failed.map((f) => `${f.line}:${f.error.slice(0, 70)}`).join(" | ")}`;
} catch (e) {
  outcome = `a transação falhou no commit: ${(e as Error).message.slice(0, 120)}`;
}
const gravados = await ownerDb().product.findMany({ where: { tenantId }, select: { sku: true } });
console.log(outcome);
console.log(`gravados no banco: ${gravados.length} (${gravados.map((g) => g.sku).join(", ")})`);
const linhas35 = gravados.filter((g) => ["CAT1-3", "CAT1-4", "CAT1-5"].includes(g.sku)).length;
console.log(`VEREDITO: ${linhas35 === 0 ? "Confirmado (linhas 3 a 5 válidas não foram gravadas)" : "Refutado"}`);
await app.$disconnect();
await ownerDb().$disconnect();
