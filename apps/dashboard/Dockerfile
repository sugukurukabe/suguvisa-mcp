# ─────────────────────────────────────────────────────────────
# SuguVisa Dashboard — Cloud Run / container image
# Build stages: deps → builder → runner
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
ENV PNPM_HOME=/root/.local/share/pnpm PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ---- Deps ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/billing/package.json packages/billing/package.json
RUN pnpm fetch --filter @suguvisa/dashboard --filter @suguvisa/billing

# ---- Builder ----
FROM deps AS builder
WORKDIR /app

# NEXT_PUBLIC_* は build 時に client bundle に焼き込む必要があるので ARG で受け取る
# NEXT_PUBLIC_* need to be baked at build time (client-side JS)
# NEXT_PUBLIC_* dipanggang saat build (dibundel ke client-side JS)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUGUVISA_API_URL=https://mcp.suguvisa.com
ARG NEXT_PUBLIC_SITE_URL=https://suguvisa.com
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUGUVISA_API_URL=$NEXT_PUBLIC_SUGUVISA_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

COPY . .
RUN pnpm install --frozen-lockfile --filter @suguvisa/dashboard --filter @suguvisa/billing
RUN pnpm --filter @suguvisa/billing build
RUN pnpm --filter @suguvisa/dashboard build

# ---- Runner ----
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next.js standalone output pulls in node_modules it needs on its own.
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/public ./apps/dashboard/public

USER nextjs
ENV PORT=3100
EXPOSE 3100
CMD ["node", "apps/dashboard/server.js"]
