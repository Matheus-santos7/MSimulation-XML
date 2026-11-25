# Deploy no servidor Linux do cliente

O servidor não recebe o código do projeto. O GitHub Actions builda as imagens e publica no
ghcr.io; o servidor tem só um arquivo, `docker-compose.yml` (modelo em
`infra/docker/docker-compose.yml`), e roda `docker compose pull` + `up`.

| Serviço | Imagem | Porta no host |
|---|---|---|
| `frontend` | `ghcr.io/matheus-santos7/msimulation-xml-frontend` | 5000 |
| `backend` | `ghcr.io/matheus-santos7/msimulation-xml-backend` | 5001 |
| `fiscal-validator` | `ghcr.io/matheus-santos7/msimulation-xml-fiscal-validator` | interna |
| `redis` | `redis:7-alpine` (rate limit) | interna |

TLS e domínio ficam no proxy da infra: `app.msimulation-xml.nerus.com.br` → 5000 e
`api.msimulation-xml.nerus.com.br` → 5001. Confirme com a infra que 5000/5001 só são
alcançáveis pelo proxy.

## Lançar uma versão (no repositório)

```bash
git switch main && git pull
git tag v1.4.0
git push origin v1.4.0
```

O workflow `.github/workflows/docker-publish.yml` publica `:1.4.0`, `:1.4` e `:latest` das três
imagens. Push em `main` sem tag publica só `:main` e `:sha-<curto>`, sem mexer no `:latest`
que o servidor usa.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` é embutida no bundle do frontend no build. Ela vem da variável
de repositório do GitHub Actions; trocar a chave exige uma nova tag.

## Primeira instalação (no servidor)

1. Autentique no ghcr.io (as imagens são privadas). Gere um token *classic* em
   <https://github.com/settings/tokens> só com `read:packages`:

   ```bash
   echo "<TOKEN>" | docker login ghcr.io -u <usuario-github> --password-stdin
   ```

2. Copie `infra/docker/docker-compose.yml` para o servidor (ex.: `/opt/msimulation/`), preencha
   os valores `change-me` e proteja o arquivo, que guarda os segredos:

   ```bash
   chmod 600 /opt/msimulation/docker-compose.yml
   ```

   - `DATABASE_URL`: papel da API, **sem** `SUPERUSER` nem `BYPASSRLS` (senão a RLS por tenant
     não vale). No Neon, use o endpoint pooled.
   - `MIGRATE_DATABASE_URL`: dono das tabelas, usado só para as migrations no boot. Vazio = usa
     `DATABASE_URL` (só funciona se esse papel puder alterar o schema).
   - `JWT_SECRET`, `PASSWORD_PEPPER`, `TOTP_ENCRYPTION_KEY`: `openssl rand -base64 32`, um
     diferente para cada. O backend não sobe com `change-me`.
   - `BREVO_*`, `TURNSTILE_SECRET_KEY`: obrigatórios em produção.

3. Suba:

   ```bash
   cd /opt/msimulation
   docker compose pull && docker compose up -d
   docker compose logs -f backend
   ```

## Atualizar

```bash
cd /opt/msimulation
docker compose pull && docker compose up -d
```

O backend roda `prisma migrate deploy` no boot. Fixar ou voltar uma versão:

```bash
MSX_VERSION=1.3.2 docker compose up -d
```

## Verificação

```bash
curl -fsS http://127.0.0.1:5001/api/health
curl -fsSI http://127.0.0.1:5000
```

## Migration travada (erro P3009)

O backend fica reiniciando com `P3009` quando uma migration anterior falhou no banco; o Prisma
não reaplica sozinho. Veja nos logs qual migration falhou, corrija a causa e marque-a como
revertida para o próximo boot reaplicar:

```bash
docker compose stop backend
docker compose run --rm backend sh -c \
  'DATABASE_URL="${MIGRATE_DATABASE_URL:-$DATABASE_URL}" pnpm exec prisma migrate resolve --rolled-back <nome_da_migration>'
docker compose up -d backend
```

Para `20261007120000_nfe_tenant_serie_numero_unique`, rode antes a consulta (somente leitura)
abaixo. Se ela devolver linhas, há NF-e duplicada por tenant + série + número: decida com o
fiscal como renumerar ou inutilizar antes de resolver a migration.

```sql
SELECT tenant_id, serie, numero, count(*)
FROM nfes
GROUP BY tenant_id, serie, numero
HAVING count(*) > 1;
```
