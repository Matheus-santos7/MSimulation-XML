# Segurança — MSimulation XML

## Checklist de deploy (produção)

### Backend (API Fastify)

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` com ≥ 32 caracteres (valor único)
- [ ] `PASSWORD_PEPPER` com ≥ 16 caracteres (distinto do JWT)
- [ ] `DATABASE_URL` apontando para PostgreSQL gerenciado
- [ ] `CORS_ORIGINS` com URL exata do frontend (HTTPS)
- [ ] `APP_PUBLIC_URL` com **HTTPS** (links de e-mail)
- [ ] `RESEND_API_KEY` e `RESEND_FROM_EMAIL` configurados
- [ ] `TURNSTILE_SECRET_KEY` configurado (CAPTCHA no registro)
- [ ] `TRUST_PROXY=true` se atrás de reverse proxy / load balancer
- [ ] TLS terminado no proxy; HSTS habilitado

### Frontend (Next.js / Vercel)

- [ ] `API_URL` apontando para a API (server-only, sem `NEXT_PUBLIC_` quando possível)
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` para widget de registro
- [ ] Headers de segurança via `next.config.ts` (CSP, HSTS, X-Frame-Options)
- [ ] Cookies com `secure` em ambientes HTTPS (Vercel preview incluído)

### Banco de dados

- [ ] Senha forte (não usar defaults do `docker-compose.yml` em produção)
- [ ] Porta 5432 **não** exposta publicamente
- [ ] Migrations aplicadas (`pnpm db:setup` / `prisma migrate deploy`)
- [ ] RLS habilitado nas tabelas de negócio (migration `20260608130000_row_level_security`)
- [ ] Usuário da aplicação **sem** `BYPASSRLS` em produção

## Modelo de ameaças (resumo)

| Ameaça | Mitigação |
|--------|-----------|
| Vazamento cross-tenant | `tenantId` só do JWT; RLS no PostgreSQL; testes de isolamento |
| Conta takeover | HttpOnly cookies, refresh rotativo, 2FA TOTP, lockout de login |
| Registro aberto abusivo | Rate limit, CAPTCHA Turnstile, verificação de e-mail, bloqueio de domínios descartáveis |
| Upload malicioso | Magic bytes XLSX, limite 15 MB, parsing em memória |
| Enumeração de usuários | Respostas genéricas em forgot-password |
| XSS | CSP no frontend, sanitização de IDs em componentes com `dangerouslySetInnerHTML` |
| Privilege escalation | RBAC `ADMIN` / `MEMBER` com guards no backend |

## Resposta a incidentes

1. Revogar sessões afetadas (`tokenVersion` increment / invalidar refresh tokens).
2. Rotacionar `JWT_SECRET`, `PASSWORD_PEPPER` e chaves de API (Resend, Turnstile).
3. Revisar `audit_logs` do tenant impactado.
4. Aplicar patch e redeploy; documentar timeline internamente.

## Variáveis sensíveis

Nunca commitar: `.env`, certificados `.pem`/`.p12`/`.key`, `JWT_SECRET`, `PASSWORD_PEPPER`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`.
