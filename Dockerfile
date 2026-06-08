FROM node:20-alpine AS build

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
COPY backend ./backend

# Prisma exige DATABASE_URL no build (valor dummy; runtime usa o env do Render).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @msimulation-xml/fiscal-core build \
  && pnpm --filter @msimulation-xml/nfe-xml build \
  && pnpm --filter @msimulation-xml/backend build

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/backend ./backend
COPY --from=build /app/node_modules ./node_modules

WORKDIR /app/backend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/index.js"]
