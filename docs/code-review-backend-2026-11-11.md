# Code review do backend: segurança, performance e boas práticas

Data: 2026-11-11 · Branch: `fix/xml-rejeitar-dtd` · Escopo: `backend/` (NestJS 11 + Fastify + Prisma 7 + Postgres/Neon), mais `packages/`, `frontend/` e `infra/` na seção 6.14 a 6.16.
Nenhum código foi alterado. Este documento só registra achados.

## 1. Escopo e limites da revisão

**Contexto do produto.** O `README.md` define o sistema como simulador fiscal educacional (homologação, sem validade na SEFAZ), e a assinatura XML usa um certificado autoassinado embutido (`simulation-credentials.ts`). Por isso "nota fiscal duplicada" ou "saldo errado" nesta revisão significam **dado inconsistente num ambiente de simulação**, não infração fiscal. Os achados de integridade (SAL-1, FDOC-1, REM-1) continuam válidos, porque quebram o que o simulador promete mostrar, mas a severidade jurídica não se aplica. Já os achados de isolamento entre empresas (S-1, S-2, LOG-1) e de autenticação valem por inteiro: há dados de várias empresas num só banco.

**O que foi lido.** O repositório tem cerca de 63 mil linhas de TypeScript fora de testes e de `generated/` (29 mil no backend, 9,5 mil nos pacotes e 25 mil no frontend), mais 1,9 mil linhas de proxy Python e Docker. Foram lidos **inteiros**: o bootstrap, a camada de auth (`lib/auth`, guards, login, 2FA, refresh, onboarding, verificação de e-mail), o contexto de banco e RLS, rate limit, CORS, helmet, config, filtros de erro, upload de planilha, a migration de RLS, o schema Prisma, os Dockerfiles, o compose de produção, os dois workflows, o `proxy.ts`, o BFF e os cookies de sessão do frontend, o proxy Python e a assinatura/serialização XML. Nos 13 módulos de domínio li controllers, repositories e os use cases de maior risco (inclusive `sale-return`, `physical-return`, `warehouse-advance`, `branch-transfer`, `inbound-conference` e o `tax-engine`); o restante entrou por amostragem. O Graphify (`mcp__graphify`, índice do commit `a231a4b`) serviu para confirmar quem chama `runFiscalTransaction` (12 chamadores, todos citados abaixo) e para localizar arquivos.

**O que não foi feito.** Execução do código, teste contra Postgres (por isso os achados de corrida, como SAL-1, FDOC-1, FDOC-7, REM-1 e CAT-1, vêm de leitura e precisam de teste que os reproduza), leitura linha a linha dos componentes React e dos builders de `nfe-xml`, e varredura de CVEs (`pnpm audit`, `pip-audit`). Achados marcados com **(verificar)** dependem de algo que não confirmei no código lido.

## 2. Resumo

| Severidade | Segurança | Performance | Boas práticas |
|---|---|---|---|
| Alta | 4 | 4 | 0 |
| Média | 6 | 4 | 5 |
| Baixa | 4 | 1 | 5 |

A seção 6 traz a análise módulo a módulo (13 módulos do backend, `packages/`, `frontend/` e `infra/`). Seis achados de severidade alta são específicos de módulo: CAT-1, SAL-1, REM-1, FDOC-1, LOG-1 e INF-1.

Os três pontos de maior retorno nos achados transversais:

1. **S-1 e S-2**: a RLS pode não proteger nada se o papel do banco ignora RLS, e duas tabelas filhas não têm RLS.
2. **P-1**: as rotas de auth abrem transação (e seguram conexão do pool de 10) durante CAPTCHA, scrypt e atraso artificial. Poucos logins simultâneos derrubam a API inteira.
3. **S-3 e S-4**: `trustProxy` sempre ligado em produção e contador de 2FA que é zerado pelo próprio fluxo de login enfraquecem o rate limit e o lockout.

O que já está bem feito (para não ser refeito): comparação em tempo constante e hash fictício no login, mensagens genéricas contra enumeração de e-mail, `tokenVersion` conferido no banco a cada request, refresh token opaco com hash, AES-256-GCM para segredo TOTP, falha no boot com segredo placeholder em produção, CORS fechado em produção, Zod em todo DTO, `set_config(..., true)` local à transação, advisory lock na numeração fiscal, checagem de zip bomb antes do `XLSX.read`.

---

## 3. Segurança

### S-1 · Alta · Tabelas filhas sem `tenant_id` e sem RLS

> **Verificação 2026-11-11:** Confirmado. Evidência: `docs/superpowers/audit-repro/s1-child-tables.ts`. Com o papel `audit_app` (NOBYPASSRLS) e `app.tenant_id` do tenant A, `pedidoItem.findMany()` e `nfeRemessaConsumo.findMany()` sem filtro devolvem as linhas do tenant B; na mesma transação, `pedidos` (com RLS) devolve 0 linhas de B.

`PedidoItem` (`pedido_itens`) e `NfeRemessaConsumo` (`nfe_remessa_consumos`) não têm `tenantId` no `schema.prisma` e não aparecem em nenhuma migration de RLS. Das 23 tabelas, as de autenticação (`users`, `user_sessions`, tokens) ficam fora por decisão documentada; estas duas não.

- **Cenário:** um repository que consulte `pedidoItem` ou `nfeRemessaConsumo` por `id` ou `pedidoId` sem passar pelo pai (ex.: `nfe.repository.ts` faz `nfeRemessaConsumo.findMany({ where: { retornoNfeId } })` sem tenant) depende só de o id vir de um registro já filtrado. Um bug de uso, ou um id de outro tenant vindo do cliente, lê ou altera dado alheio e a RLS não barra.
- **Também (verificar):** `users` tem `tenantId`, mas está fora da RLS. `member.repository.ts` lista usuários; confirmar que o `where` sempre filtra por tenant.
- **Correção sugerida:** adicionar `tenant_id` (preenchido por backfill) e a policy `tenant_isolation` nas duas tabelas, ou, no mínimo, uma policy baseada em `EXISTS` no pai.

### S-2 · Alta (verificar) · A RLS só vale se o papel do banco não a ignora

> **Verificação 2026-11-11:** Inconclusivo (falta o fato de produção). Evidência: `docs/superpowers/audit-repro/s2-rls-role.ts`. No Postgres local, o papel `audit_app` (NOBYPASSRLS) vê 1 produto no tenant A e 0 de outro tenant; o superusuário vê os 2, confirmando que a RLS some com papel privilegiado. Para fechar, rodar em produção (somente leitura): `select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user;` e `select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('products','pedido_itens','nfe_remessa_consumos');`.

As migrations usam `ENABLE` + `FORCE ROW LEVEL SECURITY`, mas nenhuma cria um papel de aplicação restrito (`CREATE ROLE`/`GRANT` não aparecem). A aplicação conecta com o `DATABASE_URL` único, que no Neon costuma ser o papel dono, e o mesmo usado por `prisma migrate`. `FORCE` cobre o dono, mas **não cobre papéis com `BYPASSRLS` nem superusuário**.

- **Risco:** se esse papel tiver `BYPASSRLS`, toda a defesa em profundidade é decorativa e o isolamento de tenant depende só dos `where tenantId` dos repositories.
- **Como confirmar:** `SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user;` com o `DATABASE_URL` de runtime.
- **Correção sugerida:** papel de runtime sem `BYPASSRLS` (só DML), papel separado para migrations. Teste de integração contra Postgres descartável que prove que `SELECT` sem `set_config` devolve 0 linhas. O CI atual não tem esse teste (`ARCHITECTURE.md` seção 10 o prevê, mas só existe `verify-marketplaces-migration.sh`, manual).

### S-3 · Alta · `trustProxy` ligado incondicionalmente em produção

`app.ts:50`: `trustProxy = appConfig.trustProxy === "true" || appConfig.isProduction`. Com `true`, o Fastify confia em **qualquer** `X-Forwarded-For`.

- **Impacto:** `request.ip` vira um valor que o cliente escolhe, se o serviço for alcançável sem passar pelo proxy ou se o proxy não sobrescrever o header. Todo rate limit é por IP (`login` 10/15 min, `2fa` 5/15 min, `registro` 5/h, `reset` 5/h), então o atacante troca o header a cada tentativa e anula todos. O IP gravado em `user_sessions` também fica falsificável.
- **Correção sugerida:** número de saltos (`trustProxy: 1`) ou lista de CIDRs do proxy do Render; garantir que a porta só aceita tráfego do proxy.

### S-4 · Alta · Força bruta de TOTP não é contida pelo lockout

> **Verificação 2026-11-11:** Confirmado (força bruta e replay). Evidência: `docs/superpowers/audit-repro/s4-2fa-bruteforce.ts` (`VerifyTwoFactorLoginUseCase`, `UserRepository`, `LoginLockoutProvider` e `verifyTotpCode` reais; só o JWT `2fa_pending` é falso). Alternando 4 códigos errados com um novo login (que chama `clearLoginLockout` em `login.usecase.ts:56`, antes do ramo de 2FA na linha 58), foram testados **100 códigos errados sem bloqueio** com limite 5. O mesmo código TOTP válido foi aceito duas vezes seguidas (não há registro do último código usado). O que ainda freia o ataque são o rate limit por IP e o Turnstile do login, ambos fracos pelo S-3 e pelo P-6.

Em `login.usecase.ts`, depois da senha correta chama-se `clearLoginLockout` **antes** de devolver o desafio de 2FA. Em `verify-two-factor-login.usecase.ts` cada código errado incrementa o contador, mas o próximo login com a senha correta o zera.

- **Cenário (senha vazada):** o atacante alterna login (zera) → 4 chutes de TOTP → login (zera) → ... O lockout nunca dispara. A única barreira restante é o rate limit por IP (5 a 10 por 15 min), que o S-3 permite burlar. O código tem 6 dígitos.
- **Também:** o `twoFactorToken` não é de uso único (vale 5 min, repetível), e o código TOTP aceito não é registrado, então o mesmo código serve duas vezes na janela (replay).
- **Correção sugerida:** contador de falhas de 2FA separado, que só zera em sucesso do 2FA; guardar o último `timestep` aceito por usuário; invalidar o `twoFactorToken` após N falhas.

### S-5 · Média · Lockout por conta permite bloqueio de terceiros e tem corrida

`LoginUseCase`: o lockout é por conta, sem considerar IP. Qualquer pessoa que saiba o e-mail da vítima trava a conta por 15 min com 5 tentativas (o Turnstile mitiga, não elimina). Além disso, `nextFailedLoginState(user.failedLoginAttempts)` usa o valor lido antes: requisições paralelas leem o mesmo contador e gravam o mesmo valor, então N tentativas simultâneas contam como 1.

- **Correção sugerida:** incremento atômico no SQL (`failed_attempts = failed_attempts + 1 ... RETURNING`), lockout por par conta+IP ou com atraso progressivo em vez de bloqueio total.

### S-6 · Média · Rotação do refresh token não é atômica e não detecta reuso

`refresh-session.usecase.ts`: `findActiveByRefreshTokenHash` e `revokeById` são duas operações separadas. Duas requisições simultâneas com o mesmo refresh token passam na busca e emitem duas sessões. Um token já revogado que reaparece só gera 401, sem derrubar a sessão.

- **Correção sugerida:** `UPDATE ... SET revoked_at = now() WHERE hash = $1 AND revoked_at IS NULL RETURNING ...` e tratar zero linhas como reuso (revogar todas as sessões do usuário e incrementar `tokenVersion`).

### S-7 · Média · Segredos com valor padrão conhecido fora de `NODE_ENV=production`

`lib/auth/config.ts:83` e `:93` devolvem `"dev-pepper-..."` e `"dev-totp-key-..."` quando a variável falta e `NODE_ENV !== "production"`; `JWT_SECRET` aceita 16 caracteres (`:70`); o Turnstile é ignorado sem chave (`turnstile.ts:27-32`).

- **Risco:** um ambiente (staging, preview, container sem `NODE_ENV`) exposto na internet roda com segredos públicos no repositório. O Dockerfile define `NODE_ENV=production`, o que reduz o risco no deploy atual.
- **Correção sugerida:** falhar no boot também fora de produção, a menos que uma flag explícita (`ALLOW_INSECURE_DEV_SECRETS=true`) esteja ligada.

### S-8 · Média · Endpoint `/api/health` público faz consulta ao banco sem limite

`HealthController`: sem guard e sem rate limit (comentário assumido), e cada chamada executa `SELECT 1` no pool de 10 conexões. Um flood anônimo disputa conexões com requisições reais. Vaza também o estado do banco (`database: "unavailable"`).

- **Correção sugerida:** rate limit, cache de 5 a 10 s do resultado, ou separar `/health/live` (sem banco) de `/health/ready`.

### S-9 · Média · Dependência `xlsx` instalada de um tarball externo

`package.json`: `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`. O pacote não passa pelo registry npm, então o `pnpm audit --audit-level=high` do CI **não o cobre**, e o build depende de um CDN de terceiro. O projeto ainda carrega `exceljs` (duas libs de planilha). O parse é síncrono e processa upload de usuário.

- **Correção sugerida:** fixar o hash de integridade no lockfile, vendorizar o tarball ou migrar tudo para `exceljs`; rodar o parse em worker thread.

### S-10 · Média · Matriz de papéis irregular (verificar)

`@AdminOnly()` está em métodos de escrita fiscal, mas controllers como `order.controller.ts` e a maior parte de `observability.controller.ts` só têm `@ProtectedApi()`: qualquer `MEMBER` autenticado lê `audit-logs` e altera pedidos. Pode ser intencional; não há documento que diga qual papel pode o quê.

- **Correção sugerida:** tabela de permissões por rota no contrato HTTP, com teste que falha quando uma rota de escrita fica sem decisão explícita.

### S-11 · Baixa · Hash de senha abaixo da recomendação atual

`password.ts:17`: scrypt `N=16384, r=8, p=1`. O OWASP recomenda `N=2^17` (ou Argon2id). O pepper é concatenado à senha (`plain + pepper`) em vez de aplicado por HMAC, e o **mesmo** `PASSWORD_PEPPER` serve para hash de senha e de tokens opacos (`token.ts`): trocar o pepper invalida todas as senhas e tokens de uma vez, e não há versionamento do formato do hash (não dá para migrar o custo sem uma coluna de versão).

### S-12 · Baixa · Chave TOTP sem KDF nem rotação

`totp-crypto.ts`: a chave AES é `SHA-256(TOTP_ENCRYPTION_KEY)`, sem salt e sem identificador de versão da chave no texto cifrado. Rotacionar a chave exige re-cifrar tudo manualmente.

### S-13 · Baixa · JWT sem restrição explícita de algoritmo, emissor e audiência

`jwt.plugin.ts` registra `@fastify/jwt` só com `secret` e `expiresIn`. O padrão é HS256 e funciona, mas sem `iss`/`aud` e sem `algorithms` explícito. O `logout` (`session.controller.ts`) verifica a assinatura mas não o `tokenVersion`.

### S-14 · Baixa · Contêiner roda como root

`infra/docker/backend.Dockerfile`: sem `USER`, e o estágio final copia código-fonte, `devDependencies` e o `pnpm` inteiros. Ver B-9.

---

## 4. Performance e gargalos

### P-1 · Alta · Rotas de auth seguram conexão do pool durante trabalho que não usa o banco

`AuthApi()` aplica `DbContextInterceptor` a todos os controllers de auth. O interceptor abre `prisma.$transaction` **antes** do handler (`db-context.interceptor.ts:58-62`). Dentro dessa transação, `signIn` executa: `verifyTurnstileToken` (chamada HTTP externa, **sem timeout**), `scrypt` (~100 ms de CPU no thread pool) e, no erro, `authFailureDelay` (200 a 350 ms de `setTimeout`).

- **Impacto:** o pool tem 10 conexões (`DEFAULT_DB_POOL_MAX`). Dez logins errados simultâneos, ou um Turnstile lento, ocupam o pool inteiro e todo `@ProtectedApi()` espera até `maxWait` (10 s) e falha. Essas rotas nem têm tenant, então o `set_config` nem é necessário.
- **Correção sugerida:** `@SkipDbContext()` nas rotas de auth públicas e transação curta só nas escritas; `AbortSignal.timeout(3000)` no `fetch` do Turnstile.

### P-2 · Alta · Duas conexões e duas idas ao banco antes de cada handler protegido

`JwtAuthGuard` consulta `user` com o client raiz (`access-control.ts:46`, uma conexão do pool) e só depois o interceptor abre a transação (outra conexão) e faz `set_config`. Os comentários do próprio código estimam ~150 ms por comando no Neon. São pelo menos 2 round trips de overhead por requisição, e as duas conexões são tiradas do mesmo pool de 10.

- **Correção sugerida:** cache em memória do `tokenVersion`/`role`/`tenantId` com TTL curto (5 a 15 s) invalidado no logout, ou fazer a checagem dentro da mesma transação do interceptor.

### P-3 · Alta · Transação aberta durante toda a requisição, com timeout de 5 minutos

`transaction-options.ts`: `timeout: 300_000`. Toda rota `@ProtectedApi()` (inclusive `GET`, download de XML e exportação XLSX) segura uma conexão até o fim da resposta. Com pool de 10, ~10 requisições lentas bloqueiam o resto. Não há `statement_timeout` nem `idle_in_transaction_session_timeout` configurados no pool (`prisma.ts`).

- **Correção sugerida:** timeout de transação padrão curto (10 a 30 s) com override explícito nas rotas de emissão em lote; `statement_timeout` por conexão; geração de arquivo grande fora da transação.

### P-4 · Alta · Listagens sem paginação nem limite

`order.repository.ts:48` (`listByTenant`), `nfe.repository.ts:31` (`list`, com `include` de itens de cada NF-e), `cte.repository.ts`, `audit-logs`, eventos fiscais, `timeline/steps` e `member.repository.ts` fazem `findMany` sem `take`. O `ARCHITECTURE.md` (seção 12) admite que listas não paginam por contrato com o frontend.

- **Impacto:** memória, tempo de serialização e payload crescem sem teto com o histórico do tenant; `audit_logs` e `fiscal_events` só crescem. É o primeiro ponto que quebra com um tenant grande.
- **Correção sugerida:** paginação por cursor, com `limit` padrão e teto, introduzida sem quebrar o contrato (campos novos opcionais).

### P-5 · Média · Escrita dentro de `GET`

`NfeRepository.getByAccessKey` chama `refreshRemessaFifoItemsForNfes` (reconcilia saldo FIFO, grava no banco) ao abrir o detalhe de uma remessa. O comentário em `list` diz que isso foi removido da listagem por ser "write-on-read", mas continua no detalhe. `GET` com escrita segura lock de linha, quebra cache e idempotência.

### P-6 · Média · Rate limit em memória

`@fastify/rate-limit` usa o store local do processo, e `RateLimitInterceptor` cria um limitador por rota. Com mais de uma instância, o limite efetivo é multiplicado por N; a cada deploy os contadores zeram. Para login/2FA isso enfraquece o controle (junto com S-3).

- **Correção sugerida:** store Redis (ou Postgres) compartilhado quando houver mais de uma instância.

### P-7 · Média · `fetch` externo sem timeout

`turnstile.ts:43`, `cnpj-lookup.provider.ts:96,121`, `cep-lookup.provider.ts:56,84` não passam `AbortSignal`. O `fetch` do Node espera até o timeout padrão do undici (minutos). Em `lookup` as chamadas ocupam a rota; em `login`, ocupam também a transação (P-1).

### P-8 · Média · Parse de planilha síncrono no event loop

`spreadsheet-upload.ts` / `zip-size.ts`: o limite de 100 MB descompactados é conferido pelos tamanhos **declarados** no diretório central do ZIP (o próprio código registra o `shortcut:`), então um ZIP que mente o tamanho passa e o `XLSX.read` síncrono trava todas as requisições do processo. A exportação de timeline monta o workbook inteiro em memória.

### P-9 · Baixa · Advisory lock com hash de 32 bits e transação longa de emissão

`nfe-sequencia.ts`: `pg_advisory_xact_lock(hashtext(tenantId), serie)` serializa a emissão por tenant+série até o commit; como a cadeia de venda pode durar até o timeout de 5 min (P-3), uma emissão lenta bloqueia as demais do tenant. Colisão de `hashtext` entre tenants só causa espera desnecessária, não erro.

---

## 5. Desvios de boas práticas e de arquitetura

### B-1 · Média · Controller acessa Prisma direto

`observability.controller.ts:26`, `:130` e `:165` chamam `getDbClient().auditLog.findMany`, `timelineStep.findMany` e `prisma.fiscalEvent.findMany` dentro do controller (e funções livres no mesmo arquivo). O contrato (`ARCHITECTURE.md` seções 3 e 4) diz que controller traduz HTTP e repository é o único acesso ao Prisma.

### B-2 · Média · Pontos de estado global e efeito colateral no import

`lib/db/prisma.ts:48-49` cria o pool e o `PrismaClient` no momento do `import` (lança se `DATABASE_URL` faltar, e testes dependem de mock). `prisma-tx.ts` guarda `fiscalTransactionCommitHook` como variável mutável de módulo; o hook é registrado por um módulo Nest em `onModuleInit`, então uma transação fiscal antes disso perde o efeito sem aviso.

### B-3 · Média · `catch` vazio contra a regra do projeto

`prisma-tx.ts:85-89` engole qualquer erro síncrono do hook pós-commit, sem log (`error-handling.md`: "`catch` vazio é proibido"). A justificativa no comentário diz que o logger fica em quem registra o hook, mas um hook sem `try/catch` interno perde o erro.

### B-4 · Média · Sem teste de integração com Postgres e RLS

A seção 10 do `ARCHITECTURE.md` prevê teste contra Postgres descartável com as migrations. O CI (`.github/workflows/ci.yml`) roda lint, build, tipos, depcheck, testes unitários e `pnpm audit`, sem serviço de banco. A RLS, a numeração com advisory lock e o `set_config` único (commit `perf: aplicar tenant e usuário da RLS numa única instrução set_config`) não têm teste que falhe se quebrarem.

### B-5 · Baixa · `lib/` depende de `modules/`

`lib/auth/session.ts` importa tipo de `modules/org/tenant/tenant.types.js`. O comentário de `prisma-tx.ts` explica que o hook existe justamente para `lib/db` não importar domínio; o contrário ocorre em `lib/auth`. Sem ciclo hoje, mas a camada de infraestrutura conhece o domínio.

### B-6 · Baixa · Configuração validada só em parte

`ConfigService` lê `process.env` em getters sem validação central; `PORT` vira `Number(...)` sem checagem (`index.ts`), `loginMaxFailedAttempts` e `loginLockoutMs` caem em silêncio no padrão com valor inválido (o contrário do que `parseDurationMs` faz para TTLs). Um schema Zod único no boot evitaria os dois comportamentos.

### B-7 · Baixa · Três estilos de erro de domínio convivendo

`HttpError`, exceções do Nest em `namespace` e erros nomeados por filtro de rota (`AuthErrorFilter`, `RouteErrorFilter`). `BusinessException` existe, mas o contrato documentado a trata como padrão para código novo e os módulos atuais não a usam. Aceito na seção 12 do `ARCHITECTURE.md`; fica registrado como dívida que cresce a cada módulo novo.

### B-8 · Baixa · Sem entidades de domínio

`src/entities/` não existe; os repositories devolvem tipos mapeados de linhas Prisma. Documentado como desvio intencional (seção 12); regras fiscais importantes (`rules/`) estão puras e testáveis, então o custo é baixo hoje.

### B-9 · Média · Dockerfile e documentação divergem

- Imagem `node:20-alpine`; o `ARCHITECTURE.md` diz Node 24. O Node 20 saiu de suporte em abril de 2026.
- `pnpm@9.15.9` fixo no Docker; confirmar o mesmo em CI.
- Estágio final copia fonte, `devDependencies` e `pnpm`; sem `USER` não-root. O `HEALTHCHECK` existe e chama `/api/health` (que toca o banco, ver S-8).
- `DATABASE_URL` dummy no `ENV` do build fica gravada nas camadas da imagem (inofensiva, mas é o tipo de linha que um scanner de segredos aponta).

### B-10 · Baixa · CI sem varredura de segredos, SAST ou imagem

Só `pnpm audit`. Faltam: secret scanning (gitleaks), análise estática de segurança (CodeQL/semgrep) e scan da imagem (Trivy). O `xlsx` fora do registry (S-9) escapa do `audit`.

---

## 6. Análise módulo a módulo

Os 13 contextos de `backend/src/modules/` foram revisados um a um (6.1 a 6.13), seguidos de `packages/` (6.14), `frontend/` (6.15) e `infra/` (6.16). Os achados abaixo são **específicos do módulo**; os transversais (S-*, P-*, B-*) valem para todos e só são citados por referência. Prefixos: `AUTH`, `ORG`, `CAT`, `TAX`, `SAL`, `REM`, `FDOC`, `FSET`, `FVAL`, `LOG`, `LKP`, `MKT`, `PKG`, `FE`, `INF`.

| Módulo | Arquivos / linhas | Specs | Alta | Média | Baixa | Resumo |
|---|---|---|---|---|---|---|
| `auth` | 57 / 2,6 mil | 4 | 0 | 2 | 6 | Base sólida; falhas concentradas em atomicidade e no contador de 2FA (S-4 a S-6) |
| `org` | 35 / 1,6 mil | 3 | 0 | 2 | 3 | PATCH da empresa aberto a qualquer membro |
| `catalog` | 28 / 1,7 mil | 4 | 1 | 4 | 1 | Importação em massa frágil e lenta |
| `tax` | 34 / 3,4 mil | 16 | 0 | 2 | 3 | Boa cobertura; aritmética fiscal em ponto flutuante |
| `sales` | 33 / 2,5 mil | 8 | 1 | 1 | 1 | Faturamento sem proteção contra duplicidade |
| `remessas` | 59 / 4,3 mil | 10 | 1 | 1 | 3 | Saldo FIFO com *lost update* |
| `fiscal-documents` | 56 / 6,0 mil | 10 | 1 | 3 | 5 | Cancelamento, devolução e conferência reentrantes; arquivos muito grandes |
| `fiscal-settings` | 18 / 1,1 mil | 1 | 0 | 1 | 1 | JSON de configuração sem schema |
| `fiscal-validation` | 23 / 0,8 mil | 7 | 0 | 2 | 1 | Gatilho pós-commit provavelmente inoperante |
| `logistics` | 28 / 1,5 mil | 4 | 1 | 2 | 3 | Tabela global gravável por qualquer ADMIN |
| `lookup` | 9 / 0,5 mil | 1 | 0 | 2 | 1 | Chamadas externas sem timeout nem cache |
| `marketplace` | 6 / 0,1 mil | 1 | 0 | 0 | 0 | Sem achados |
| `health` | 4 / 0,1 mil | 1 | 0 | 0 | 0 | Ver S-8 |
| `packages/fiscal-core`, `packages/nfe-xml` | 134 / 9,5 mil | 34 | 0 | 0 | 6 | Chave de simulação embutida (intencional); `replace` corrompe XML assinado |
| `frontend` | 323 / 24,8 mil | 10 | 0 | 2 | 2 | CSP com `unsafe-inline`; rotação de refresh frágil |
| `infra` (Docker, CI, proxy Python) | 18 / 1,9 mil | 5 | 1 | 4 | 2 | Porta do backend publicada; proxy Python aberto; deploy sem CI |

Cobertura de specs proporcional ao risco é desigual: `fiscal-settings` (1 spec para 1,1 mil linhas) e `fiscal-documents` (10 specs para 6 mil linhas, incluindo `sale-return.usecase.ts` com 670 linhas) são os mais descobertos.

### 6.1 `auth`

Escopo lido: login, 2FA, refresh, registro, reset de senha, onboarding, verificação de e-mail, controllers e providers.

- **AUTH-1 · Média · Consumo do token de reset não é atômico.** `password-reset.repository.ts` (`completePasswordReset`) marca `usedAt` por `id`, sem condição `usedAt IS NULL`. Duas requisições simultâneas com o mesmo token passam em `findByTokenHash` e ambas definem a senha. Corrigir com `updateMany({ where: { id, usedAt: null } })` e conferir `count === 1`.
  > **Verificação 2026-11-11:** Confirmado (5/5). Evidência: `docs/superpowers/audit-repro/auth-races.ts` (`ResetPasswordUseCase` e repositories reais; hasher falso com 100 ms, abaixo do custo real do scrypt). Dez requisições simultâneas com o mesmo token e senhas diferentes: as dez aceitas, e a senha final é a da última a gravar. Quem intercepta o link (log de proxy, `Referer`) consegue redefinir em paralelo com o dono.
- **AUTH-2 · Média (verificar) · Posse do CNPJ não é provada no onboarding.** O cadastro da empresa aceita qualquer CNPJ (único no banco). Quem se cadastrar primeiro com o CNPJ de um concorrente o bloqueia com "CNPJ já cadastrado". Não li `onboarding.controller.ts` linha a linha; confirmar se há alguma prova de posse (e-mail do CNPJ, certificado).
- **AUTH-3 · Baixa · `catch {}` sem log** em `register-user.usecase.ts` ao enviar o e-mail de confirmação: falha de envio some sem registro (regra `error-handling.md`).
- **AUTH-4 · Baixa · Tempo de resposta distingue e-mail existente.** Em `request-password-reset.usecase.ts` o caminho "usuário existe" grava token e chama o Brevo; o caminho "não existe" só espera 200 a 350 ms. A diferença de latência permite enumeração, apesar da resposta genérica.
- **AUTH-5 · Baixa · E-mail enviado dentro da transação HTTP** (reset, verificação, registro): a chamada ao Brevo segura a conexão do pool (ver P-1).
- **AUTH-6 · Baixa · DTOs sem `.max()`:** `refreshToken`, `twoFactorToken`, `code`, `token` de verificação e reset. Limitado pelo corpo de 1 MiB do Fastify, mas permite hash de strings grandes por requisição.
- **AUTH-7 · Baixa · Onboarding sem serialização.** `AttachTenantOnboardingUseCase` lê `user.tenantId` e depois `createTenantAndAttachUser` cria a empresa e atualiza o usuário, sem lock nem `WHERE tenant_id IS NULL`. Dois envios simultâneos com CNPJs diferentes criam duas empresas; o usuário fica com a última e a primeira vira empresa órfã que prende o CNPJ ("CNPJ já cadastrado") sem dono. Corrigir com `updateMany({ where: { id, tenantId: null } })` conferindo `count`, ou `SELECT ... FOR UPDATE` no usuário. O cast `tenantData as Prisma.TenantCreateInput` repete o ORG-3.
  > **Verificação 2026-11-11:** Confirmado (5/5). Evidência: `docs/superpowers/audit-repro/auth-races.ts` (use case e repository reais). Dez onboardings simultâneos do mesmo usuário com CNPJs distintos: os dez aceitos e dez empresas criadas; o usuário fica com a última e nove viram órfãs, cada uma prendendo um CNPJ.
- **AUTH-8 · Baixa · Verificação de e-mail.** `confirmEmailVerification` marca o token por `id` sem condição `usedAt IS NULL` (o efeito final é idempotente, então só importa se o fluxo crescer). O token vai no query string do link (`/login/verificar-email?token=`), logo cai em log de proxy e em `Referer`; prefira fragmento (`#token=`) ou troca imediata por POST. Os limites (10 por 15 min por IP em `verify-email`, 5 por hora em `resend-verification`) são em memória (P-6).
- Referências: S-4, S-5, S-6, S-11, S-12, P-1.

### 6.2 `org` (tenant, filial, membros)

- **ORG-1 · Média · `PATCH /tenants/:id` sem `@AdminOnly()`.** Qualquer `MEMBER` altera CNPJ, IE, CRT, endereço e flags de emitente da empresa, dados que entram em todo XML emitido. As rotas de filial e de papéis fiscais já exigem ADMIN; a da empresa não.
- **ORG-2 · Média · Escritas por `id` sem `tenantId` em tabelas fora da RLS.** `MemberRepository.update`/`delete` (`user`) e `TenantRepository.update` usam `where: { id }`; o service confere o tenant antes, mas `users` e `tenants` não têm RLS (S-1), então não há segunda barreira. Um chamador futuro do repository que pule o service edita usuário de outra empresa.
- **ORG-3 · Baixa · Casts que desligam a checagem de tipo:** `data as Prisma.TenantUpdateInput` (`tenant.repository.ts`) e `data as Prisma.ProductUpdateInput` (catálogo). Um campo novo no DTO chega ao banco sem revisão.
- **ORG-4 · Baixa · Administrador define a senha de outro usuário** e troca o e-mail dele sem reverificação nem notificação ao dono. A troca de senha já revoga sessões (bom). Convite por e-mail com link de definição de senha elimina o primeiro problema; reverificar o novo e-mail resolve o segundo.
- **ORG-5 · Baixa · Corrida em `delete`:** `countByTenant` e `delete` são separados. Dois ADMINs excluindo-se mutuamente ao mesmo tempo podem deixar a empresa sem usuários (a regra "não excluir o logado" não cobre isso).

### 6.3 `catalog` (produtos e importação)

- **CAT-1 · Alta (verificar) · `bulk-upsert` usa `try/catch` por linha dentro de uma única transação.** Em Postgres, um comando com erro aborta a transação inteira (`25P01`); sem `SAVEPOINT`, todas as linhas seguintes falham também, e o usuário vê uma lista de falhas que mente (só a primeira era inválida). Erros que passam da validação Zod, como `VarChar` estourado ou número fora de `Decimal(15,2)`, disparam isso. Confirmar com um teste de integração.
  > **Verificação 2026-11-11:** Confirmado, com efeito pior que o previsto. Evidência: `docs/superpowers/audit-repro/cat1-bulk-upsert-abort.ts` (use case, repositories e `TaxRuleService` reais). Lote de 5 linhas em que a 2ª tem `preco = 1e12` (passa no Zod, que não tem teto, e estoura `Decimal(15,8)`). As linhas 3 a 5 falham com "current transaction is aborted". A resposta diz `created=1`, mas **nenhum produto fica gravado**: o `COMMIT` de uma transação abortada vira `ROLLBACK` sem erro, então o usuário vê sucesso parcial que não existe. A mensagem da linha 2 devolve o texto interno do Prisma ("Invalid `this.db.product.create()` invocation in /Volumes/...") com caminho de arquivo, contra a regra de não expor detalhes internos.
- **CAT-2 · Média · N+1 por linha.** Até 500 linhas × (1 consulta de regra + 1 insert/update), em série e em transação de até 5 min. A regra tributária já foi corrigida para `unnest` (T3 do plano de auditoria); o catálogo ficou com o padrão antigo.
- **CAT-3 · Média · `import-spreadsheet` roda dentro da transação do `@ProtectedApi()`.** O upload e o `XLSX.read` síncrono seguram uma conexão do pool, o problema que `@SkipDbContext()` resolveu em `tax-rule` (T5) e que aqui continua.
- **CAT-4 · Média · CSV e injeção de fórmula.** `resolveProductSpreadsheetUpload` aceita `.csv` sem passar por `validateSpreadsheetBuffer` (o parser lê CSV com `XLSX.read`). Nas exportações (`produtos-catalogo.xlsx`, `cenarios-fiscais.xlsx`) nenhum campo de texto é escapado: um `nome` como `=HYPERLINK(...)` vira fórmula ao abrir no Excel. Prefixar `'` em células de texto iniciadas por `= + - @`.
- **CAT-5 · Média (verificar) · A importação sobrescreve `estoque` do produto existente** com o valor da planilha, sem gerar `movimentacoes_produto`. O saldo declarado e o histórico divergem.
- **CAT-6 · Média · Excluir um produto apaga rascunhos inteiros.** `deleteProductAndDraftOrders` remove todo pedido em rascunho que contenha o produto, inclusive os itens de outros produtos, sem aviso na resposta.
- **CAT-7 · Baixa · `listByTenant` sem paginação** (P-4); a exportação carrega o catálogo inteiro em memória.

### 6.4 `tax`

Módulo com melhor cobertura (16 specs) e o único com SQL cru, bem parametrizado.

- **TAX-1 · Média · `DELETE /tax-rules` apaga todas as regras do tenant** com um único request ADMIN, sem confirmação, sem registro em `audit_logs` e sem checar produtos que apontam para `taxRuleBaseId`. Produtos ficam com referência solta e a próxima emissão falha.
- **TAX-2 · Média · Aritmética fiscal em `number`.** `tax-engine.ts` arredonda com `Number((value + Number.EPSILON).toFixed(2))`, truque que só funciona enquanto o valor é pequeno: acima de ~2 o `EPSILON` é menor que o passo do ponto flutuante e a soma não muda nada. Testei em Node: `10.075` vira `10.07` (o correto é `10.08`), `4.015` vira `4.01` e `100.285` vira `100.28`; `1.005` e `8.345` arredondam certo. O erro de 1 centavo aparece em base × alíquota e soma nos totais. Prisma já devolve `Decimal`; o motor deveria usar `Decimal` (ou inteiros em centavos) e arredondar uma vez por item, como o layout da NF-e exige. O `ARCHITECTURE.md` proíbe `Float` no banco, mas a regra não chega ao cálculo.
  > **Verificação 2026-11-11:** Confirmado. Evidência: `docs/superpowers/audit-repro/tax2-round2.ts`. Entre 100 mil valores de empate (`n/1000` com 5 na 3ª casa, de 0,005 a 999,995), `round2` erra **47.856 (47,9%)**, sempre para baixo; o primeiro erro é `2.005 → 2` (certo 2,01), e `10.075 → 10.07`. Uma nota com 3 itens de quantidade 1 a 10,075, 4,015 e 100,285 sai com `vProd = vNF = 114,36` em vez de 114,39 (3 centavos). Empates surgem sempre que preço unitário (até 8 casas) × quantidade ou base × alíquota caem em meio centavo.
- **TAX-3 · Baixa · `payload: z.record(z.any())`** em `bulk-upsert-tax-rules.request.dto.ts`: `any` contra a regra do projeto e sem limite por linha (5000 linhas × payload livre; só o corpo de 1 MiB contém).
- **TAX-4 · Baixa (verificar) · `GET /tax-rules` devolve todas as regras com `payload`** (a planilha real tem ~400 colunas por regra). Conferir o tamanho da resposta com dados reais; o commit `perf: paginar regras tributárias por grupo` tratou só o frontend.
- **TAX-5 · Baixa · SQL cru acoplado ao schema** (`upsertBatch`): documentado no próprio código; falta um teste de integração que quebre quando o schema mudar.

### 6.5 `sales` (pedidos e faturamento)

- **SAL-1 · Alta · Faturar não é idempotente nem serializado.** `OrderInvoiceUseCase.execute` lê o status (`FATURADO`?), emite a cadeia (retorno simbólico + venda + CT-e) e só depois chama `markInvoiced`. Sem `SELECT ... FOR UPDATE` no pedido, sem chave de idempotência e com isolamento `READ COMMITTED`, dois cliques ou um retry do cliente emitem **duas cadeias fiscais** para o mesmo pedido. O advisory lock só serializa a numeração, não evita a duplicação.
  > **Verificação 2026-11-11:** Confirmado (5/5 rodadas). Evidência: `docs/superpowers/audit-repro/sal1-double-invoice.ts`. `OrderInvoiceUseCase`, `OrderService` e `OrderRepository` reais, com o `SalesChainEmitter` trocado por um falso que grava a NF-e de venda na mesma transação e leva 150 ms. Cinco chamadas simultâneas para o mesmo pedido: as cinco aceitas e cinco NF-e de venda gravadas, em todas as rodadas. O emissor real leva mais tempo, então a janela em produção é maior.
- **SAL-2 · Média · `markInvoiced` atualiza por `id` sem condição de status.** Mesmo erro de corrida: um `UPDATE ... WHERE id = ? AND status = 'RASCUNHO'` com `count` checado fecharia a janela.
  > **Verificação 2026-11-11:** Confirmado junto com o SAL-1 (mesmo script): as cinco chamadas de `markInvoiced` passaram, porque o `update` por `id` não exige `status = 'RASCUNHO'`.
- **SAL-3 · Baixa · `updateDraft`:** `deleteMany` dos itens + `create` e `update` por `id` (tenant checado antes, no service); `pedido_itens` sem RLS (S-1).
- Referências: S-10 (qualquer `MEMBER` cria, edita e exclui pedidos), P-4 (`listByTenant` sem limite, com itens e NF-e).

### 6.6 `remessas` (remessa, transferência, avanço, FIFO)

- **REM-1 · Alta · Saldo FIFO com *lost update*.** `debitRemessaFifoItems` (`remessa-fifo-consumption.ts`) lê `saldoDisponivel`, calcula `saldo - consumir` em JavaScript e grava o valor **absoluto**. Duas devoluções/retornos simultâneos leem o mesmo saldo e ambos "consomem" a mesma remessa; o saldo final reflete só um débito, e as duas notas saem. Busquei `CHECK` envolvendo saldo ou estoque em todas as migrations e não há nenhum, então o banco aceita saldo negativo. Usar `update ... data: { saldoDisponivel: { decrement: n } }` com `where: { saldoDisponivel: { gte: n } }` e tratar `count === 0` como saldo insuficiente, mais a constraint.
  > **Verificação 2026-11-11:** Confirmado (5/5 rodadas). Evidência: `docs/superpowers/audit-repro/rem1-fifo-lost-update.ts`. 20 chamadas paralelas de `consumeRemessaFifoBalance` (1 unidade cada, cada uma na sua transação com RLS) sobre um item com saldo 10: as 20 foram aceitas, 20 consumos foram gravados e o saldo final ficou em 8 ou 9. O efeito é pior que o previsto: além de perder débitos, o sistema aceita consumir o dobro do saldo existente. `pg_constraint` confirma que `nfe_itens` não tem nenhum `CHECK`.
- **REM-2 · Média · Arrays sem teto.** `shipmentBody.items`, os DTOs de transferência e de avanço não têm `.max()`. Confirmei em `branch-transfer.request.dto.ts` (`items: z.array(...).min(1)` sem teto, `quantidade` sem máximo, então acima de 2³¹ vira erro 500 do Prisma). Cada item custa várias consultas em série (`findProductInTenant` + `realignProductIdBySku`, que **grava**), todas em transação de até 5 min. Um ADMIN (ou token vazado) trava o pool com um único request de ~10 mil itens.
- **REM-3 · Baixa · N+1 no débito FIFO:** um `update` e um `create` de consumo por item da fila, em série. Agrupar com `updateMany`/`createMany`.
- **REM-4 · Baixa · `realignProductIdBySku` escreve dentro de laços de leitura** (`loadLines`, validação), sem necessidade de repetir por item.
- **REM-5 · Baixa · `warehouse-advance-emit.usecase.ts` tem um comentário que contradiz o código.** "Fora da transação fiscal: falha no histórico não desfaz a emissão" vale só quando o use case abre a própria transação. Numa rota `@ProtectedApi()`, `runFiscalTransaction` reaproveita a transação do interceptor, então um erro em `movements.register` **desfaz a emissão inteira**. Além disso, o saldo é conferido (`getAvailableRemessaBalance`) antes de a transação fiscal começar; o débito dentro dela repete a checagem, mas continua sujeito ao REM-1. Corrigir o comentário ou separar de fato (evento pós-commit).
- Referências: FDOC-1 (cancelamento reverte o mesmo saldo), P-3.

### 6.7 `fiscal-documents` (NF-e, CT-e, cancelamento, devolução, inutilização, conferência, observabilidade)

- **FDOC-1 · Alta · Cancelamento reentrante.** `CancellationUseCase.execute` faz todas as checagens (`status`, evento já registrado, devolução existente) **antes** de abrir a transação fiscal e sem lock de linha; `registerCancellation` confere o evento com `findFirst` e **confirmei no `schema.prisma` que `fiscal_events` só tem índices em `tenant_id` e `nfe_id`, sem `UNIQUE (nfe_id, tipo)`**. Dois cancelamentos simultâneos registram dois eventos e chamam `reverseRemessaFifoConsumptions` duas vezes, **inflando o saldo FIFO**. Corrigir com unique no evento e `UPDATE nfes SET status='CANCELADA' WHERE id=? AND status='AUTORIZADA'` como porta de entrada.
  > **Verificação 2026-11-11:** Parcialmente refutado. Evidência: `docs/superpowers/audit-repro/fdoc1-double-cancel.ts`, 5 cancelamentos simultâneos × 5 rodadas. **Venda com retorno simbólico (cadeia normal): Refutado.** `reverseRemessaFifoConsumptions` usa `saldoDisponivel: { increment }` e o `UPDATE` trava a linha do item; as transações seguintes esperam e, quando seguem, o `findFirst` do evento (nova leitura em READ COMMITTED) vê o cancelamento já gravado e desfaz tudo. Resultado: 1 aceito, 1 evento, saldo 10. A afirmação de que o saldo FIFO infla está errada. **Venda sem retorno simbólico (venda legada ou fora da cadeia): Confirmado.** Sem o `UPDATE` que serializa, os 5 passam e gravam 5 eventos 110111 para a mesma NF-e. Severidade revista para Média: o efeito é evento duplicado, não saldo errado.
- **FDOC-2 · Média · Inutilização sem teto nem lock.** `numeroIni`/`numeroFim` aceitam qualquer inteiro positivo (acima de 2³¹ o Prisma devolve erro 500; o layout limita a 9 dígitos e série a 0 a 999). A conferência de "já existe NF-e na faixa" e a gravação não usam o advisory lock da numeração, então uma emissão concorrente pode ocupar um número dentro da faixa recém-inutilizada.
- **FDOC-3 · Média · `receivedQty` aceita decimal** (`z.number().finite().nonnegative()` em `inbound-conference.request.dto.ts`): quantidade de mercadoria é inteira nos demais DTOs (`int().positive()`). Um `2.5` vira nota de diferença fracionada.
- **FDOC-4 · Baixa · Justificativa curta é trocada por texto padrão** em cancelamento e inutilização (`"Cancelamento solicitado pelo emissor conforme operacao"`) em vez de ser recusada. O usuário não sabe qual texto foi para o XML.
- **FDOC-5 · Baixa · XML com `Cache-Control: private, max-age=3600`** (`fiscal-xml-response.ts`): após o cancelamento, o navegador pode continuar servindo o XML "autorizado" por 1 h; em máquina compartilhada o XML fica no cache de disco. Usar `no-store` ou `max-age=0, must-revalidate`.
- **FDOC-6 · Baixa · Arquivos grandes demais:** `sale-return.usecase.ts` (670 linhas), `inbound-conference.emitter.ts` (390), `fiscal-document.mapper.ts` (392), `timeline.service.ts` (354). Misturam regra, consulta e persistência; difícil de testar por partes (e é onde as corridas acima moram).
- **FDOC-7 · Média (verificar) · Mesma corrida de FDOC-1 em devolução, retorno físico e conferência.** (a) `SaleReturnUseCase.execute` calcula o que ainda pode ser devolvido (`computeReturnableLines` sobre `loadPriorReturns`) e só depois emite; duas devoluções simultâneas da mesma venda passam na checagem e devolvem mais do que foi vendido. (b) `PhysicalReturnUseCase` procura `RETORNO_FISICO` existente com `findFirst` antes de emitir; não há `UNIQUE (tipo, nfe_referencia_id)`, então dois cliques geram dois retornos físicos da mesma remessa. (c) `InboundConferenceUseCase` lê o saldo lógico e emite as notas de diferença sem lock na remessa. Em todos, `SELECT ... FOR UPDATE` na NF-e de origem (ou o advisory lock por chave) no início da transação resolve; o `UPDATE ... WHERE status` do FDOC-1 também.
  > **Verificação 2026-11-11:** Confirmado em (a) e (c), refutado em (b). Evidência: `docs/superpowers/audit-repro/fdoc7-reentrancy.ts`, use cases reais, 5 chamadas simultâneas × 5 rodadas. **(a) Confirmado (5/5):** cinco devoluções totais da mesma venda aceitas, 10 unidades devolvidas de 2 vendidas. O cenário usa venda legada (sem `engine` nem retorno simbólico); na cadeia completa o estorno FIFO trava a linha do item, mas não há nova checagem do que resta devolver depois da espera, então o resultado esperado é o mesmo (não testado). **(b) Refutado (5/5):** só um retorno físico passa; os outros falham com "Saldo de remessa insuficiente" porque o débito do saldo da remessa serializa as transações e relê o saldo. **(c) Confirmado (5/5):** três conferências de "recebido 7 de 10" aceitas em cada rodada, cada uma emitindo uma nota de diferença de 3 (9 unidades baixadas para uma divergência de 3); as outras duas falham por saldo.
- **FDOC-8 · Baixa · Rotas de leitura sem papel e sem validação de query.** `audit-logs`, `fiscal-events`, `timeline` e o export `cenarios-fiscais.xlsx` ficam abertos a qualquer membro (S-10) e devolvem tudo do tenant (P-4). Os endpoints `GET :chave/xml` e `fiscal-events/:id/xml` usam `@Query()` sem `ZodValidationPipe`, contra a regra do projeto.
- **FDOC-9 · Baixa · Valor da devolução por divisão em ponto flutuante.** `physical-return.usecase.ts` e `inbound-conference.usecase.ts` calculam `unitValue = valor / quantidade` e depois `unitValue * quantity`; com `quantidade = 3` e `valor = 10,00` o total refeito pode divergir em centavos do total da remessa. Ver TAX-2. Ambos fazem `tx as unknown as Parameters<typeof prepareRemessaFifoForOperation>[0]`, um cast que esconde a incompatibilidade de tipos entre `PrismaTx` e o parâmetro da função.
- Referências: B-1 (`observability.controller.ts` com Prisma no controller), P-4 (`audit-logs`, eventos e timeline sem paginação), P-5 (escrita em `GET` no detalhe da remessa), S-10.

### 6.8 `fiscal-settings`

- **FSET-1 · Média (verificar) · Configuração aceita como JSON livre.** `update-emitter-settings.request.dto.ts` e o do marketplace validam `basic`, `taxes` e `nfe` como `z.record(z.string(), z.unknown())`. O emissor lê esses campos ao montar o XML; um valor de tipo errado só aparece na emissão (500 ou XML inválido). Confirmar se `rules/` revalida antes de gravar; se não, usar schema Zod por seção.
- **FSET-2 · Baixa · Alteração de configuração fiscal sem trilha** em `audit_logs` (quem mudou série, prazo de cancelamento, CFOP padrão e quando).
- Cobertura: 1 spec para 1,1 mil linhas, incluindo os defaults de 300 linhas em `fiscal-emitter-settings-defaults.ts`.

### 6.9 `fiscal-validation`

Os `fetch` ao validador usam `AbortSignal.timeout` (única área que faz isso; ver P-7 para as demais).

- **FVAL-1 · Média (verificar) · A revalidação assíncrona pós-commit provavelmente não dispara em rota HTTP.** `runFiscalTransaction` só chama `fiscalTransactionCommitHook` quando **ele** abre a transação (`prisma-tx.ts`); numa requisição `@ProtectedApi()` já existe a transação do interceptor e a função devolve pelo ramo `existingTx`, sem hook. As NF-e ficam `PENDING` até o admin chamar `POST /fiscal-validation/backfill`. E, nos casos em que o hook roda, ele recebe o `db` raiz sem `set_config`, então a RLS devolve zero linhas. Confirmar com um teste que emite uma nota e espera a mudança de status.
  > **Verificação 2026-11-11:** Confirmado. Evidência: `docs/superpowers/audit-repro/fval1-commit-hook.ts`. Dentro de `runWithDbContext` (o caminho de toda rota `@ProtectedApi()`), `runFiscalTransaction` segue pelo ramo `existingTx` e o hook é chamado **0 vezes**; nenhum outro ponto do backend dispara o hook (busca por `CommitHook`). Fora de request o hook é chamado, mas recebe o cliente raiz: com o papel sem `BYPASSRLS`, `nFe.count` desse cliente devolve 0 para um tenant com 1 NF-e, e `NfeValidationBackfillUseCase.execute` consulta com esse `db` sem abrir contexto de tenant. Em produção a revalidação automática não roda; só o `POST /fiscal-validation/backfill` manual. (Se o papel de produção tiver `BYPASSRLS`, ver S-2, o segundo ponto some.)
- **FVAL-2 · Média · `backfill` chama o validador em série dentro da transação HTTP.** Até 200 NF-e × `VALIDATE_TIMEOUT_MS` cada, mais um `update` por nota, segurando uma conexão do pool (P-3). Mover para job fora da transação, com concorrência limitada.
- **FVAL-3 · Baixa (verificar) · Tráfego para o validador.** `FISCAL_VALIDATOR_URL` aceita `http://` e o padrão é `http://localhost:8080`; o XML autorizado do tenant segue em texto claro, e não vi cabeçalho de autenticação. Aceitável na rede privada do Render; documentar e exigir `https://` ou token em produção.

### 6.10 `logistics`

- **LOG-1 · Alta · A tabela `unidades_logisticas` é global e qualquer ADMIN de qualquer empresa a altera.** O modelo não tem `tenant_id` nem RLS (os CDs são compartilhados por marketplace), mas o `bulk-import` do `LogisticsUnitController` (`@AdminOnly()` exige só ADMIN do próprio tenant) faz `unidadeLogistica.update` por CNPJ: troca `codigo`, `nome`, `ie`, endereço, `idCadIntTran` e **reativa** (`ativa: true`) o CD para todos os tenants, e pode criar CDs falsos. Uma empresa corrompe a base de destino de remessa de todas as outras (e do destinatário fiscal que sai no XML). Restringir o import a um papel de plataforma, ou gravar só no vínculo `tenant_unidades_logisticas` (cópia por tenant).
- **LOG-2 · Média · `PATCH :id/padrao` do mesmo controller sem `@AdminOnly()`:** qualquer membro troca o CD padrão que define o destino de todas as remessas.
- **LOG-3 · Média · Importação sem teto e com chamadas externas em série.** `rows` não tem `.max()`; `enrichCep` é `true` por padrão e faz uma consulta de CEP por CNPJ (BrasilAPI/ViaCEP, sem timeout, LKP-1) dentro da transação da rota.
- **LOG-4 · Baixa · `findByIdForTenant` devolve qualquer unidade por `id`**, sem exigir vínculo com o tenant (dado semipúblico; só leitura).
- **LOG-5 · Baixa (verificar) · `movimentacoes-produto`** cresce a cada operação. A listagem já tem teto (`limit` até 200, padrão 100), então o risco é só custo do `include` de 4 relações.
- **LOG-6 · Baixa · `product-movement`.** `ProductMovementRepository.register(data, db?: unknown)` faz `(db ?? getDbClient()) as PrismaClient | PrismaTx`, o que desliga a checagem de tipo do chamador. `product-lookup.queries.ts` repete `findProductInTenant` que já existe como método privado de `AdvanceProductResolver`. `hasStockForAdvance` e `findFifoProductIdWithSaldo` fazem uma consulta por candidato em laço.

### 6.11 `lookup`

- **LKP-1 · Média · `fetch` sem timeout** em `cnpj-lookup.provider.ts` e `cep-lookup.provider.ts` (P-7): com BrasilAPI lenta a requisição fica pendurada por minutos; o fallback para OpenCNPJ só entra em erro, não em lentidão.
- **LKP-2 · Média · Rota de consulta aberta a usuário sem empresa** (`@AuthenticatedApi()`) com 30/min por IP (em memória, S-3/P-6): dá para enumerar CNPJs e usar o servidor como relay; se a BrasilAPI bloquear o IP de saída por abuso (403/429), **todos** os tenants perdem o autopreenchimento. Cache por CNPJ/CEP (TTL de horas) e limite por usuário resolvem a maior parte.
- **LKP-3 · Baixa · Sem cache** nem deduplicação de consultas idênticas em voo.

### 6.12 `marketplace`

Sem achados. `GET /marketplaces` devolve uma lista estática do perfil fiscal para qualquer membro autenticado, sem entrada do usuário.

### 6.13 `health`

Sem achados além do S-8 (endpoint público que toca o banco, sem rate limit).

### 6.14 `packages/fiscal-core` e `packages/nfe-xml`

Escopo lido: `xml-signature.ts`, `xml-serializer.ts`, `simulation-credentials.ts` (só a estrutura, sem reproduzir a chave), o escape do XML de inutilização, o `package.json` dos dois pacotes e a lista de testes. O cálculo e os builders (`venda.builder.ts`, `icms.resolver.ts`, `cte-template.ts`) foram vistos por amostragem; não revisei a correção fiscal das regras.

- **PKG-1 · Baixa (informativo) · Chave privada de simulação no repositório.** `simulation-credentials.ts` embute certificado e chave privada autoassinados, documentados como "sem valor fiscal". É intencional e não é segredo, mas (a) varredores de segredo vão acusar o arquivo, então registre uma exceção explícita (B-10), e (b) nada impede que alguém troque esse conteúdo por um certificado real. Um teste que fixe o fingerprint do certificado embutido, e uma linha no README, evitam o acidente. A assinatura é RSA-SHA1 porque o layout 4.00 exige, não é um defeito.
- **PKG-2 · Baixa · `injectSimulationSignature` corrompe o XML quando o texto contém `$&`, `` $` `` ou `$'`.** A função faz `stripped.replace(signedElementXml, signedElementXml + glue)`: `String.replace` com string como pesquisa interpreta esses padrões no texto de substituição, e o substituto contém o próprio elemento assinado, com texto do usuário (`xProd`, `infCpl`, `xJust`). Reproduzi o mecanismo em Node: `"aZ".replace("a", "a$'b")` devolve `"aZbZ"`. Um nome de produto como `Kit $'` quebra o XML e a assinatura. Corrigir usando função: `.replace(signedElementXml, () => ...)`.
  > **Verificação 2026-11-11:** Confirmado. Evidência: `docs/superpowers/audit-repro/pkg-xml.ts`, com o `buildProcInutNFeXML` real do backend. `xJust` comum: assinatura válida e XML bem-formado. `xJust` com `$'`: **XML malformado** ("Opening and ending tag mismatch") e assinatura inválida. `xJust` com `$&`: XML bem-formado, mas com o elemento assinado duplicado e **assinatura inválida**. A justificativa vem do usuário (cancelamento e inutilização), assim como `xProd` e `infCpl` nas outras notas.
- **PKG-3 · Baixa · Quatro escapadores de XML diferentes e caracteres de controle.** Há `escapeXml` em `fiscal-core/src/xml-serializer.ts`, outra cópia em `nfe-xml/src/core/xml-serializer.ts` e um `xmlEscape` próprio em `inutilizacao-xml.ts` (sem aspas). Nenhum remove caracteres proibidos em XML 1.0 (`\u0000` a `\u0008`, `\u000B`, `\u000C`, `\u000E` a `\u001F`): um texto colado de planilha com `\u0001` gera XML malformado. Unificar numa função e remover esses caracteres.
  > **Verificação 2026-11-11:** Confirmado com parser estrito. Evidência: `docs/superpowers/audit-repro/pkg-xml.ts` e `pkg3-expat.py`. `serializeXmlObject` grava `\u0001` em `xProd` sem remover. O `@xmldom/xmldom` aceita o resultado (é leniente), mas o expat, o mesmo parser do proxy de validação, recusa com "not well-formed (invalid token)", e a SEFAZ também recusaria.
- **PKG-4 · Baixa (verificar) · `tpAmb` fixo em `1` (produção) no XML de inutilização.** O README diz homologação. Conferir se as demais notas usam `tenant.ambiente` e se a inutilização devia fazer o mesmo.
  > **Verificação 2026-11-11:** Confirmado por leitura. NF-e e CT-e saem com `tpAmb` 2, homologação (`nfe-xml/src/builders/nodes/ide.node.ts:42`, `auxiliary.node.ts:36`, `fiscal-core/src/cte-xml/cte-ide.node.ts:41` e `cte-prot.node.ts:26`), mas o evento de cancelamento (`nfe-xml/src/core/proc-evento.builder.ts:34`, duas vezes) e a inutilização (`inutilizacao-xml.ts`) gravam `<tpAmb>1</tpAmb>`, produção. Os XMLs de um mesmo simulador declaram ambientes diferentes.
- **PKG-5 · Baixa · Testes dos pacotes listados à mão.** O script `test` de cada `package.json` enumera os arquivos `.test.ts`. Um teste novo fora da lista não roda nem no CI, sem aviso. Usar glob (`node --test "src/**/*.test.ts"`).
- **PKG-6 · Baixa (verificar) · `@xmldom/xmldom` declarado em `dependencies` do `fiscal-core` sem uso em código de produção.** Busquei `DOMParser`/`xmldom` em `backend/src`, `packages/*/src` e `frontend/src` fora de testes e não achei. Se só os testes usam, mover para `devDependencies` e reduzir a superfície. Não rodei `pnpm audit` (ver seção 8).

- **PKG-7 · Baixa · Terceiro jeito de arredondar, no caminho legado da venda.** `venda.builder.ts:186-191`, quando a nota não tem `engine`, recalcula IPI, PIS, COFINS e `vNF` com `Math.round(x * 100) / 100`, diferente do `round2` do motor (TAX-2) e com o mesmo problema de ponto flutuante. Só afeta vendas antigas sem `engine`.
- **PKG-8 · Baixa · `throw new Error` em `remessa.builder.ts:316`** para `remessaSimbolicaPosDevolucao` inválido: no backend vira 500 genérico em vez de erro de negócio com mensagem.
- **Leitura dos builders (Tarefa 18 do plano de verificação):** li com checklist `venda.builder.ts`, `remessa.builder.ts`, `icms.resolver.ts`, `fiscal-xml.util.ts`, `proc-evento.builder.ts` e `cte-template.ts` (2.068 linhas). Sem `Math.random`/`Date.now` em identificador, sem ramo `marketplace === "..."`. Texto do usuário interpolado em template (`xJust` do cancelamento, `xNome`, `xEnder`, `xMun`, `xCpl`) passa por escape. Mas `fiscal-xml.util.ts:38` tem **um quarto escapador** próprio (ver PKG-3), e o evento de cancelamento também é assinado por `injectSimulationSignature`, então o PKG-2 vale para a justificativa do cancelamento.

### 6.15 `frontend` (Next.js 16)

Escopo lido: `proxy.ts`, `next.config.mts` (cabeçalhos), BFF (`api/bff`, `bff-path.ts`, `bff-proxy.ts`), cookies e sessão (`lib/auth/*`), `highlight-xml.ts` e a busca por `dangerouslySetInnerHTML`. Os componentes de formulário e página não foram lidos. Pontos bons: cookies `httpOnly`, `sameSite=strict` e `secure` em produção; BFF só aceita `GET` e só prefixos permitidos; o realce de XML gera tokens de texto (sem `innerHTML`); o único `dangerouslySetInnerHTML` é o CSS do `chart.tsx` do shadcn, sem entrada do usuário.

- **FE-1 · Média · CSP com `script-src 'unsafe-inline'` em produção.** `next.config.mts` libera scripts inline para todos, o que anula a maior parte da proteção da CSP contra XSS. O Next 16 aceita nonce gerado no `proxy.ts`. O restante da política (`object-src 'none'`, `frame-src` restrito, `base-uri 'self'`) está bom. Os tokens estão em cookie `httpOnly`, então um XSS não os lê, mas ainda age como o usuário.
- **FE-2 · Média (verificar) · Renovação do refresh token depende de a API aceitar reuso.** `proxy.ts` renova a sessão quando falta o `access_token`, e várias requisições paralelas (RSC, prefetch) podem enviar o mesmo refresh antes de o cookie novo voltar. Hoje funciona porque o backend não detecta reuso (S-6). Ao corrigir o S-6, esse fluxo passa a derrubar sessões válidas; a correção precisa vir junto de um mutex por refresh (ou janela de tolerância no backend). Há ainda um caminho no `resolveAuthSession` (`lib/auth/session.ts`) que renova o token "só para esta requisição" sem gravar os cookies novos: com rotação, o refresh antigo fica revogado e a navegação seguinte cai no login. Acontece na fronteira em que o cookie de acesso (30 min) e o JWT (30 min) expiram juntos.
- **FE-3 · Baixa (verificar) · Lista de prefixos do BFF não normaliza o caminho.** `assertAllowedBffPath` usa `startsWith("nfes/")` em `pathSegments.join("/")`, e `apiUrl` monta a URL com `new URL`, que resolve `..`. Um segmento `..` (`nfes/../auth/me`) passaria na lista e o BFF encaminharia um `GET` autenticado para qualquer rota do backend. Quem faz isso já tem o próprio token e o backend aplica a autorização, então o impacto é só contornar a lista de permissões. Falta confirmar se o roteador do Next entrega o `..` ao handler. Corrigir rejeitando segmentos `.`, `..` e com `%`, `\`, ou validando cada segmento com regex.
  > **Verificação 2026-11-11:** Confirmado. Evidência: `docs/superpowers/audit-repro/fe3-bff-path.sh` (Next dev real, API falsa que registra o caminho). `GET /api/bff/nfes/..%2fauth%2fme` respondeu 200 e **chegou ao backend como `/api/auth/me`**, com o `Authorization` do usuário: o Next decodifica `%2f` dentro de um segmento, `assertAllowedBffPath` aceita `nfes/../auth/me` e `new URL` resolve o `..`. As variantes `nfes/../auth/me` e `nfes/%2e%2e/auth/me` são normalizadas antes do handler e caem na lista de permissões, mas com **500** (o `throw new Error` de `assertAllowedBffPath` não é tratado) em vez de 400 ou 404. O impacto continua limitado: é o token do próprio usuário e o backend aplica a autorização.
- **FE-4 · Baixa · Limites e cache desalinhados.** `serverActions.bodySizeLimit` é 10 MB e o backend aceita 15 MB (`UPLOAD_LIMITS`), então uma planilha de 12 MB falha só no front. O BFF repassa o `Cache-Control` do backend, e o XML sai com `private, max-age=3600` (FDOC-5).

- **FE-5 · Alta · Login, cadastro, reset e 2FA chegam ao backend com o IP do servidor do frontend.** As Server Actions (`lib/auth/actions/credentials.ts`) chamam `postAuthJson` (`lib/auth/api/client.ts`), que faz `fetch` de servidor para servidor sem repassar `X-Forwarded-For`; no compose, `API_URL=http://backend:3001`. O limite de `POST /api/auth/login` é por IP (10 por 15 min, com `ban`), então **todos os usuários dividem um único balde**. Quem errar 10 senhas, ou um script que chame a Server Action, bloqueia o login de todo mundo por 15 minutos. O mesmo vale para cadastro (5 por hora), reset (5 por hora) e 2FA. O IP de sessão e o `remoteip` do Turnstile também ficam errados.
  > **Verificação 2026-11-11:** Confirmado. Evidência: `docs/superpowers/audit-repro/fe5-shared-ip-ratelimit.ts` (`buildApp` real, Prisma falso). Doze logins de usuários distintos com o mesmo `remoteAddress`: os 10 primeiros recebem 401 (credencial inválida) e o 11º e o 12º recebem **403 "Rate limit exceeded, retry in 15 minutes"**. Corrigir repassando o IP do cliente (cabeçalho assinado ou `X-Forwarded-For` aceito só da rede do frontend) e trocando a chave do limite de login por IP + e-mail.
- **FE-6 · Baixa · Server Action que devolve o access token ao navegador.** `lib/auth/actions/access-token.ts` exporta `getAccessTokenForClient` (arquivo `"use server"`), que lê o cookie `httpOnly` e devolve o token ao cliente. Hoje nenhum componente a importa (busquei no `frontend/src`), então o Next não a expõe, mas um import futuro anula a proteção do `httpOnly`: um XSS passa a levar o token para fora. Apagar o arquivo.
- **Varredura de componentes (Tarefa 17 do plano de verificação):** busquei `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`, `window.open`, `localStorage`, `sessionStorage`, `document.cookie`, `target="_blank"` sem `rel`, `href` com dado dinâmico, `fetch` com URL montada, uso do parâmetro `from` e variáveis `NEXT_PUBLIC_` em `frontend/src` (323 arquivos). Todas as ocorrências são benignas: CSS do `chart.tsx` (shadcn), cookie de estado do `sidebar.tsx`, tema em `localStorage`, `window.open` de um `Blob` XML gerado pelo backend com `noopener`, `href` só com rotas internas e `otpauth://`. O `from` que o `proxy.ts` grava não é lido em lugar nenhum (sem redirecionamento aberto). As variáveis públicas são só `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Não li linha a linha os 10 maiores componentes de formulário; a busca cobre os sinks, não a lógica.

### 6.16 `infra` (Docker, CI/CD e proxy de validação)

Escopo lido: `backend.Dockerfile`, `frontend.Dockerfile`, `docker-compose.prod.yml`, `ci.yml`, `docker-publish.yml` e o proxy Python inteiro (`main.py`, `nfe_xml_context.py`, `validate_nfe_full_runner.py`, `cep_lookup.py`, `Dockerfile`). Os checks de `audit.py` e `mcp_nfe_extended_checks.py` são regra fiscal e só tiveram a busca por parsers de XML.

- **INF-1 · Alta (verificar) · O compose publica a porta do backend em todas as interfaces, e o backend confia em `X-Forwarded-For` sempre (S-3).** `ports: "${BACKEND_PORT:-5001}:3001"` escuta em `0.0.0.0`. O comentário diz que um proxy compartilhado da infra fica na frente, mas se a porta 5001 for alcançável sem passar por ele, qualquer cliente envia `X-Forwarded-For` forjado e escapa do rate limit por IP (e do lockout, que usa o IP). Publicar em `127.0.0.1:${BACKEND_PORT:-5001}:3001` (se o proxy roda no mesmo host) ou fechar a porta no firewall/security group. Verificar a regra de rede real, que está fora do repositório.
  > **Verificação 2026-11-11:** Inconclusivo (depende do servidor de produção, fora do repositório). Nada foi executado contra o servidor. Para fechar: (1) de uma rede externa, `curl -sS -o /dev/null -w '%{http_code}' http://<host-de-produção>:5001/api/health`; qualquer resposta HTTP confirma que a porta está aberta fora do proxy compartilhado. (2) O proxy compartilhado sobrescreve `X-Forwarded-For` ou só acrescenta? Se só acrescentar, o backend (`trustProxy` sempre ligado, S-3) usa o primeiro valor, que o cliente controla, mesmo passando pelo proxy.
- **INF-2 · Média (verificar) · Proxy de validação sem autenticação, sem limite de corpo e sem rate limit.** `POST /api/v1/validate-nfe` e `/api/v1/audit-nfe` aceitam qualquer XML de qualquer chamador, gravam em arquivo temporário e executam o validador; o corpo só tem `min_length=1`. A imagem escuta em `0.0.0.0`. Se o serviço estiver fora de rede privada, vira ferramenta de DoS (XML grande, parser duplo) e de abuso. Colocar um token compartilhado (`Authorization`), `max` no `xml` e limite de tamanho no uvicorn. Ver FVAL-3.
- **INF-3 · Média (verificar) · A recusa de DOCTYPE do commit `58bbf98` não cobre a primeira leitura do XML.** `run_validate_nfe_full` grava o XML no arquivo e chama `validate_nfe_full(path)`, da biblioteca `mcp-fiscal-brasil`, **antes** de qualquer `safe_fromstring`; o guarda só entra depois, em `enrich_validate_nfe_full_payload`, `apply_mcp_extended_checks` e `audit`. Se o parser da biblioteca expande entidades, o XML malicioso já foi processado. Chamar `safe_fromstring(xml.encode())` logo na entrada de `validate_nfe` e `audit_nfe` e devolver 400. Não li o código da biblioteca; confirmar com um XML de teste com entidades aninhadas.
  > **Verificação 2026-11-11:** Refutado no impacto (a ordem se confirma, o risco não). Evidência: `docs/superpowers/audit-repro/inf3-doctype.py` com `mcp-fiscal-brasil==0.5.1` instalado. `validate_nfe_full` de fato lê o XML antes de qualquer `safe_fromstring`, mas o parser da biblioteca (`shared/xml_utils.py`) é lxml com `resolve_entities=False`, `load_dtd=False` e `no_network=True`. Entidade externa (`SYSTEM "file:///etc/hosts"`): não resolvida, o conteúdo do arquivo não aparece. Bomba de entidades (5 níveis × 10): o libxml2 recusa com "Maximum entity amplification factor exceeded" em 0,08 s. Sobra um ponto Baixo: essa `XMLParseError` não é tratada em `run_validate_nfe_full` e vira 500 em vez de 400. Severidade revista para Baixa.
- **INF-4 · Média · A imagem do backend roda `pnpm db:migrate:deploy` em todo start.** `CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/index.js"]`. Toda subida de contêiner (deploy, reinício, escala) aplica migrations em produção sem etapa de aprovação, e uma migration que falha derruba o serviço em loop de reinício. Com mais de uma réplica o Prisma usa lock, então não há corrida, mas o gate continua ausente. Separar num passo de pré-deploy (job único) e subir a API só com `node dist/index.js`.
- **INF-5 · Média · Publicação da imagem não depende do CI.** `docker-publish.yml` dispara em `push` para `main` e publica `:latest` e `:<sha>`; o `ci.yml` é outro workflow, sem `needs` nem `workflow_run`. O compose usa `pull_policy: always` com `latest`. Um commit que quebra lint ou testes chega a produção no próximo `pull`. Exigir o CI verde (`workflow_run` com `conclusion == success`, ou um job `needs`) e preferir `IMAGE_TAG` com o SHA no deploy. As ações usam tag móvel (`@v4`, `@v6`) em vez de SHA, e não há assinatura, SBOM nem scan da imagem (B-10).
- **INF-6 · Baixa · Imagens sem usuário não-root e versões desalinhadas.** O backend usa `node:20-alpine` e o frontend `node:24-alpine`; nenhum define `USER`. O proxy Python (`python:3.12-slim-bookworm`) também roda como root e fixa só `mcp-fiscal-brasil==0.5.1`; as dependências transitivas não têm lockfile nem hash. O proxy não é construído por nenhum workflow deste repositório (deploy fora do CI, no Render).
- **INF-7 · Baixa · Testes Python fora do CI.** Há `test_*.py` no proxy, mas `ci.yml` não roda `pytest` (busquei `pytest` e `python` no arquivo). A correção do `58bbf98` e as regras de auditoria ficam sem rede de segurança automática.

- **INF-8 · Baixa · `audit.py:144-145` engole erro de conversão.** `except ValueError: pass` deixa `v_bc`, `v_icms` e `p_icms` em zero quando o XML traz número malformado; a auditoria segue e acusa (ou deixa de acusar) diferença de alíquota com base em zero, sem dizer que o campo era ilegível. Vários `except Exception as exc` devolvem `str(exc)` no texto do achado, o que expõe detalhe interno do proxy ao chamador.
- **Leitura do código Python de auditoria (Tarefa 19 do plano de verificação):** li com checklist `audit.py`, `mcp_nfe_extended_checks.py`, `validate_nfe_full_response.py` e `catalog_helpers.py`. Sem `subprocess`, sem caminho de arquivo vindo do XML (só `tempfile`), e as regex são simples, sem backtracking catastrófico. As consultas por item (CFOP, NCM, CEST, CST) usam tabelas locais da biblioteca (`tabelas/tools.py` não usa `httpx`), então não há amplificação por item. As chamadas de rede são uma por NF-e (CEP com `timeout=30` em `asyncio.to_thread`, municípios IBGE, alíquota interestadual e CNPJ dentro de `validate_nfe_full`).

### 6.17 Cobertura de filtro por tenant (varredura)

> **Verificação 2026-11-11:** varredura feita. Evidência: `docs/superpowers/audit-repro/tenant-filter-sweep.py` e a saída em `tenant-filter-sweep.md`; a lista de tabelas com RLS vem do banco do harness com todas as migrations aplicadas (`pg_class.relrowsecurity`, 15 tabelas). O Graphify lista 48 chamadores de `getDbClient`.

Das 225 chamadas Prisma de leitura e escrita em `backend/src` (fora de testes), 105 não citam `tenantId` no `where`. Destas, 48 batem em tabela com RLS, onde a política filtra. As outras 57 batem em tabela sem RLS e se dividem assim:

| Grupo | Chamadas | Avaliação |
|---|---|---|
| Autenticação (`users`, `user_sessions`, tokens de reset e de verificação) e `tenants` | 37 (33 + 4) | Fora da RLS por desenho (`ARCHITECTURE.md`, seção 8). A chave vem do JWT ou do hash de um token aleatório; sem achado novo. As escritas por `id` em `member.repository.ts` e `tenant.repository.ts` são o ORG-2. |
| `unidades_logisticas` (tabela global) | 14 | Leitura por `id`, código ou CNPJ é aceitável para dado compartilhado; a escrita em `logistics-unit.repository.ts:272` é o LOG-1. |
| `pedido_itens` e `nfe_remessa_consumos` (S-1) | 6 | Todas usam uma chave que veio de uma linha já filtrada pela RLS: `pedidoId` de pedido do tenant, `retornoNfeId` de NF-e do tenant, ou o filtro de relação `pedido: { status }`, que passa pela RLS de `pedidos`. **Nenhum caminho atual expõe linha de outro tenant**; o S-1 é falta de defesa em profundidade, não vazamento ativo. |

---

## 7. Ordem sugerida de correção

| Ordem | Item | Esforço | Por quê primeiro |
|---|---|---|---|
| 1 | S-2 (confirmar papel do banco) | Baixo | Uma consulta SQL decide se a RLS existe de fato |
| 1 | LOG-1 (import global de CDs por qualquer ADMIN) | Baixo a médio | Uma empresa corrompe dado de todas as outras |
| 2 | S-3 (`trustProxy`) e INF-1 (porta 5001 publicada) | Baixo | Uma linha cada; sem o INF-1, o S-3 é explorável de fora |
| 2 | INF-3 (guarda de DTD antes do parse do MCP) e INF-2 (token no proxy Python) | Baixo | Fecha a lacuna deixada pelo commit `58bbf98` |
| 3 | P-1 (auth fora da transação, timeout no Turnstile) | Médio | Remove um vetor de indisponibilidade total |
| 4 | S-4 (2FA) e S-5 (contador atômico) | Médio | Fecha o caminho de força bruta com senha vazada |
| 4 | SAL-1, FDOC-1, FDOC-7, REM-1 (faturar, cancelar, devolver e debitar FIFO de forma atômica) | Médio | Notas duplicadas e saldo de estoque errado no simulador |
| 5 | S-1 (RLS nas duas tabelas filhas), ORG-1, LOG-2 | Médio | Migration + backfill; dois `@AdminOnly()` faltando |
| 6 | P-2 e P-3 (guard no pool, timeout de transação) | Médio | Ganho de latência e de capacidade do pool |
| 7 | S-6 (junto com FE-2), S-7, S-8, S-9, CAT-1 a CAT-4, FVAL-1, TAX-2, INF-4, INF-5, FE-1 | Baixo a médio | Endurecimento, correção de comportamento e pipeline de deploy |
| 8 | P-4 (paginação) | Alto | Muda contrato com o frontend; planejar |
| 9 | B-4 (teste de integração com RLS) | Alto | Evita regressão de S-1 e S-2 depois |
| 10 | Demais itens | Baixo | Higiene |

## 8. Pendências que esta revisão não cobriu

- Leitura linha a linha: componentes e páginas do `frontend` (só `proxy.ts`, BFF, sessão e cabeçalhos), os builders e resolvers de `nfe-xml` (`venda.builder.ts`, `icms.resolver.ts` etc.), `cte-template.ts`, `audit.py` e `mcp_nfe_extended_checks.py` (regra fiscal), `timeline.service.ts` (só os padrões de consulta), `fiscal-document.mapper.ts`, `inbound-conference.emitter.ts` e `tax-calculation.ts`. A **correção das regras fiscais** (CST, CFOP, alíquotas) não foi avaliada, só segurança, concorrência e desempenho.
- O filtro por `tenantId` foi confirmado apenas nos repositories citados na seção 6.
- Biblioteca `mcp-fiscal-brasil` 0.5.1: não li o código; o INF-3 depende de como ela interpreta o XML.
- Achados de concorrência (SAL-1, FDOC-1, FDOC-7, REM-1, CAT-1, FVAL-1) vêm de leitura: cada um precisa de um teste de integração contra Postgres que o reproduza antes da correção.
- Regras de rede e firewall do servidor de produção (INF-1), configuração do Render e do proxy compartilhado: fora do repositório.
- `pnpm audit`, `pip-audit` e verificação de versões das dependências.
- Comportamento sob carga (nenhum teste de carga foi rodado) e a execução de qualquer teste ou build.
