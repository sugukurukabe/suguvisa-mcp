# -----------------------------------------------------------------------------
# Cloud Armor セキュリティポリシー (Phase 1 Task 1.5 — ドラフト)
# Cloud Armor security policy (Phase 1 Task 1.5 — draft)
# Kebijakan keamanan Cloud Armor (Phase 1 Task 1.5 — draf)
# -----------------------------------------------------------------------------
# 注意: 本ファイルはドラフトです。apply する前に:
#   1. terraform init && terraform plan で差分を確認
#   2. Anthropic / OpenAI の最新 IP レンジを反映 (scripts/update-allowlist.ts で日次更新予定)
#   3. suguvisa-mcp Cloud Run に Load Balancer をアタッチし、本ポリシーを紐付け
#
# Note: This file is a draft. Before apply:
#   1. Run terraform init && terraform plan
#   2. Refresh Anthropic / OpenAI IP ranges (scripts/update-allowlist.ts, scheduled daily)
#   3. Attach a Load Balancer to suguvisa-mcp Cloud Run and bind this policy
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  description = "GCP project ID / GCP プロジェクト ID"
  type        = string
  default     = "mcp-service-492010"
}

variable "sugukuru_office_ips" {
  description = "スグクル社内の固定 IP (NAT) / Sugukuru office fixed IPs"
  type        = list(string)
  default = [
    "34.84.81.176/32", # prod
    "34.85.56.97/32",  # dev
  ]
}

variable "anthropic_ip_ranges" {
  description = "Anthropic 公式 IP レンジ (https://docs.anthropic.com/en/api/ip-addresses)"
  type        = list(string)
  default = [
    # TODO: scripts/update-allowlist.ts が更新する
    # 2026-04-17 時点のスナップショット
    "160.79.104.0/23",
  ]
}

variable "openai_ip_ranges" {
  description = "OpenAI 公式 IP レンジ (https://platform.openai.com/docs)"
  type        = list(string)
  default = [
    # TODO: scripts/update-allowlist.ts が更新する
  ]
}

# -----------------------------------------------------------------------------
# Cloud Armor セキュリティポリシー本体
# -----------------------------------------------------------------------------
resource "google_compute_security_policy" "suguvisa_mcp" {
  name        = "suguvisa-mcp-armor"
  project     = var.project_id
  description = "SuguVisa MCP: AI vendor allowlist + rate limiting + ML threat detection"

  # 既定: 許可 (後続ルールで制限)
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "default allow"
  }

  # 優先度 100: スグクル社内 IP は全許可 (開発・運用)
  rule {
    action   = "allow"
    priority = 100
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = var.sugukuru_office_ips
      }
    }
    description = "Sugukuru internal allowlist"
  }

  # 優先度 200: Anthropic 許可
  rule {
    action   = "allow"
    priority = 200
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = var.anthropic_ip_ranges
      }
    }
    description = "Anthropic IP allowlist"
  }

  # 優先度 300: OpenAI 許可
  dynamic "rule" {
    for_each = length(var.openai_ip_ranges) > 0 ? [1] : []
    content {
      action   = "allow"
      priority = 300
      match {
        versioned_expr = "SRC_IPS_V1"
        config {
          src_ip_ranges = var.openai_ip_ranges
        }
      }
      description = "OpenAI IP allowlist"
    }
  }

  # 優先度 500: /.well-known は全開放 (OAuth discovery のため)
  rule {
    action   = "allow"
    priority = 500
    match {
      expr {
        expression = "request.path.startsWith('/.well-known/')"
      }
    }
    description = "Open discovery endpoints for OAuth client bootstrap"
  }

  # 優先度 900: /mcp に対するグローバル rate limit (Cloud Armor 層)
  rule {
    action   = "rate_based_ban"
    priority = 900
    match {
      expr {
        expression = "request.path.matches('^/mcp($|/)')"
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      ban_duration_sec = 300
    }
    description = "Per-IP hard cap on /mcp"
  }

  # 優先度 920: /oauth/* 相当のパスに厳しめ制限 (Auth0 を直接使っているので実質 /.well-known のみ)
  rule {
    action   = "rate_based_ban"
    priority = 920
    match {
      expr {
        expression = "request.path.startsWith('/.well-known/')"
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 30
        interval_sec = 60
      }
      ban_duration_sec = 600
    }
    description = "Aggressive limit on discovery endpoints"
  }

  # 優先度 1000: Adaptive Protection (ML による DDoS 検知)
  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable = true
      rule_visibility = "STANDARD"
    }
  }

  # 優先度 2000: 明示的に拒否したい CIDR (将来 ban list を反映)
  # 例: 繰り返し悪意あるトラフィックを送ってきた IP を Operations 側で追加
}

output "security_policy_self_link" {
  description = "Attach this to the Cloud Run / backend service"
  value       = google_compute_security_policy.suguvisa_mcp.self_link
}
