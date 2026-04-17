#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────
# SuguVisa MCP — Cloud Run デプロイスクリプト
# ─────────────────────────────────────────────

# === 設定（必要に応じて変更） ===
PROJECT_ID="${GCP_PROJECT_ID:-mcp-service-492010}"  # GCPプロジェクトID（スグクルとは別プロジェクト）
REGION="${GCP_REGION:-asia-northeast1}"              # リージョン（東京）
SERVICE_NAME="suguvisa-mcp"
IMAGE_NAME="suguvisa-mcp"
REPO_NAME="suguvisa"                                 # Artifact Registry リポジトリ名

# Artifact Registry の完全パス
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}"

echo "🛂 SuguVisa MCP — Cloud Run デプロイ"
echo "   Project:  ${PROJECT_ID}"
echo "   Region:   ${REGION}"
echo "   Service:  ${SERVICE_NAME}"
echo "   Image:    ${IMAGE_URI}"
echo ""

# === Step 1: Artifact Registry リポジトリを確認/作成 ===
echo "📦 Step 1: Artifact Registry リポジトリ確認..."
if ! gcloud artifacts repositories describe "${REPO_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" &>/dev/null; then
  echo "   リポジトリが存在しません。作成します..."
  gcloud artifacts repositories create "${REPO_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --repository-format=docker \
    --description="SuguVisa MCP Docker images"
fi

# === Step 2: Docker ビルド & プッシュ ===
# ビルドコンテキストはモノレポルート（cloudbuild.yaml + Dockerfile in apps/mcp-server/）
MONOREPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
echo "🐳 Step 2: Docker ビルド & プッシュ (context: ${MONOREPO_ROOT})..."
cd "${MONOREPO_ROOT}"
gcloud builds submit \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --config=cloudbuild.yaml \
  --substitutions="_IMAGE_URI=${IMAGE_URI}:latest" \
  .

# === Step 3: Cloud Run デプロイ ===
echo "🚀 Step 3: Cloud Run デプロイ..."
gcloud run deploy "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --image="${IMAGE_URI}:latest" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="SUGUVISA_API_KEY=${SUGUVISA_API_KEY:-}" \
  --set-env-vars="AUTH0_DOMAIN=${AUTH0_DOMAIN:-}" \
  --set-env-vars="AUTH0_AUDIENCE=${AUTH0_AUDIENCE:-}" \
  --set-env-vars="AUTH0_ISSUER_BASE_URL=${AUTH0_ISSUER_BASE_URL:-}" \
  --set-env-vars="ALLOW_LEGACY_API_KEY=${ALLOW_LEGACY_API_KEY:-true}" \
  --service-account="${SERVICE_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --quiet

# === Step 4: URL 取得 & BASE_URL 設定 ===
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

# SUGUVISA_BASE_URL を自動設定（GPT plugin manifest 用）
echo "🔗 Step 4: SUGUVISA_BASE_URL を設定..."
gcloud run services update "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --update-env-vars="SUGUVISA_BASE_URL=${SERVICE_URL}" \
  --quiet 2>/dev/null || true

echo ""
echo "✅ デプロイ完了！ SuguVisa v0.2.0 Dual Plugin Server"
echo ""
echo "   Cloud Run URL:  ${SERVICE_URL}"
echo ""
echo "── Claude (MCP) ──────────────────────────"
echo "   MCP endpoint:        ${SERVICE_URL}/mcp"
echo "   Claude.ai 設定:      Settings > Connectors > Add custom connector"
echo "                        URL: ${SERVICE_URL}/mcp"
echo ""
echo "── ChatGPT (GPT Actions) ────────────────"
echo "   OpenAPI spec:        ${SERVICE_URL}/openapi.yaml"
echo "   Plugin manifest:     ${SERVICE_URL}/.well-known/ai-plugin.json"
echo "   GPT Builder 設定:    Actions > Import from URL"
echo "                        URL: ${SERVICE_URL}/openapi.yaml"
echo ""
echo "── REST API ─────────────────────────────"
echo "   REST base URL:       ${SERVICE_URL}/api/v1/tools/"
echo "   Health check:        ${SERVICE_URL}/health"
echo ""
echo "🔧 カスタムドメインのマッピング（任意）:"
echo "   gcloud run domain-mappings create \\"
echo "     --service=${SERVICE_NAME} \\"
echo "     --domain=suguvisa-mcp.sugu-kuru.co.jp \\"
echo "     --region=${REGION} \\"
echo "     --project=${PROJECT_ID}"
