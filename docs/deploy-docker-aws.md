# Deploy via Docker em servidor Linux (AWS) — backend + frontend + TLS

Stack: `backend` (porta 3001) + `frontend` (porta 3000) + `caddy`
(TLS automático via Let's Encrypt, portas 80/443). Arquivos: `docker-compose.prod.yml`,
`infra/caddy/Caddyfile`. O banco de dados é o Postgres gerenciado (Neon) já usado
pelo Render — não há container de banco neste compose.

As imagens de `backend`/`frontend` **não são buildadas no servidor**: o workflow
`.github/workflows/docker-publish.yml` builda `Dockerfile` e `Dockerfile.frontend`
e publica no GitHub Container Registry (ghcr.io) a cada push em `main` (ou
manualmente via Actions → "Docker publish" → Run workflow). O servidor só faz
`docker compose pull` + `up -d`.

Backend e frontend ficam em subdomínios separados (`api.seudominio.com` /
`app.seudominio.com`), cada um com sua porta interna própria (3001 / 3000). O
Caddy é o único serviço com portas publicadas na internet (80/443); backend e
frontend só expõem suas portas em `127.0.0.1` no host (debug via SSH tunnel) e
se falam entre si pela rede interna do Docker Compose.

## 1. DNS (Route53)

Crie dois registros **A** apontando para o IP (ou Elastic IP) da instância:

| Nome                  | Tipo | Valor         |
| ---------------------- | ---- | ------------- |
| `api.seudominio.com`  | A    | IP do servidor |
| `app.seudominio.com`  | A    | IP do servidor |

## 2. Security Group / firewall da instância

Libere entrada TCP para:

- `80` (HTTP — usado pelo Caddy só para o desafio ACME/renovação de certificado)
- `443` (HTTPS — tráfego real)
- `22` (SSH, administração)

Não é necessário abrir 3000/3001 publicamente — essas portas ficam em loopback.

## 3. Autenticar o servidor no ghcr.io (uma vez)

As imagens ficam privadas por padrão no ghcr.io, mesmo sendo o repositório
público. Gere um Personal Access Token (classic) em
<https://github.com/settings/tokens> com o escopo `read:packages`, depois no
servidor:

```bash
echo "<SEU_TOKEN>" | docker login ghcr.io -u <seu-usuario-github> --password-stdin
```

Isso fica salvo em `~/.docker/config.json` — não precisa repetir a cada deploy.

## 4. No servidor

```bash
git clone <repo> && cd MSimulation-XML
git checkout main   # ou a branch de deploy escolhida

cp .env.prod.example .env.prod
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edite `.env.prod`:

- `API_DOMAIN` / `APP_DOMAIN`: os subdomínios criados no passo 1.
- `ACME_EMAIL`: **e-mail real que você controla** — o Caddy registra conta ACME
  (Let's Encrypt) com ele; deixar o placeholder não impede o funcionamento, mas
  você perde avisos de expiração.
- `IMAGE_TAG`: deixe `latest` (padrão) para sempre pegar a última imagem publicada.

Edite `backend/.env` (produção):

- `DATABASE_URL`: aponte para o mesmo Postgres gerenciado (Neon) usado pelo
  Render — não altere o host para `postgres`, esse serviço não existe neste compose.
- `CORS_ORIGINS=https://app.seudominio.com`
- `APP_PUBLIC_URL=https://app.seudominio.com`
- `JWT_SECRET`, `PASSWORD_PEPPER`, `TOTP_ENCRYPTION_KEY`: gere com `openssl rand -base64 32`.
- Demais variáveis obrigatórias em produção (Brevo, Turnstile) conforme `backend/.env.example`.

Edite `frontend/.env.local` (produção):

- Não precisa de `NEXT_PUBLIC_TURNSTILE_SITE_KEY` aqui — essa chave já foi
  embutida na imagem pelo workflow (via a variável de repositório
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no GitHub Actions). Trocar a chave exige
  reeditar essa variável no GitHub e rodar o workflow de novo, não editar o
  servidor.
- Não é necessário setar `API_URL` aqui — o compose já injeta
  `API_URL=http://backend:3001` (chamada servidor-a-servidor, sem passar pela internet).

## ⚠️ Banco compartilhado com o Render

Este backend aponta pro **mesmo Postgres gerenciado (Neon)** que o Render já usa.
Se o Render continuar rodando ao mesmo tempo que esta stack Docker, os dois
processos vão rodar `prisma migrate deploy` contra a mesma base — normalmente
inofensivo (idempotente), mas evite fazer deploy dos dois lados simultaneamente
em janelas de migration nova. Se a intenção é o Docker **substituir** o Render,
desative o auto-deploy do Render depois que a stack Docker estiver validada.

## Resolvendo uma migration travada (erro P3009)

Se o backend ficar em loop de restart com `Error: P3009` nos logs, uma migration
anterior falhou no banco e o Prisma se recusa a continuar até isso ser resolvido
manualmente — ele **nunca** reaplica ou ignora sozinho.

1. Abra o console do Neon (ou `psql` na `DATABASE_URL`) e rode a query de
   diagnóstico — **somente leitura**, não altera nada:

   ```sql
   SELECT tenant_id, serie, numero, count(*)
   FROM nfes
   GROUP BY tenant_id, serie, numero
   HAVING count(*) > 1;
   ```

2. **Se não retornar nenhuma linha** (sem duplicidade real): a migration falhou
   sem aplicar nada (é um `ALTER TABLE ADD CONSTRAINT` atômico — ou aplica tudo,
   ou nada). É seguro marcar como revertida e deixar o próximo restart do
   container reaplicar:

   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend \
     pnpm exec prisma migrate resolve --rolled-back 20261007120000_nfe_tenant_serie_numero_unique
   ```

   (se o container estiver em loop de restart, use `docker run` com a mesma
   imagem e `DATABASE_URL`, ou pare o restart com `docker compose stop backend`
   antes de rodar o `exec`.)

3. **Se retornar linhas** (há NF-e com mesmo tenant+série+número): isso é um
   problema de dados fiscais real, não só técnico — decida com quem acompanha
   o fiscal como renumerar/inutilizar as duplicatas antes de resolver a
   migration. Não rode o passo 2 até isso estar decidido.

## 5. Subir a stack

```bash
pnpm docker:prod:pull
pnpm docker:prod:up
pnpm docker:prod:logs
```

Na primeira subida, o Caddy emite os certificados automaticamente (requer DNS já
propagado e porta 80 acessível). O backend roda `prisma migrate deploy` no boot
(`CMD` do `Dockerfile`).

## 6. Verificação

```bash
curl -I https://api.seudominio.com/api/health
curl -I https://app.seudominio.com
```

## Atualizando uma versão nova

Cada push em `main` já publica uma imagem `:latest` nova no ghcr.io. No servidor:

```bash
pnpm docker:prod:pull   # baixa a latest mais recente
pnpm docker:prod:up     # recria os containers que mudaram (pull_policy: always)
```

Não precisa de `git pull` no servidor, a menos que `docker-compose.prod.yml`,
o `Caddyfile` ou os `.env.*` tenham mudado.

## Rollback

Toda imagem publicada também fica marcada com o SHA do commit
(`ghcr.io/.../msimulation-xml-backend:<sha>`). Para voltar uma versão, edite
`IMAGE_TAG` em `.env.prod` com o SHA desejado e suba de novo:

```bash
# .env.prod: IMAGE_TAG=<sha-anterior>
pnpm docker:prod:pull
pnpm docker:prod:up
```

## Notas

- `backend` e `frontend` não têm portas públicas; só o `caddy` publica
  80/443. Para depurar um serviço direto, use um túnel SSH para a porta em
  `127.0.0.1` (`BACKEND_PORT`/`FRONTEND_PORT` em `.env.prod`).
- Para adicionar mais variáveis de ambiente de app (Brevo, Turnstile, etc.), edite
  `backend/.env` / `frontend/.env.local` no servidor — eles já são lidos via
  `env_file` no `docker-compose.prod.yml`, sem precisar tocar no compose.
- `NEXT_PUBLIC_*` continua sendo embutido no bundle JS no **build**, só que agora
  esse build é o do GitHub Actions — mudar essas variáveis exige atualizar a
  variável de repositório e rodar o workflow `docker-publish.yml` de novo.
