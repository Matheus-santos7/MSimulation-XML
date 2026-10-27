---
paths:
  - "**/workers/**/*.ts"
  - "**/config/queues.ts"
---

# Filas

O backend ainda não tem fila nem Redis. Use BullMQ só quando um processamento não couber na request (emissão em lote, reprocessamento fiscal) e registre a decisão antes. As regras abaixo valem a partir daí.

- Arquivo do worker: `modules/workers/<fila>.processor.ts`, classe `<Feature><Ação>Worker`.

- Nomes em `src/config/queues.ts`: `export const QUEUES = { INTEGRATE_INVOICE: "integrate-invoice" }`. Valor kebab-case.
- `WorkersModule` configura `BullModule.forRootAsync` com `redisHost`, `redisPort`, `redisPassword` do `ConfigService`, e `BullModule.registerQueue`.
- Worker: `@Injectable()`, `@Processor(QUEUES.X, { concurrency: 1 })`, estende `WorkerHost`.
- `process(job)` loga início e fim com `Logger` e chama `useCase.execute(job.data)` dentro de `runWithDbContext(prisma, { tenantId: job.data.tenantId }, ...)`, senão a RLS não devolve linhas. Sem Prisma direto no worker.
- Payload do job é interface em `workers/types.ts`, incluindo `tenantId` quando o processamento é por conta.
