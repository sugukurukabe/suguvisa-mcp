/**
 * SuguVisa MCP Server API client / API クライアント / Klien API
 *
 * apps/mcp-server が公開する REST / billing / tenant エンドポイントを叩く。
 * ブラウザ経由で Supabase access_token を渡し、サーバー側で身元確認させる想定。
 */
import { env } from "./env";

export interface Plan {
  key: string;
  name: string;
  description: string;
  monthlyPriceJpy: number;
  yearlyPriceJpy: number;
  features: {
    ocr?: boolean;
    legal_search?: boolean;
    bulk_generation?: boolean;
    audit_log?: boolean;
    annual_report?: boolean;
    autonomous_workflow?: boolean;
  };
  limits?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
    maxBulkRecords?: number;
  };
  stripePrices?: {
    monthly: string | null;
    yearly: string | null;
  };
}

type Localized = string | { ja?: string; en?: string };

/** Raw plan shape returned by the MCP server (snake_case) */
interface WirePlan {
  key: string;
  name: Localized;
  description: Localized;
  monthly_price_jpy: number;
  yearly_price_jpy: number;
  features: Plan["features"];
  limits?: {
    requests_per_minute?: number | null;
    requests_per_day?: number | null;
    max_bulk_records?: number | null;
  };
  stripe?: {
    monthly_price_id: string | null;
    yearly_price_id: string | null;
  };
}

function pickLocalized(value: Localized | null | undefined, lang: "ja" | "en" = "ja"): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] ?? value.en ?? value.ja ?? "";
}

export interface TenantSnapshot {
  id: string;
  organizationName?: string;
  /** Effective plan (subscription 優先、次いで active ticket なら starter) */
  plan: string;
  /** サブスク本体の raw な値 (free / starter / ...) — チケット独立表示用 */
  rawSubscriptionPlan?: string;
  /** チケット (30日パス) の有効期限 */
  ticketExpiresAt?: string | null;
  /** ticket_expires_at > now() */
  ticketActive?: boolean;
  planDetails?: {
    name?: string;
    requestsPerMinute?: number;
    requestsPerDay?: number;
    maxBulkRecords?: number;
    features?: Record<string, unknown>;
  };
  billing?: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean | null;
  };
}

/** 30日パスなどのワンタイム購入オプション / One-time pass (e.g. 30-day ticket) */
export interface OneTimePass {
  key: string;
  name: string;
  description: string;
  priceJpy: number;
  durationDays: number;
  grantsPlan: string;
  stripePriceId: string | null;
}

interface WireOneTimePass {
  key: string;
  name: Localized;
  description: Localized;
  price_jpy: number;
  duration_days: number;
  grants_plan: string;
  stripe?: { price_id: string | null };
}

export interface ApiKeySummary {
  id: string;
  label: string | null;
  status: "active" | "revoked" | string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CheckoutResponse {
  url: string;
  sessionId?: string;
}

export interface PortalResponse {
  url: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(typeof body === "object" && body && "error" in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).error)
      : `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiOptions {
  accessToken?: string;
  apiUrl?: string;
  /** For fetch mocking in tests */
  fetchImpl?: typeof fetch;
}

export async function listPlans(opts: ApiOptions = {}): Promise<Plan[]> {
  const res = await request<{ plans: WirePlan[] }>("/api/v1/billing/plans", { method: "GET", ...opts });
  return res.plans.map(normalizePlan);
}

/**
 * 30日パス等のワンタイム購入オプションを取得する。
 * List publicly available one-time passes (tickets).
 */
export async function listOneTimePasses(opts: ApiOptions = {}): Promise<OneTimePass[]> {
  const res = await request<{ one_time_passes?: WireOneTimePass[] }>("/api/v1/billing/plans", {
    method: "GET",
    ...opts,
  });
  return (res.one_time_passes ?? []).map((p) => ({
    key: p.key,
    name: pickLocalized(p.name),
    description: pickLocalized(p.description),
    priceJpy: p.price_jpy,
    durationDays: p.duration_days,
    grantsPlan: p.grants_plan,
    stripePriceId: p.stripe?.price_id ?? null,
  }));
}

/**
 * ワンタイムチケット購入用の Stripe Checkout URL を発行する。
 * Create a Stripe Checkout URL for one-time ticket purchase.
 */
export async function createTicketCheckout(
  params: { passKey?: string; successPath?: string; cancelPath?: string; customerEmail?: string },
  opts: ApiOptions = {},
): Promise<CheckoutResponse> {
  const siteUrl = resolveSiteUrl();
  const raw = await request<{ status: string; checkout_url: string; session_id?: string }>(
    "/api/v1/billing/checkout/ticket",
    {
      method: "POST",
      body: JSON.stringify({
        pass_key: params.passKey ?? "ticket",
        success_url: `${siteUrl}${params.successPath ?? "/dashboard/billing?status=ticket_success"}`,
        cancel_url: `${siteUrl}${params.cancelPath ?? "/dashboard/billing?status=ticket_canceled"}`,
        customer_email: params.customerEmail,
      }),
      ...opts,
    },
  );
  return { url: raw.checkout_url, sessionId: raw.session_id };
}

function normalizePlan(p: WirePlan): Plan {
  return {
    key: p.key,
    name: pickLocalized(p.name),
    description: pickLocalized(p.description),
    monthlyPriceJpy: p.monthly_price_jpy,
    yearlyPriceJpy: p.yearly_price_jpy,
    features: p.features ?? {},
    limits: {
      requestsPerMinute: p.limits?.requests_per_minute ?? undefined,
      requestsPerDay: p.limits?.requests_per_day ?? undefined,
      maxBulkRecords: p.limits?.max_bulk_records ?? undefined,
    },
    stripePrices: {
      monthly: p.stripe?.monthly_price_id ?? null,
      yearly: p.stripe?.yearly_price_id ?? null,
    },
  };
}

export async function getMe(opts: ApiOptions = {}): Promise<TenantSnapshot> {
  const raw = await request<{
    status: string;
    tenant: {
      id: string;
      organization_name?: string;
      subscription_plan: string;
      raw_subscription_plan?: string;
      ticket_expires_at?: string | null;
      ticket_active?: boolean;
      plan_details?: {
        name?: string;
        requests_per_minute?: number;
        requests_per_day?: number;
        max_bulk_records?: number;
        features?: Record<string, unknown>;
      };
      billing?: {
        stripe_customer_id?: string | null;
        stripe_subscription_id?: string | null;
        subscription_status?: string | null;
        current_period_end?: string | null;
        cancel_at_period_end?: boolean | null;
      };
    };
  }>("/api/v1/tenant/me", { method: "GET", ...opts });
  const t = raw.tenant;
  return {
    id: t.id,
    organizationName: t.organization_name,
    plan: t.subscription_plan,
    rawSubscriptionPlan: t.raw_subscription_plan ?? t.subscription_plan,
    ticketExpiresAt: t.ticket_expires_at ?? null,
    ticketActive: t.ticket_active ?? false,
    planDetails: t.plan_details && {
      name: t.plan_details.name,
      requestsPerMinute: t.plan_details.requests_per_minute,
      requestsPerDay: t.plan_details.requests_per_day,
      maxBulkRecords: t.plan_details.max_bulk_records,
      features: t.plan_details.features,
    },
    billing: t.billing && {
      stripeCustomerId: t.billing.stripe_customer_id ?? null,
      stripeSubscriptionId: t.billing.stripe_subscription_id ?? null,
      subscriptionStatus: t.billing.subscription_status ?? null,
      currentPeriodEnd: t.billing.current_period_end ?? null,
      cancelAtPeriodEnd: t.billing.cancel_at_period_end ?? null,
    },
  };
}

export async function listApiKeys(opts: ApiOptions = {}): Promise<ApiKeySummary[]> {
  const res = await request<{
    status: string;
    keys: Array<{
      id: string;
      label: string | null;
      status: string;
      last_used_at: string | null;
      created_at: string;
    }>;
  }>("/api/v1/tenant/keys", { method: "GET", ...opts });
  return res.keys.map((k) => ({
    id: k.id,
    label: k.label,
    status: k.status,
    lastUsedAt: k.last_used_at,
    createdAt: k.created_at,
  }));
}

export async function issueApiKey(
  params: { label?: string },
  opts: ApiOptions = {},
): Promise<{ token: string; keyInfo: ApiKeySummary }> {
  const res = await request<{
    status: string;
    key: string;
    key_info: { id: string; label: string | null; status: string; created_at: string };
  }>("/api/v1/tenant/keys", {
    method: "POST",
    body: JSON.stringify({ label: params.label ?? "default" }),
    ...opts,
  });
  return {
    token: res.key,
    keyInfo: {
      id: res.key_info.id,
      label: res.key_info.label,
      status: res.key_info.status,
      lastUsedAt: null,
      createdAt: res.key_info.created_at,
    },
  };
}

export async function revokeApiKey(keyId: string, opts: ApiOptions = {}): Promise<void> {
  await request<{ status: string }>(`/api/v1/tenant/keys/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
    ...opts,
  });
}

export interface UsageSummary {
  mode?: string;
  plan?: string;
  today: number;
  todayLimit?: number;
  todayRemaining?: number;
  thisMonth: number;
  byToolToday: Record<string, { success: number; error: number }>;
}

export async function getUsage(opts: ApiOptions = {}): Promise<UsageSummary> {
  const raw = await request<{
    status: string;
    mode?: string;
    plan?: string;
    usage: {
      today?: number;
      today_limit?: number;
      today_remaining?: number;
      this_month?: number;
      by_tool_today?: Record<string, { success: number; error: number }>;
    };
  }>("/api/v1/tenant/usage", { method: "GET", ...opts });
  return {
    mode: raw.mode,
    plan: raw.plan,
    today: raw.usage.today ?? 0,
    todayLimit: raw.usage.today_limit,
    todayRemaining: raw.usage.today_remaining,
    thisMonth: raw.usage.this_month ?? 0,
    byToolToday: raw.usage.by_tool_today ?? {},
  };
}

export async function createCheckout(
  params: { priceId: string; successPath?: string; cancelPath?: string; customerEmail?: string },
  opts: ApiOptions = {},
): Promise<CheckoutResponse> {
  const siteUrl = resolveSiteUrl();
  const raw = await request<{ status: string; checkout_url: string; session_id?: string }>(
    "/api/v1/billing/checkout",
    {
      method: "POST",
      body: JSON.stringify({
        price_id: params.priceId,
        success_url: `${siteUrl}${params.successPath ?? "/dashboard/billing?status=success"}`,
        cancel_url: `${siteUrl}${params.cancelPath ?? "/dashboard/billing?status=canceled"}`,
        customer_email: params.customerEmail,
      }),
      ...opts,
    },
  );
  return { url: raw.checkout_url, sessionId: raw.session_id };
}

export async function createPortal(
  params: { returnPath?: string } = {},
  opts: ApiOptions = {},
): Promise<PortalResponse> {
  const raw = await request<{ status: string; portal_url: string }>("/api/v1/billing/portal", {
    method: "POST",
    body: JSON.stringify({
      return_url: `${resolveSiteUrl()}${params.returnPath ?? "/dashboard/billing"}`,
    }),
    ...opts,
  });
  return { url: raw.portal_url };
}

function resolveSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? env.siteUrl ?? "http://localhost:3100";
  return url.replace(/\/+$/, "");
}

async function request<T>(
  path: string,
  init: RequestInit & ApiOptions,
): Promise<T> {
  const base = init.apiUrl ?? env.apiUrl;
  const fetchFn = init.fetchImpl ?? fetch;
  const url = `${base.replace(/\/+$/, "")}${path}`;

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (init.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }

  const res = await fetchFn(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body,
    cache: "no-store",
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
