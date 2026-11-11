# Verificação da auditoria do backend: plano de micro-tarefas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar cada achado "(verificar)" e cada área não lida de `docs/code-review-backend-2026-11-11.md` em um veredito com evidência (Confirmado, Refutado ou Inconclusivo), uma tarefa isolada por achado.

**Architecture:** Um Postgres descartável em Docker (Tarefa 0) serve às tarefas de concorrência e RLS; as demais são scripts puros, leituras guiadas por checklist ou pedidos de fato ao usuário. Cada tarefa grava o veredito no próprio achado do documento da auditoria; a Tarefa 20 só consolida contagens. Nenhuma tarefa altera código de produção.

**Tech Stack:** Docker (Postgres 16 descartável), `tsx`, Vitest (só onde um spec descartável já é o jeito mais curto), Prisma 7 com `@prisma/adapter-pg`, Python 3.12 em venv, Graphify (`mcp__graphify`).

**Spec:** `docs/code-review-backend-2026-11-11.md` (seções 3 a 8). Os identificadores (S-2, REM-1, FDOC-7...) são os dessa auditoria.

## Global Constraints

- Nunca ler, imprimir ou commitar `.env*`, tokens ou strings de conexão. O banco das tarefas é **só** o Postgres local da Tarefa 0 (`postgresql://audit:audit@127.0.0.1:55432/audit`).
- Nunca rodar `db:migrate:deploy` nem qualquer comando contra a `DATABASE_URL` de produção. Onde um fato de produção é necessário (S-2, INF-1), a tarefa entrega uma consulta e o usuário roda e cola o resultado.
- Não alterar nada em `backend/src`, `frontend/src`, `packages/*/src` e `infra/`. Scripts de reprodução ficam em `docs/superpowers/audit-repro/` e não entram no build, no lint nem no `pnpm test:backend`.
- Documentação e commits em português, formato `<tipo>: <descrição>`, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Cada tarefa faz um commit `docs: ...`.
- Veredito é uma de três palavras: **Confirmado**, **Refutado**, **Inconclusivo**. Refutar também é resultado: corrija o texto do achado e a contagem, não apague o histórico.
- Formato do veredito, uma linha logo abaixo do título do achado: `> **Verificação 2026-11-11:** <veredito>. Evidência: <script ou arquivo:linha>. <1 frase com o que foi observado>.`
- Código de teste de concorrência reproduz o caminho HTTP: dentro de `runWithDbContext` (a transação única do `DbContextInterceptor`), não com o cliente raiz.

## Review Focus

- **Corrida que não dispara em 2 chamadas.** Uma reprodução com 2 requisições simultâneas pode passar por sorte. Cada script de corrida roda 20 chamadas em paralelo e repete 5 vezes; "Refutado" exige as 5 rodadas limpas.
- **Papel do banco com `BYPASSRLS` ou dono das tabelas.** Se o harness conectar como superusuário, a RLS some e os testes de S-1 e S-2 dão falso negativo. O papel `audit_app` precisa de `NOBYPASSRLS` e não pode ser dono das tabelas.
- **Teste que não passa pelo caminho real.** Chamar o repository com o cliente raiz esconde o efeito da transação do interceptor (FVAL-1, SAL-1). Sempre usar `runWithDbContext`.
- **Entrada hostil de texto.** XML com `$'`, caracteres de controle e entidades aninhadas (PKG-2, PKG-3, INF-3) deve ter caso próprio, não só texto comum.
- **Veredito sem evidência reproduzível.** Todo veredito cita o script e a saída; leitura sem execução só vale "Inconclusivo".

---

### Task 0: Harness de Postgres descartável

**Files:**
- Create: `docs/superpowers/audit-repro/README.md`
- Create: `docs/superpowers/audit-repro/harness/up.sh`, `down.sh`
- Create: `docs/superpowers/audit-repro/harness/db.ts`

**Interfaces:**
- Produces: `up.sh` sobe o contêiner `audit-pg` na porta 55432, aplica todas as migrations de `backend/prisma/migrations` e cria o papel `audit_app` (`NOBYPASSRLS`, sem ser dono). `db.ts` exporta `makePrisma(role: "owner" | "app"): PrismaClient` e `seedTenants(n: number): Promise<{ tenantId: string }[]>`.
- Consumes: padrão de `backend/scripts/verify-marketplaces-migration.sh` (ler antes).

- [ ] **Step 1: Ler `backend/scripts/verify-marketplaces-migration.sh` e copiar só a forma de subir Postgres e aplicar migrations.**
- [ ] **Step 2: Escrever `up.sh`/`down.sh`.** `docker run` de `postgres:16`, `prisma migrate deploy` apontando para `127.0.0.1:55432`, depois `CREATE ROLE audit_app LOGIN NOBYPASSRLS` com `GRANT` de DML nas tabelas. O script aborta se a URL não contiver `127.0.0.1:55432`.
- [ ] **Step 3: Escrever `db.ts`** com as duas funções acima; `seedTenants` cria `n` tenants com CNPJs distintos.
- [ ] **Step 4: Verificar.** Run: `bash docs/superpowers/audit-repro/harness/up.sh && docker exec audit-pg psql -U audit -c "select rolname,rolbypassrls from pg_roles where rolname='audit_app'"`. Expected: uma linha com `rolbypassrls = f`.
- [ ] **Step 5: Commit** `docs: harness de postgres descartável para verificar a auditoria`.

### Task 1: S-2 papel do banco e RLS

**Files:** Create `docs/superpowers/audit-repro/s2-rls-role.ts`; Modify `docs/code-review-backend-2026-11-11.md` (achado S-2).

**Interfaces:** Consumes `makePrisma`, `seedTenants` da Tarefa 0.

- [ ] **Step 1: Escrever `s2-rls-role.ts`.** Cria 2 tenants, 1 produto em cada; lê `products` com `makePrisma("app")` dentro de `runWithDbContext` do tenant A e afirma que só o produto de A volta; repete com `makePrisma("owner")` e registra quantos voltam.
- [ ] **Step 2: Rodar.** Run: `pnpm --filter @msimulation-xml/backend exec tsx ../docs/superpowers/audit-repro/s2-rls-role.ts`. Expected: `app` vê 1 linha; `owner` vê 2 (prova que a RLS depende do papel).
- [ ] **Step 3: Gerar a consulta de produção para o usuário** (somente leitura) e colar no achado: `select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user;` e `select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('products','pedido_itens','nfe_remessa_consumos');`. Pedir ao usuário que rode e cole a saída; sem a saída, o veredito de S-2 é **Inconclusivo**.
- [ ] **Step 4: Gravar o veredito** em S-2 e commit `docs: verificação do S-2`.

### Task 2: S-1 tabelas filhas sem RLS

**Files:** Create `.../s1-child-tables.ts`; Modify achado S-1.

- [ ] **Step 1: Escrever o script.** Com o papel `app` no tenant A, `select count(*) from pedido_itens` e `from nfe_remessa_consumos` depois de semear linhas dos tenants A e B. Afirma que a contagem inclui linhas de B.
- [ ] **Step 2: Rodar** como na Tarefa 1. Expected: contagem = total dos dois tenants (RLS ausente).
- [ ] **Step 3: Veredito e commit** `docs: verificação do S-1`.

### Task 3: REM-1 *lost update* no saldo FIFO

**Files:** Create `.../rem1-fifo-lost-update.ts`; Modify achado REM-1.

**Interfaces:** Consumes `debitRemessaFifoItems` de `backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.ts` (conferir a assinatura lendo o arquivo).

- [ ] **Step 1: Escrever o script.** Semeia uma remessa com `saldoDisponivel = 10`; dispara 20 débitos de 1 unidade em paralelo, cada um em seu `runWithDbContext`. Afirma `saldoFinal === 10 - débitos aplicados`.
- [ ] **Step 2: Rodar 5 vezes.** Expected (Confirmado): ao menos uma rodada com `saldoFinal` maior que `10 - 20` esperado ou com mais consumos registrados do que o saldo baixado.
- [ ] **Step 3: Conferir a ausência de `CHECK`** com `select conname from pg_constraint where conrelid='nfe_itens'::regclass and contype='c'`. Registrar a saída.
- [ ] **Step 4: Veredito e commit** `docs: verificação do REM-1`.

### Task 4: SAL-1 faturamento duplicado

**Files:** Create `.../sal1-double-invoice.ts`; Modify achados SAL-1 e SAL-2.

**Interfaces:** Consumes `OrderInvoiceUseCase.execute` (ler a assinatura em `backend/src/modules/sales/invoicing/`).

- [ ] **Step 1: Escrever o script.** Pedido em rascunho válido, 5 chamadas simultâneas de `execute`. Conta NF-e de tipo `VENDA` ligadas ao pedido.
- [ ] **Step 2: Rodar 5 vezes.** Expected (Confirmado): alguma rodada com mais de 1 NF-e de venda para o pedido.
- [ ] **Step 3: Veredito (SAL-1 e SAL-2) e commit** `docs: verificação do SAL-1`.

### Task 5: FDOC-1 cancelamento reentrante

**Files:** Create `.../fdoc1-double-cancel.ts`; Modify achado FDOC-1.

- [ ] **Step 1: Escrever o script.** NF-e `AUTORIZADA` com consumo FIFO; 5 `CancellationUseCase.execute` simultâneos. Conta eventos `CANC` e compara o saldo da remessa antes e depois.
- [ ] **Step 2: Rodar 5 vezes.** Expected (Confirmado): mais de 1 evento ou saldo acima do original.
- [ ] **Step 3: Veredito e commit** `docs: verificação do FDOC-1`.

### Task 6: FDOC-7 devolução, retorno físico e conferência reentrantes

**Files:** Create `.../fdoc7-reentrancy.ts`; Modify achado FDOC-7.

- [ ] **Step 1: Escrever três cenários no mesmo script,** cada um com 5 chamadas simultâneas: (a) `SaleReturnUseCase.execute` total da mesma venda; (b) `PhysicalReturnUseCase.execute` da mesma remessa; (c) `InboundConferenceUseCase.execute` com `receivedQty` divergente.
- [ ] **Step 2: Rodar 5 vezes.** Expected (Confirmado por cenário): (a) soma devolvida maior que a vendida; (b) mais de 1 `RETORNO_FISICO` para a remessa; (c) mais de um par de notas de diferença.
- [ ] **Step 3: Veredito por letra (a, b, c) e commit** `docs: verificação do FDOC-7`.

### Task 7: CAT-1 transação abortada no bulk-upsert

**Files:** Create `.../cat1-bulk-upsert-abort.ts`; Modify achado CAT-1.

**Interfaces:** Consumes `BulkUpsertProductsUseCase.execute` (`backend/src/modules/catalog/product-import/use-cases/bulk-upsert-products.usecase.ts`).

- [ ] **Step 1: Escrever o script.** Lote de 5 produtos em que o 2º estoura um `VarChar` (ex.: `sku` com 500 caracteres) e os outros 4 são válidos.
- [ ] **Step 2: Rodar.** Expected (Confirmado): as linhas 3 a 5 falham com `25P01`/"current transaction is aborted" e nenhuma é gravada. Refutado se só a linha 2 falha e as demais gravam.
- [ ] **Step 3: Veredito e commit** `docs: verificação do CAT-1`.

### Task 8: FVAL-1 gatilho pós-commit

**Files:** Create `.../fval1-commit-hook.ts`; Modify achado FVAL-1.

- [ ] **Step 1: Escrever o script sem banco** (cliente falso com `$transaction` contado): dentro de `runWithDbContext` (transação existente), chamar `runFiscalTransaction` com `fiscalTransactionCommitHook` registrado, afirmar se o hook foi chamado.
- [ ] **Step 2: Rodar.** Expected (Confirmado): hook chamado 0 vezes no ramo `existingTx`. Repetir com o cliente raiz (sem transação existente) para registrar o contraste e se o `db` recebido ali enxerga linhas com RLS.
- [ ] **Step 3: Veredito e commit** `docs: verificação do FVAL-1`.

### Task 9: AUTH-1 e AUTH-7 corridas de auth

**Files:** Create `.../auth-races.ts`; Modify achados AUTH-1 e AUTH-7.

- [ ] **Step 1: Escrever dois cenários, 10 chamadas simultâneas cada:** (a) `completePasswordReset` com o mesmo token; (b) `AttachTenantOnboardingUseCase.execute` com CNPJs distintos para o mesmo usuário.
- [ ] **Step 2: Rodar 5 vezes.** Expected (Confirmado): (a) mais de uma redefinição bem-sucedida; (b) mais de uma empresa criada para um usuário.
- [ ] **Step 3: Veredito por cenário e commit** `docs: verificação do AUTH-1 e AUTH-7`.

### Task 10: S-4 força bruta de TOTP

**Files:** Create `.../s4-2fa-bruteforce.ts`; Modify achado S-4.

- [ ] **Step 1: Escrever o script com repositórios falsos** (`as unknown as Tipo`): login com senha correta seguido de 50 tentativas de código errado, repetindo o ciclo (login completo, novas tentativas). Registrar quantos códigos errados o fluxo aceita antes de bloquear, e se `clearLoginLockout` zera o contador a cada ciclo.
- [ ] **Step 2: Rodar.** Expected (Confirmado): o total de tentativas erradas por conta passa do limite configurado sem bloqueio. Registrar o limite lido da config.
- [ ] **Step 3: Testar replay:** o mesmo código TOTP válido duas vezes na mesma janela. Registrar se a segunda é aceita.
- [ ] **Step 4: Veredito e commit** `docs: verificação do S-4`.

### Task 11: TAX-2 arredondamento em ponto flutuante

**Files:** Create `.../tax2-round2.ts`; Modify achado TAX-2.

**Interfaces:** Consumes `round2` de `backend/src/modules/tax/tax-calculation/tax-engine.ts`.

- [ ] **Step 1: Escrever o script:** para 1 milhão de valores `n/1000` com `n` de 1 a 1.000.000 terminando em `5` na 3ª casa, comparar `round2(v)` com o arredondamento por meio-para-cima feito com `decimal.js` (já no projeto via Prisma; senão inteiros em milésimos). Contar divergências e listar os 5 primeiros.
- [ ] **Step 2: Rodar.** Expected (Confirmado): contagem > 0, incluindo `10.075`. Registrar o total.
- [ ] **Step 3: Rodar `calcularNotaFiscal` com 3 itens** que usam esses valores e registrar a diferença de `vNF` em centavos.
- [ ] **Step 4: Veredito e commit** `docs: verificação do TAX-2`.

### Task 12: PKG-2 e PKG-3 serialização e assinatura de XML

**Files:** Create `.../pkg-xml.ts`; Modify achados PKG-2 e PKG-3.

**Interfaces:** Consumes `injectSimulationSignature`, `INUT_SIGNATURE_CONFIG`, `verifySimulationXmlSignature`, `serializeXmlObject` de `@msimulation-xml/fiscal-core`.

- [ ] **Step 1: Escrever o script, PKG-2:** montar um `procInutNFe` com `xJust = "Kit $'"` e outro com `"A $& B"`; assinar com `injectSimulationSignature`; afirmar `verifySimulationXmlSignature(xml) === true` e que o XML bem-formado (parse com `@xmldom/xmldom`).
- [ ] **Step 2: PKG-3:** serializar `xProd = "A\u0001B"` com `serializeXmlObject` e tentar parsear. Registrar se o parser recusa.
- [ ] **Step 3: Rodar.** Expected (Confirmado): PKG-2 falha em verificação ou parse; PKG-3 falha em parse.
- [ ] **Step 4: Veredito e commit** `docs: verificação do PKG-2 e PKG-3`.

### Task 13: INF-3 recusa de DOCTYPE no proxy Python

**Files:** Create `.../inf3-doctype.py` e `.../inf3-billion-laughs.xml`; Modify achado INF-3.

- [ ] **Step 1: Criar venv fora do repositório** (`python3 -m venv <scratchpad>/venv-inf3`), `pip install mcp-fiscal-brasil==0.5.1 fastapi httpx pytest`.
- [ ] **Step 2: Escrever o script.** Sobe `infra/fiscal-validator-proxy/main.py` com `TestClient` e envia a `/api/v1/validate-nfe` um XML com DOCTYPE e 5 níveis de entidades aninhadas (pequeno, para não travar a máquina). Registrar tempo de resposta e memória de pico, e se `safe_fromstring` foi acionado antes ou depois do `validate_nfe_full`, instrumentando com um `monkeypatch` que anota a ordem.
- [ ] **Step 3: Rodar.** Expected (Confirmado): `validate_nfe_full` é chamado antes de qualquer `safe_fromstring`. Refutado se a biblioteca recusa o DOCTYPE por conta própria (registrar a mensagem).
- [ ] **Step 4: Veredito e commit** `docs: verificação do INF-3`.

### Task 14: FE-3 caminho do BFF com `..`

**Files:** Create `.../fe3-bff-path.sh`; Modify achado FE-3.

- [ ] **Step 1: Subir um servidor falso de API** (`node -e` com `http.createServer` que imprime o caminho recebido) na porta 55433 e o frontend com `API_URL=http://127.0.0.1:55433` (`pnpm --filter @msimulation-xml/frontend dev`). O cookie `access_token` pode ser um JWT de teste com `exp` futuro (o BFF só repassa).
- [ ] **Step 2: Enviar** `curl --path-as-is "http://127.0.0.1:3000/api/bff/nfes/../auth/me"` e a variante `%2e%2e`. Registrar o caminho que chegou ao servidor falso.
- [ ] **Step 3: Veredito.** Confirmado se o servidor falso recebeu `/api/auth/me`; Refutado se o Next respondeu 404 antes do handler. Commit `docs: verificação do FE-3`.

### Task 15: INF-1 porta publicada do backend (fato do usuário)

**Files:** Modify achado INF-1.

- [ ] **Step 1: Montar as perguntas e registrar no achado:** (1) A porta 5001 do servidor é alcançável fora do proxy compartilhado? Teste do usuário: `curl -sS -o /dev/null -w '%{http_code}' http://<host>:5001/api/health` de uma rede externa. (2) O proxy compartilhado sobrescreve `X-Forwarded-For`?
- [ ] **Step 2: Pedir ao usuário as respostas** (não executar nada contra o servidor). Sem resposta, o veredito é **Inconclusivo**.
- [ ] **Step 3: Gravar o veredito e commit** `docs: verificação do INF-1`.

### Task 16: Varredura de `tenantId` em todos os repositories

**Files:** Modify seção 6 (nova subseção "6.17 Cobertura de filtro por tenant"); Create `.../tenant-filter-sweep.md` (saída bruta).

- [ ] **Step 1: Listar via Graphify** (`graphify_find` por `getDbClient`) e por `grep -rn` quoted todos os arquivos que fazem `.findUnique`, `.update`, `.delete`, `.updateMany`, `.deleteMany` em `backend/src`.
- [ ] **Step 2: Para cada chamada cujo `where` não contém `tenantId`,** classificar: tabela com RLS (aceitável), tabela sem RLS (achado, ver S-1), ou id vindo de fonte confiável. Gravar a tabela em `tenant-filter-sweep.md`.
- [ ] **Step 3: Resumir na seção 6.17** só as chamadas em tabela sem RLS. Expected: lista fechada de chamadas (pode ser vazia); registrar o total examinado.
- [ ] **Step 4: Commit** `docs: varredura de filtro por tenant`.

### Task 17: Varredura dos componentes do frontend

**Files:** Modify seção 6.15 (nova lista "Varredura de componentes").

- [ ] **Step 1: Buscar sinks** (grep com padrão entre aspas): `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`, `window.open`, `href={` com valor vindo de dado da API, `localStorage`, `document.cookie`, `target="_blank"` sem `rel`.
- [ ] **Step 2: Ler os 10 maiores componentes** (`sidebar.tsx` fica de fora: shadcn) e as Server Actions de `lib/auth/actions/*`, procurando: `redirect` ou `from` sem validar caminho relativo, dado do usuário em URL de `fetch`, segredo em `NEXT_PUBLIC_`.
- [ ] **Step 3: Registrar** cada ocorrência real como achado `FE-n` com severidade; sem ocorrência, uma linha "Varredura sem achados (lista de padrões e total de arquivos)".
- [ ] **Step 4: Commit** `docs: varredura de componentes do frontend`.

### Task 18: Leitura dos builders de `nfe-xml` e do resolver de ICMS

**Files:** Modify seção 6.14.

- [ ] **Step 1: Ler** `builders/venda.builder.ts`, `builders/remessa.builder.ts`, `taxes/icms.resolver.ts`, `fiscal/fiscal-xml.util.ts`, `core/proc-evento.builder.ts` e `fiscal-core/src/cte-template.ts`.
- [ ] **Step 2: Checklist por arquivo:** interpolação manual de texto do usuário sem escape; `Number`/`parseFloat` em dinheiro; `Math.random`/`Date.now` em identificador que deveria ser determinístico; `throw new Error` para regra de negócio; ramos `marketplace === "..."` (proibidos pelo `ARCHITECTURE.md`).
- [ ] **Step 3: Registrar** achados `PKG-n` ou "sem achados" por arquivo.
- [ ] **Step 4: Commit** `docs: leitura dos builders de nfe-xml`.

### Task 19: Leitura de `audit.py` e `mcp_nfe_extended_checks.py`

**Files:** Modify seção 6.16.

- [ ] **Step 1: Ler os dois arquivos** (468 e 318 linhas) e `validate_nfe_full_response.py`.
- [ ] **Step 2: Checklist:** `open`/`Path` com caminho vindo do XML; `subprocess`; regex com backtracking catastrófico em campo do XML; chamada de rede sem `timeout`; exceção engolida (`except: pass`).
- [ ] **Step 3: Registrar** achados `INF-n` ou "sem achados" e commit `docs: leitura do código de auditoria Python`.

### Task 20: Dependências (`pnpm audit` e `pip-audit`)

**Files:** Modify B-10 e seção 8.

- [ ] **Step 1: Run** `pnpm audit --prod` na raiz. Expected: relatório; registrar contagem por severidade e os pacotes de severidade alta ou crítica.
- [ ] **Step 2: Run** `pip-audit` no venv da Tarefa 13 com `mcp-fiscal-brasil==0.5.1`. Registrar a saída.
- [ ] **Step 3: Registrar** o resultado em B-10 e remover o item da seção 8. Commit `docs: auditoria de dependências`.

### Task 21: Consolidação

**Files:** Modify `docs/code-review-backend-2026-11-11.md` (seções 2, 6, 7, 8).

- [ ] **Step 1: Para cada veredito Refutado,** corrigir o texto do achado, tirar de "(verificar)" e ajustar as contagens da tabela da seção 6.
- [ ] **Step 2: Para cada Confirmado,** retirar "(verificar)" do título e anotar o script de reprodução.
- [ ] **Step 3: Reordenar a seção 7** pelos vereditos e atualizar a seção 8 só com o que continua Inconclusivo.
- [ ] **Step 4: Conferir** `grep -c "(verificar)" docs/code-review-backend-2026-11-11.md`. Expected: só os itens Inconclusivos restantes; listar cada um na seção 8.
- [ ] **Step 5: Derrubar o harness** (`bash docs/superpowers/audit-repro/harness/down.sh`) e commit `docs: consolidar vereditos da auditoria`.

---

## Self-review

- **Cobertura da auditoria:** todo item "(verificar)" tem tarefa: S-2 (1), CAT-1 (7), FVAL-1 (8), INF-1 (15), INF-3 (13), FE-2 e FE-3 (14; FE-2 depende de S-6 e fica **sem tarefa executável**, ver abaixo), PKG-4 e PKG-6, AUTH-2, FSET-1, FVAL-3, TAX-4, LOG-5 e CAT-5 (leitura, sem tarefa própria).
- **Lacuna declarada:** os "(verificar)" que são perguntas de leitura (AUTH-2, FSET-1, TAX-4, CAT-5, PKG-4, PKG-6, FVAL-3, FE-2) não entraram como tarefa. Se o usuário quiser, viram a Tarefa 22 "leituras curtas", uma linha por achado.
- **Consistência:** `makePrisma` e `seedTenants` (Tarefa 0) são os únicos símbolos compartilhados; o formato do veredito está nas Global Constraints.
- **Proporção:** o plano descreve verificações, não reimplementa código; nenhum corpo de função aparece.
