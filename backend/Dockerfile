# NestJS + Prisma multi-tenant para Ropas.
# Build con pnpm, runtime slim, sin chromium ni dependencias nativas extra.

# -------- Stage 1: builder --------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma/ ./prisma/
RUN pnpm install --frozen-lockfile

COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
RUN pnpm prisma generate
RUN pnpm build

RUN pnpm prune --prod

# -------- Stage 2: runtime --------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      dumb-init tzdata openssl ca-certificates \
    && cp /usr/share/zoneinfo/America/Lima /etc/localtime \
    && echo "America/Lima" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV TZ=America/Lima
ENV PORT=3001

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["dumb-init", "node", "dist/main.js"]
