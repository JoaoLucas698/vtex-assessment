# syntax=docker/dockerfile:1
# Contexto de build: raiz do repositório (precisa de database/catalog.db e database/fixtures).

FROM node:26-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./
COPY backend/src ./src
RUN npx prisma generate && npm run build

FROM node:26-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/catalog.db \
    SEED_DB_PATH=/app/database/catalog.db
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma
# Dependências de produção + CLI do Prisma (precisa do `migrate` no entrypoint).
RUN npm ci --omit=dev --ignore-scripts \
    && PRISMA_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
    && npm install --no-save --no-package-lock --ignore-scripts "prisma@${PRISMA_VERSION}" \
    && npx prisma generate \
    && npm cache clean --force
COPY --from=build /app/backend/dist ./dist
# Banco original, só leitura: o entrypoint copia para o volume e nunca altera este arquivo.
COPY database/catalog.db /app/database/catalog.db
COPY database/fixtures /app/database/fixtures
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]