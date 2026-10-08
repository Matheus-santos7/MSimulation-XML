# Deploy via Docker em servidor Linux (AWS) — backend + frontend + TLS

Stack: `postgres` + `backend` (porta 3001) + `frontend` (porta 3000) + `caddy`
(TLS automático via Let's Encrypt, portas 80/443). Arquivos: `docker-compose.prod.yml`,
`Dockerfile` (backend), `Dockerfile.frontend`, `infra/caddy/Caddyfile`.

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

Não é necessário abrir 3000/3001/5432 publicamente — essas portas ficam em loopback.

## 3. No servidor

```bash
git clone <repo> && cd MSimulation-XML
git checkout feat/docker-deploy-aws   # ou a branch de deploy escolhida

cp .env.prod.example .env.prod
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edite `.env.prod`:

- `API_DOMAIN` / `APP_DOMAIN`: os subdomínios criados no passo 1.
- `ACME_EMAIL`: e-mail para o Let's Encrypt.
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`: credenciais do Postgres do container.

Edite `backend/.env` (produção):

- `DATABASE_URL`: use o host `postgres` (nome do serviço no compose), ex.:
  `postgresql://msimulation:msimulation@postgres:5432/msimulation_xml?schema=public`
  (usuário/senha/db iguais aos definidos em `.env.prod`).
- `CORS_ORIGINS=https://app.seudominio.com`
- `APP_PUBLIC_URL=https://app.seudominio.com`
- `JWT_SECRET`, `PASSWORD_PEPPER`, `TOTP_ENCRYPTION_KEY`: gere com `openssl rand -base64 32`.
- Demais variáveis obrigatórias em produção (Brevo, Turnstile) conforme `backend/.env.example`.

Edite `frontend/.env.local` (produção):

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: mesma chave pública do Turnstile.
  (Também precisa estar em `.env.prod` — é embutida no build do frontend, veja abaixo.)
- Não é necessário setar `API_URL` aqui — o compose já injeta
  `API_URL=http://backend:3001` (chamada servidor-a-servidor, sem passar pela internet).

## 4. Subir a stack

```bash
pnpm docker:prod:up
# equivalente a:
# docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

pnpm docker:prod:logs
```

Na primeira subida, o Caddy emite os certificados automaticamente (requer DNS já
propagado e porta 80 acessível). O backend roda `prisma migrate deploy` no boot
(`CMD` do `Dockerfile`).

## 5. Verificação

```bash
curl -I https://api.seudominio.com/api/health
curl -I https://app.seudominio.com
```

## Atualizando uma versão nova

```bash
git pull
pnpm docker:prod:up   # --build reconstrói as imagens alteradas
```

## Rollback

```bash
git checkout <tag-ou-commit-anterior>
pnpm docker:prod:up
```

## Notas

- `NEXT_PUBLIC_*` é embutido no bundle JS no **build**, não dá para trocar só com
  `docker compose restart` — qualquer mudança nessas variáveis exige
  `pnpm docker:prod:up` (rebuild).
- `postgres`, `backend`, `frontend` não têm portas públicas; só o `caddy` publica
  80/443. Para depurar um serviço direto, use um túnel SSH para a porta em
  `127.0.0.1` (`BACKEND_PORT`/`FRONTEND_PORT` em `.env.prod`).
- Para adicionar mais variáveis de ambiente de app (Brevo, Turnstile, etc.), edite
  `backend/.env` / `frontend/.env.local` no servidor — eles já são lidos via
  `env_file` no `docker-compose.prod.yml`, sem precisar tocar no compose.
