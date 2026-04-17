/**
 * Billing module wiring
 * BillingClient と BillingRepository のアプリ全体シングルトン
 */
import {
  buildPriceMappingFromEnv,
  FakeBillingClient,
  type BillingClient,
  type PriceMapping,
  StripeBillingClient,
} from "@suguvisa/billing";
import { SupabaseBillingRepository } from "./billing-repository.js";
import { supabase } from "./supabase.js";

let cachedClient: BillingClient | null = null;
let cachedRepository: SupabaseBillingRepository | null = null;
let cachedMappings: PriceMapping[] | null = null;

export function getBillingClient(): BillingClient {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (apiKey && webhookSecret) {
    cachedClient = new StripeBillingClient({ apiKey, webhookSecret });
  } else {
    cachedClient = new FakeBillingClient({
      webhookSecret: webhookSecret ?? "whsec_fake",
      baseUrl: process.env.SUGUVISA_BASE_URL ?? "https://fake.suguvisa.local",
    });
  }
  return cachedClient;
}

export function getBillingRepository(): SupabaseBillingRepository {
  if (cachedRepository) return cachedRepository;
  cachedRepository = new SupabaseBillingRepository({ supabase });
  return cachedRepository;
}

export function getPriceMappings(): PriceMapping[] {
  if (cachedMappings) return cachedMappings;
  cachedMappings = buildPriceMappingFromEnv(process.env);
  return cachedMappings;
}

/** テスト / 起動時リセット用 */
export function resetBillingCache(): void {
  cachedClient = null;
  cachedRepository = null;
  cachedMappings = null;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
