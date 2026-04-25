/**
 * テナント管理 API ルーター
 *
 * Phase 3: APIキー管理、利用統計、テナント情報の管理エンドポイント
 * 
 * エンドポイント:
 *   GET  /api/v1/tenant/me        — 自テナント情報
 *   GET  /api/v1/tenant/usage     — 利用統計
 *   POST /api/v1/tenant/keys      — APIキー追加発行
 *   DELETE /api/v1/tenant/keys/:id — APIキー無効化
 */
import { Router } from "express";
import crypto from "crypto";
import type { AuthRequest } from "../middleware/auth.js";
import { supabase } from "../lib/supabase.js";
import { getPlanConfig } from "../lib/plans.js";

const router = Router();

// ─── GET /api/v1/tenant/me ───
// 自分のテナント情報とプラン詳細を返す
router.get("/me", async (req: AuthRequest, res) => {
  const tenant = req.tenant;
  if (!tenant) {
    res.status(401).json({ status: "error", message: "Not authenticated" });
    return;
  }

  const plan = getPlanConfig(tenant.subscription_plan);
  const ticketExpiresAt = tenant.ticket_expires_at ?? null;
  const ticketActive =
    typeof ticketExpiresAt === "string" && new Date(ticketExpiresAt).getTime() > Date.now();

  res.json({
    status: "ok",
    tenant: {
      id: tenant.id,
      organization_name: tenant.organization_name,
      subscription_plan: tenant.subscription_plan,
      raw_subscription_plan: tenant.raw_subscription_plan ?? tenant.subscription_plan,
      ticket_expires_at: ticketExpiresAt,
      ticket_active: ticketActive,
      plan_details: {
        name: plan.name,
        requests_per_minute: plan.requests_per_minute,
        requests_per_day: plan.requests_per_day,
        max_bulk_records: plan.max_bulk_records,
        features: plan.features,
        allowed_tools: plan.allowed_tools === "all" ? "全ツール利用可能" : `${plan.allowed_tools.length}ツールのみ`,
      },
    },
  });
});

// ─── GET /api/v1/tenant/usage ───
// テナント別の利用統計を返す
router.get("/usage", async (req: AuthRequest, res) => {
  const tenant = req.tenant;
  if (!tenant || tenant.id === "local-dev-tenant") {
    res.json({
      status: "ok",
      mode: "local",
      message: "ローカルモードでは利用統計は記録されません",
      usage: { today: 0, this_month: 0, by_tool: {} },
    });
    return;
  }

  if (!process.env.SUPABASE_URL) {
    res.json({ status: "ok", mode: "no_db", usage: {} });
    return;
  }

  try {
    // 今日の利用数
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayData } = await supabase
      .from("api_usage_logs")
      .select("tool_name, status", { count: "exact" })
      .eq("tenant_id", tenant.id)
      .gte("created_at", todayStart.toISOString());

    // 今月の利用数
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count: monthCount } = await supabase
      .from("api_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("created_at", monthStart.toISOString());

    // ツール別集計
    const toolCounts: Record<string, { success: number; error: number }> = {};
    if (todayData) {
      for (const row of todayData) {
        if (!toolCounts[row.tool_name]) {
          toolCounts[row.tool_name] = { success: 0, error: 0 };
        }
        toolCounts[row.tool_name][row.status as "success" | "error"]++;
      }
    }

    const plan = getPlanConfig(tenant.subscription_plan);

    res.json({
      status: "ok",
      tenant_id: tenant.id,
      plan: tenant.subscription_plan,
      usage: {
        today: todayData?.length ?? 0,
        today_limit: plan.requests_per_day,
        today_remaining: plan.requests_per_day - (todayData?.length ?? 0),
        this_month: monthCount ?? 0,
        by_tool_today: toolCounts,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── POST /api/v1/tenant/keys ───
// 新しいAPIキーを発行する
router.post("/keys", async (req: AuthRequest, res) => {
  const tenant = req.tenant;
  if (!tenant || tenant.id === "local-dev-tenant") {
    res.status(400).json({ status: "error", message: "APIキー管理はSaaSモードでのみ利用可能です" });
    return;
  }

  if (!process.env.SUPABASE_URL) {
    res.status(400).json({ status: "error", message: "Database not configured" });
    return;
  }

  const { label } = req.body;
  const newKey = `svmcp_${crypto.randomBytes(24).toString("hex")}`;

  try {
    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        tenant_id: tenant.id,
        key: newKey,
        label: label || "Auto-generated",
        status: "active",
      })
      .select("id, label, status, created_at")
      .single();

    if (error) throw error;

    res.json({
      status: "ok",
      message: "新しいAPIキーが発行されました。このキーは二度と表示されません。安全に保管してください。",
      key: newKey,
      key_info: data,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── DELETE /api/v1/tenant/keys/:keyId ───
// APIキーを無効化する
router.delete("/keys/:keyId", async (req: AuthRequest, res) => {
  const tenant = req.tenant;
  if (!tenant || tenant.id === "local-dev-tenant") {
    res.status(400).json({ status: "error", message: "APIキー管理はSaaSモードでのみ利用可能です" });
    return;
  }

  if (!process.env.SUPABASE_URL) {
    res.status(400).json({ status: "error", message: "Database not configured" });
    return;
  }

  const { keyId } = req.params;

  try {
    const { data, error } = await supabase
      .from("api_keys")
      .update({ status: "revoked" })
      .eq("id", keyId)
      .eq("tenant_id", tenant.id)
      .select("id, label, status")
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ status: "error", message: "APIキーが見つかりません" });
      return;
    }

    res.json({
      status: "ok",
      message: "APIキーが無効化されました",
      key_info: data,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
