# NestJS + Prisma multi-tenant para Ropas.
# Build context = raiz del monorepo (necesita pnpm-workspace.yaml + pnpm-lock.yaml).
# Uso: az acr build --file backend/Dockerfile .
#
# Imagen base parametrizable: en CI pasamos --build-arg NODE_IMAGE apuntando
# al ACR (acrropas.azurecr.io/library/node:22-bookworm-slim, mirror de Node
# importado desde public.ecr.aws/docker/library/node) para evitar el rate
# limit de pulls anonimas de Docker Hub en los agentes de ACR Tasks.
# En build local no hace falta pasar nada — usa Docker Hub por default.
ARG NODE_IMAGE=node:22-bookworm-slim

# -------- Stage 1: builder --------
FROM ${NODE_IMAGE} AS builder
WORKDIR /repo

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Necesario para que pnpm deploy funcione con node-linker isolated.
RUN pnpm config set inject-workspace-packages true

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma

RUN pnpm install --frozen-lockfile --filter "@ropas/backend..."

COPY backend/tsconfig*.json backend/nest-cli.json ./backend/
COPY backend/src ./backend/src

WORKDIR /repo/backend
RUN pnpm prisma generate
RUN pnpm build

# Deploy standalone: node_modules sin symlinks, listo para runtime.
# Nota: pnpm deploy resuelve el target relativo al cwd, asi que usamos /repo/deploy.
WORKDIR /repo
RUN pnpm deploy --filter "@ropas/backend" --prod /repo/deploy

# Regenerar Prisma client en el dir de deploy (pnpm deploy no preserva .prisma generado).
WORKDIR /repo/deploy
RUN ./node_modules/.bin/prisma generate

# -------- Stage 2: runtime --------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      dumb-init tzdata openssl ca-certificates \
    && cp /usr/share/zoneinfo/America/Lima /etc/localtime \
    && echo "America/Lima" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV TZ=America/Lima
ENV PORT=3001

COPY --from=builder /repo/deploy/dist ./dist
COPY --from=builder /repo/deploy/node_modules ./node_modules
COPY --from=builder /repo/deploy/package.json ./
COPY --from=builder /repo/deploy/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('net').createConnection(process.env.PORT||3001,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD ["dumb-init", "node", "dist/main.js"]
