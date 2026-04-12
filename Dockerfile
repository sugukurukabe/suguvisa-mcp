# ── Stage 1: Build ── (SuguVisa v0.2.0 Dual Plugin)
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production ──
FROM node:22-slim
WORKDIR /app

# 本番 dependencies のみインストール
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ビルド成果物 + データファイル
COPY --from=builder /app/dist ./dist

# OpenAPI spec & GPT plugin静的ファイル
COPY public/ ./public/

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# HTTP サーバーエントリポイント (MCP + REST API + Plugin Meta)
CMD ["node", "dist/server.js"]
