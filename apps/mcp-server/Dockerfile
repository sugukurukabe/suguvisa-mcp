# ── Stage 1: Build ── (pnpm monorepo)
FROM node:22-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /monorepo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc turbo.json tsconfig.base.json ./
COPY apps/mcp-server/package.json apps/mcp-server/
COPY packages/ packages/

RUN pnpm install --frozen-lockfile

COPY apps/mcp-server/tsconfig.json apps/mcp-server/
COPY apps/mcp-server/src/ apps/mcp-server/src/

# Turbo 経由で依存関係順（@suguvisa/auth → @suguvisa/mcp-server）にビルド
RUN pnpm run build

# ── Stage 2: Production ──
FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/mcp-server/package.json apps/mcp-server/
COPY packages/ packages/

# packages/*/dist もコピー（@suguvisa/auth などのビルド成果物）
COPY --from=builder /monorepo/packages/ packages/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /monorepo/apps/mcp-server/dist apps/mcp-server/dist
COPY apps/mcp-server/public/ apps/mcp-server/public/

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

WORKDIR /app/apps/mcp-server
CMD ["node", "dist/server.js"]
