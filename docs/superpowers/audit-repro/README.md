# Reproduções da auditoria do backend

Scripts que verificam os achados de `docs/code-review-backend-2026-11-11.md`. Não entram no build, no lint nem no `pnpm test:backend`.

- `bash harness/up.sh`: sobe o Postgres descartável `audit-pg` (127.0.0.1:55432), aplica as migrations e cria o papel `audit_app` (sem `BYPASSRLS`).
- `bash harness/run.sh <script.ts>`: roda um script com `tsx`, com o dotenv desligado e `DATABASE_URL` local. Nunca usa `backend/.env`.
- `bash harness/down.sh`: remove o contêiner.

Cada script imprime `VEREDITO: <Confirmado|Refutado|Inconclusivo>` e a evidência.
