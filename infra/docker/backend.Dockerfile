FROM node:24-alpine AS build

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY backend ./backend

# Prisma exige DATABASE_URL no build (valor fictício; o runtime usa o env do compose).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @msimulation-xml/fiscal-core build \
  && pnpm --filter @msimulation-xml/nfe-xml build \
  && pnpm --filter @msimulation-xml/backend build \
  && find backend/dist packages/*/dist -name "*.map" -delete

FROM node:24-alpine AS runner

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

# Só o JS compilado, as migrations e as dependências: o código-fonte (src/) não entra na imagem.
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/fiscal-core/package.json ./packages/fiscal-core/
COPY --from=build /app/packages/fiscal-core/dist ./packages/fiscal-core/dist
COPY --from=build /app/packages/fiscal-core/node_modules ./packages/fiscal-core/node_modules
COPY --from=build /app/packages/nfe-xml/package.json ./packages/nfe-xml/
COPY --from=build /app/packages/nfe-xml/dist ./packages/nfe-xml/dist
COPY --from=build /app/packages/nfe-xml/node_modules ./packages/nfe-xml/node_modules
COPY --from=build /app/backend/package.json /app/backend/prisma.config.ts ./backend/
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules ./backend/node_modules

WORKDIR /app/backend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

# Migrations no boot. Com MIGRATE_DATABASE_URL (dono das tabelas), a API roda em DATABASE_URL
# com um papel sem privilégio; sem ela, a mesma URL serve para as duas coisas.
CMD ["sh", "-c", "DATABASE_URL=\"${MIGRATE_DATABASE_URL:-$DATABASE_URL}\" pnpm db:migrate:deploy && node dist/index.js"]
