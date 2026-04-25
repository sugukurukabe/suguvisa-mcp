# ChatGPT Apps Store (Apps SDK) — 申請フォーム下書き

# Submission form draft / Draf formulir pengajuan

> **2026 OpenAI Platform Dashboard フロー準拠**（Step 1〜6）
>
> - 参照: <https://platform.openai.com/docs/apps-sdk>
> - 参照: <https://platform.openai.com/docs/apps-sdk/submission>
> - 申請窓口: OpenAI Platform → **Apps** → **Submit for review**

## 0. TL;DR — 壁さん向けの差し込み作業リスト

審査フォーム送信前に必要なアクション（コード/Cloud Run は全て実装済み）。

- [ ] **Demo 動画 (.mp4)** を録画 → `docs/connectors-directory/demo-script.md` のシナリオに沿う
- [ ] デモ MP4 を `public/assets/demo.mp4` にアップ → `https://mcp.suguvisa.com/assets/demo.mp4` で 200 OK を確認
- [ ] 申請時、OpenAI が発行する ChatGPT 用 `redirect_uri`
      （典型例: `https://chat.openai.com/aip/g-xxxxxxxxxxxx/oauth/callback`）を
      Auth0 Applications → 「ChatGPT Production」 → Allowed Callback URLs に追加
- [ ] Auth0 のその App に DCR 経由で作った Public Client（PKCE）を紐付け済みか確認
- [ ] 提出フォーム末尾の **Policy Compliance checklist 全項目 ✅**（§13 を参照）
- [ ] `POST /api/v1/billing/checkout/ticket` 経由で本番 Stripe 側に
      `SUGUVISA_STRIPE_PRICE_TICKET` (¥2,980) を登録済か env を確認

実装済（＝壁さんの追加作業なし）:

- ✅ Content-Security-Policy ヘッダ付与（Strict policy / `default-src 'none'`）
- ✅ openai-app.json の OpenAI 正式スキーマ準拠（`plans` + `one_time_passes`）
- ✅ Ticket (¥2,980 / 30日パス) のバックエンド（Stripe one-time + Supabase migrations + Webhook + effective_plan）
- ✅ Security 明示（HSTS / X-Frame-Options: DENY / Permissions-Policy / Referrer-Policy / X-Content-Type-Options）

## 1. Step 1 — App Identity (開発者情報 + アプリ基本情報)

### 1-a. Developer (legal entity)

| Field                                      | Value                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| **Developer name (public)**                | `Sugukuru Inc.`                                                              |
| **Developer legal name**                   | `スグクル株式会社 (Sugukuru Inc.)`                                           |
| **Country / jurisdiction**                 | `Japan`                                                                      |
| **Registered address**                     | `〒899-4332 鹿児島県霧島市国分中央3丁目42-8 翔陽A103`                        |
| **Corporate website**                      | `https://sugu-kuru.co.jp`                                                    |
| **Business reg. number (法人番号, 13 桁)** | `7340001028185`                                                              |
| **Primary contact name**                   | `壁 彩 (Kabe Aya)` ※ CTO / Founder                                           |
| **Primary contact email**                  | `info@sugu-kuru.co.jp`                                                    |
| **Security / abuse email**                 | `security@sugu-kuru.co.jp`                                                   |
| **Privacy / DPO email**                    | `privacy@sugu-kuru.co.jp`                                                    |
| **Phone (業務時間帯のみ)**                 | Redacted — フォームに直接入力                                                |

### 1-b. App metadata

| Field                   | Value                                                                           |
| ----------------------- | ------------------------------------------------------------------------------- |
| **App display name**    | `SuguVisa — Japan SSW Visa AI`                                                  |
| **App ID (slug)**       | `suguvisa-mcp`                                                                  |
| **App version**         | `0.9.4`                                                                         |
| **Product website**     | `https://suguvisa.com`                                                          |
| **Support page**        | `https://mcp.suguvisa.com/support`                                              |
| **Primary language**    | `ja` (Japanese) — `en`, `id` も完全ローカライズ済み                             |
| **Content rating**      | `general` (no adult / no financial advice / no medical diagnosis)               |
| **Target audience**     | Businesses (行政書士 / 登録支援機関 / 受入れ機関 / 派遣会社)                    |
| **Minimum API version** | `2024-11-05` (MCP protocol)                                                     |

## 2. Step 2 — Connection (Manifest + MCP transport)

| Field                           | Value                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| **Manifest URL (Apps SDK)**     | `https://mcp.suguvisa.com/.well-known/openai-app.json`                               |
| **MCP server URL (streamable)** | `https://mcp.suguvisa.com/mcp`                                                       |
| **Transport**                   | `streamable_http` (HTTP+SSE)                                                         |
| **Manifest schema version**     | `1.0`                                                                                |
| **OpenAPI 3.1 URL**             | `https://mcp.suguvisa.com/openapi.yaml`                                              |
| **Legacy GPT plugin manifest**  | `https://mcp.suguvisa.com/.well-known/ai-plugin.json` (互換性のため維持)             |
| **Availability (regions)**      | Global (data residency は Tokyo `asia-northeast1`)                                   |
| **Allow inclusion of user email** | `true` (Auth0 claims: email)                                                       |

### 2-a. Connection self-test — コピー&ペーストで動く検証コマンド

```bash
# 1. Manifest が OpenAI のスキーマ通りに返るか
curl -s https://mcp.suguvisa.com/.well-known/openai-app.json \
  | jq '{schema_version, app_id, app_version,
         plans: (.pricing.plans | length),
         one_time_passes: (.pricing.one_time_passes | length),
         screenshots: (.screenshots | length),
         has_csp: (.security.content_security_policy | test("default-src"))}'

# 2. CSP が実 HTTP 応答に乗っているか
curl -sI https://mcp.suguvisa.com/.well-known/openai-app.json \
  | grep -iE 'content-security-policy|strict-transport-security|x-frame-options|referrer-policy|permissions-policy'

# 3. MCP initialize 疎通
curl -s -X POST https://mcp.suguvisa.com/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
       "params":{"protocolVersion":"2024-11-05",
                 "capabilities":{},"clientInfo":{"name":"openai-review","version":"0"}}}'

# 4. 法務ページが全て 200 OK
for p in / /privacy /terms /security /support /health; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' https://mcp.suguvisa.com$p)"
done
```

## 3. Step 3 — Listing (Copy + Assets + Demo)

### 3-a. Tagline

| Locale | ≤ 60 chars                                                      |
| ------ | --------------------------------------------------------------- |
| `en`   | `Full automation for Japan's SSW visa applications.`            |
| `ja`   | `日本の特定技能ビザを完全自動化。`                              |
| `id`   | `Otomatisasi penuh visa SSW Jepang.`                            |

### 3-b. Short description (≤ 160 chars, en)

```
ChatGPT-native visa desk for Japan's Specified Skilled Worker (SSW) program — 42 MCP tools covering routing, OCR, document generation, and 14-day notifications.
```

### 3-c. Long description (200–2000 chars, en)

```
SuguVisa is the first ChatGPT Apps Store integration built exclusively for Japan's Specified Skilled Worker (SSW / 特定技能) visa lifecycle.

With 42 MCP tools, ChatGPT can:
• Determine the correct application type among 18+ conversion patterns (technical intern → SSW1, SSW1 extension, family visa, etc.)
• Emit a document checklist with exam-exemption logic automatically applied
• Calculate the 14-day notification deadline, 5-year SSW1 cap, and visa expiry reverse schedule
• Run Document AI OCR on residence cards and passports (image discarded after OCR)
• Generate immigration-grade artefacts: online CSV, bulk Excel (xlsm), paper-form PDFs, reason letters, and annual periodic-notification CSV
• Track law updates (MOJ告示 / ISA通達) with citation IDs and confidence scores
• Run a resumable autonomous workflow that asks for missing fields via Slack and resumes from any LangGraph checkpoint

Built for:
• Immigration lawyers (行政書士) processing dozens of SSW cases per month
• Registered support organizations (登録支援機関) managing annual reports
• Receiving companies (受入れ機関) hiring SSW workers directly
• Labor-dispatch platforms handling hundreds of placements

Every answer cites authoritative sources (Immigration Services Agency notices, MOJ ordinances). No hallucinated visa advice.

Security: OAuth 2.1 + PKCE (Auth0, JP-hosted). Per-tool scopes. Tenant isolation via Supabase RLS. PII encrypted at rest with Cloud KMS. Residence-card images are discarded immediately after OCR. Strict Content-Security-Policy (`default-src 'none'`). Data residency: Tokyo (asia-northeast1), APPI-compliant.

Pricing: Free plan (5 tools, 100 calls/day). Case Ticket ¥2,980 / 30-day pass (no auto-renew). Starter ¥19,800/mo. Professional ¥49,800/mo. 14-day trial on subscriptions.
```

### 3-d. Categories

| Field         | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| **Primary**   | `Business`                                                                  |
| **Secondary** | `Legal`, `Productivity`                                                     |
| **Tags**      | `immigration`, `visa`, `japan`, `ssw`, `hr`, `ocr`, `compliance`            |

### 3-e. Visual assets

| Asset                                                  | Spec                 | URL                                                             |
| ------------------------------------------------------ | -------------------- | --------------------------------------------------------------- |
| **App icon 512×512 PNG**                               | 正方形・透過可       | `https://mcp.suguvisa.com/icon-512.png`                         |
| **Store icon 1024×1024 PNG**                           | 不透過 (白背景)      | `https://mcp.suguvisa.com/icon-1024.png`                        |
| **Wordmark 1024×576 PNG**                              | ロゴ                 | `https://mcp.suguvisa.com/logo.png`                             |
| **Screenshot 1 — パターン判定 + 書類 + 逆算スケジュール** | ≥ 1600×1000 推奨 | `https://mcp.suguvisa.com/assets/screenshot-1.png`              |
| **Screenshot 2 — 届出期限の緊急度順計算**              | ≥ 1600×1000 推奨     | `https://mcp.suguvisa.com/assets/screenshot-2.png`              |
| **Screenshot 3 — 定期届出 CSV 生成**                   | ≥ 1600×1000 推奨     | `https://mcp.suguvisa.com/assets/screenshot-3.png`              |
| **Screenshot 4 — 法改正トラッキング**                  | ≥ 1600×1000 推奨     | `https://mcp.suguvisa.com/assets/screenshot-4.png`              |
| **Screenshot 5 — 自律ワークフロー**                    | ≥ 1600×1000 推奨     | `https://mcp.suguvisa.com/assets/screenshot-5.png`              |
| **(Optional) OAuth consent**                           | ≥ 1024×600           | `https://mcp.suguvisa.com/assets/oauth-consent.png`             |

### 3-f. Demo recording (必須) — Demo MP4 URL

> OpenAI の審査フロー 2026 版では、ChatGPT アプリストアに対して
> **代表的なユースケースを 30〜90 秒で示す MP4 動画** の提出が必須。

| Field                        | Value                                                                |
| ---------------------------- | -------------------------------------------------------------------- |
| **Demo recording URL (MP4)** | `https://mcp.suguvisa.com/assets/demo.mp4` ← 壁さん録画後にアップ    |
| **Duration**                 | `≤ 90 seconds` (target: 60s)                                         |
| **Language**                 | `Japanese` (英字幕焼き付け)                                          |
| **Script**                   | `docs/connectors-directory/demo-script.md`                           |
| **Demo scenario**            | 技能実習2号 → 特定技能1号 への変更判定 → 書類チェックリスト生成 → 14日届出 |

> 手順:
>
> 1. QuickTime 画面録画で ChatGPT + SuguVisa のデモシナリオを撮影
> 2. `docs/connectors-directory/demo-script.md` を台本として読む
> 3. 録画ファイルを `apps/mcp-server/public/assets/demo.mp4` に配置
> 4. Cloud Run に再デプロイ後、URL 200 OK を確認

## 4. Step 4 — Authentication (OAuth 2.1)

### 4-a. Identity provider config

| Field                           | Value                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| **Auth provider**               | Auth0 (JP tenant)                                                        |
| **Issuer**                      | `https://suguvisa-dev.jp.auth0.com/`                                     |
| **Authorization endpoint**      | `https://suguvisa-dev.jp.auth0.com/authorize`                            |
| **Token endpoint**              | `https://suguvisa-dev.jp.auth0.com/oauth/token`                          |
| **JWKS URI**                    | `https://suguvisa-dev.jp.auth0.com/.well-known/jwks.json`                |
| **Resource (audience)**         | `https://mcp.suguvisa.com/`                                              |
| **Grant types**                 | `authorization_code` + `refresh_token`                                   |
| **PKCE**                        | Required (S256)                                                          |
| **Dynamic Client Registration** | Enabled (`/oauth/register`)                                              |
| **Token type**                  | Opaque→JWT (RS256, 24h access / 30d refresh)                             |
| **OAuth protected resource**    | `https://mcp.suguvisa.com/.well-known/oauth-protected-resource`          |
| **AS metadata**                 | `https://mcp.suguvisa.com/.well-known/oauth-authorization-server`        |

### 4-b. Redirect URI（申請時に OpenAI から発行）

```
⚠️ OpenAI の審査開始時に ChatGPT 用 redirect_uri が発行される。
   典型形式: https://chat.openai.com/aip/g-xxxxxxxxxxxxxxx/oauth/callback

壁さん作業:
  1. Auth0 Dashboard → Applications → "ChatGPT Production" (DCR で自動生成される想定)
  2. Allowed Callback URLs に上記 URI を追加
  3. Allowed Web Origins に https://chat.openai.com を追加
  4. Grant Types: Authorization Code / Refresh Token のみ許可 (Implicit/Password は無効)
```

### 4-c. Requested scopes (フォームで列挙)

| Scope                        | Description                              |
| ---------------------------- | ---------------------------------------- |
| `read:visa_case`             | Read visa cases, patterns, and deadlines |
| `read:visa_rule`             | Read application pattern catalog         |
| `read:golden_records`        | Read authoritative immigration notices   |
| `read:law_updates`           | Track law changes                        |
| `generate:reason_letter`     | Generate application reason letters      |
| `generate:paper_form`        | Map data to paper PDF forms              |
| `generate:bulk_xlsm`         | Generate bulk Excel application files    |
| `generate:annual_report`     | Generate annual notification CSV         |
| `validate:application_data`  | Validate applicant data                  |
| `review:document`            | AI-powered document review               |
| `write:submission_outcome`   | Log submission outcomes                  |
| `write:audit_log`            | Write audit log entries                  |
| `admin:tenant`               | Manage tenant settings (optional)        |
| `admin:golden_records`       | Update reference data (optional)         |
| `offline_access`             | Refresh token for long sessions          |

## 5. Step 5 — Pricing

| Plan                          | Model                | Price (JPY)   | Billing                     | Included                                                                                         |
| ----------------------------- | -------------------- | ------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| **Free**                      | `subscription`       | ¥0            | monthly (auto-renew)        | 5 basic tools, 100 calls/day                                                                     |
| **Case Ticket (30-day pass)** | `one_time` (`ticket`)| ¥2,980        | **one-time (no auto-renew)**| Starter 相当の全ツール 30 日分。使い切り                                                         |
| **Starter**                   | `subscription`       | ¥19,800       | monthly                     | All visa tools + OCR + bulk generation + audit log + annual report                               |
| **Professional**              | `subscription`       | ¥49,800       | monthly (¥498,000/yr 割引可)| Starter + legal search + autonomous workflow + priority support                                  |

- **Billing provider**: Stripe (Japan)
- **Billing model (manifest)**: `freemium_subscription_with_ticket`
- **Trial**: 14-day free trial on Starter / Professional subscriptions
- **Refund policy**: Pro-rated refund within the first 30 days on request (subscriptions only). Ticket は使用開始後返金不可 (§3 同意あり)
- **Marketplace billing (OpenAI が課金)**: `false` — 直 Stripe (一次販売者)
- **Billing portal URL**: `https://mcp.suguvisa.com/api/v1/billing/portal`
- **Checkout endpoints**:
  - subscription → `POST /api/v1/billing/checkout` (`mode=subscription`)
  - ticket → `POST /api/v1/billing/checkout/ticket` (`mode=payment`, metadata.plan=`ticket`)

### 5-a. Effective plan resolution (開示)

サブスクリプションと 30日パス (Ticket) を **併用した時の適用プラン判定ロジック** を明示。

```text
subscription_plan ∈ {starter, professional, unlimited}  → そのまま適用 (サブスク優先)
else if ticket_expires_at > now()                        → Starter 相当として扱う
else                                                     → subscription_plan (typically free)
```

## 6. Step 6 — Safety, Policy Compliance & Submission

### 6-a. Safety & Responsible AI (OpenAI の "Safety annotations" セクション用)

- **不可逆操作なし**: 入管への実申請送信は行わない。生成された書類は最終確認のうえ **ユーザーが手動で提出**
- **PII 最小化**: 在留カード・パスポート画像は OCR 後即時破棄、DB に保存しない
- **テナント分離**: Supabase Row Level Security で他テナントのデータには一切アクセス不可
- **出典付き回答**: 法令・通達引用に `golden_record_id` + 信頼スコア付き
- **レート制限**: per-principal 100 req/min、per-tenant 10,000 req/day
- **監査ログ**: 書き込み系ツールは `write:audit_log` と連動、365 日保持、削除リクエスト可
- **Tool 安全性ヒント**: 全ツールに `readOnlyHint` / `destructiveHint` 注釈あり
  （destructive は **ゼロ** — 当 app 単独での不可逆副作用はない）

### 6-b. Content Security Policy (サーバが実際に送出している値)

```
default-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
object-src 'none';
img-src 'self' data:;
font-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src 'self' 'unsafe-inline';
connect-src 'self' https://mcp.suguvisa.com https://suguvisa.com;
manifest-src 'self';
media-src 'none';
worker-src 'none';
upgrade-insecure-requests
```

補足ヘッダ:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()`

### 6-c. Data handling declaration

| Question                                | Answer                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Data residency                          | `asia-northeast1 (Tokyo, Japan)`                                       |
| Encryption at rest                      | AES-256 (Supabase managed Postgres + Cloud KMS envelope)               |
| Encryption in transit                   | TLS 1.3 (Cloudflare edge + Cloud Run)                                  |
| PII retention                           | 必要最小限 (顧客データは契約終了後 90 日で削除)                        |
| Training on user data                   | **No** — OpenAI/任意の第三者 LLM の学習データに回さない                |
| Third-party subprocessors               | Google Cloud (Run / Document AI / KMS) / Supabase / Stripe / Auth0 / Cloudflare |
| Data deletion request                   | `privacy@sugu-kuru.co.jp` または `DELETE /api/v1/tenant/data` 経由     |
| APPI compliance                         | ✅                                                                      |
| GDPR                                    | N/A (primarily JP market)                                               |
| SOC 2                                   | In progress (targeting FY2027)                                         |

### 6-d. Policy Compliance checklist (審査フォームの最終チェック欄 — 全て ✅)

> 「Submit for Review」ボタンの直前にある **I confirm the following** セクション。
> 虚偽が発覚すると即時 reject なので 1 項目ずつ壁さんが目視確認して ✅。

- [ ] OpenAI の [Usage Policies](https://openai.com/policies/usage-policies) を読み、準拠している
- [ ] OpenAI の [Apps Store Policy](https://platform.openai.com/docs/apps-sdk/policy) を読み、準拠している
- [ ] **cross-service automation を行わない** （当 app は入管ビザ関連の自社 API のみ）
- [ ] **送金・暗号通貨・金融取引を行わない** （ユーザー向け決済は自社サブスク/ticket のみ、直 Stripe）
- [ ] 本 app は **live / production** で動作中 (`https://mcp.suguvisa.com/health` 200 OK)
- [ ] この MCP が叩く API は **自社が所有・運営** (`mcp.suguvisa.com` = Sugukuru Inc.)
- [ ] 全 tool で OAuth 2.0 (PKCE) を実装している
- [ ] 全 tool に `readOnlyHint` / `destructiveHint` アノテーション有り（当 app の destructive 数 = 0）
- [ ] HTTPS のみ（HTTP アクセスは Cloudflare で 308 redirect）
- [ ] CORS は `Access-Control-Allow-Origin: *` + `Allow-Methods: GET, POST, DELETE, OPTIONS`
- [ ] **Content-Security-Policy** ヘッダを送出している（§6-b 参照）
- [ ] ChatGPT 本番ビルドで実際に動作確認済み
- [ ] ドキュメント公開済み: `https://mcp.suguvisa.com/` + `/privacy` + `/terms` + `/security` + `/support`
- [ ] 審査用テストアカウント準備済（有効期限 30 日以上）
- [ ] Demo 動画 (mp4) を公開 URL で提出済

## 7. Tools overview (app 説明用の主要カテゴリ)

SuguVisa は 42 の MCP ツールを提供。全ツール一覧は `/openapi.yaml` 参照。

| Category                     | Example tools                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Pattern / routing**        | `suguvisa_application_type_determine`, `suguvisa_required_documents_list`, `suguvisa_deadlines_calculate`                                             |
| **OCR / data extraction**    | `suguvisa_residence_card_parse`, `suguvisa_passport_parse`, `suguvisa_document_extract_advanced`, `suguvisa_corporate_number_lookup`                             |
| **Document generation**      | `suguvisa_online_csv_generate`, `suguvisa_bulk_xlsm_generate`, `suguvisa_paper_form_generate`, `suguvisa_reason_letter_generate`, `suguvisa_annual_report_csv_generate`|
| **Validation**               | `suguvisa_application_data_validate`, `suguvisa_form_ai_validate`, `suguvisa_submission_checklist_verify`                                              |
| **Knowledge / search**       | `suguvisa_golden_records_search`, `suguvisa_law_updates_list`, `suguvisa_legal_docs_search`, `suguvisa_visa_guide_get`                                |
| **Audit / compliance**       | `suguvisa_audit_action_log`, `suguvisa_audit_logs_list`, `suguvisa_submission_outcome_track`, `suguvisa_wage_compliance_check`, `suguvisa_staff_notification_deadline_check`|
| **Workflow**                 | `suguvisa_autonomous_workflow_start`, `suguvisa_autonomous_workflow_resume`                                                       |

## 8. Example conversations (審査員に見せるコピペ用)

### Example 1 — 申請パターン判定

> **User**: 技能実習 2 号から特定技能 1 号に変更したい社員がいます。必要書類と期限を教えて。
>
> **ChatGPT (via SuguVisa)**:
>
> 1. `suguvisa_application_type_determine` → `CHANGE_SSW1_C`（国内転職の標準ルート、審査期間 1〜3 ヶ月）
> 2. `suguvisa_required_documents_list` → 技能試験・日本語試験免除を自動適用した書類チェックリスト
> 3. `suguvisa_deadlines_calculate` → 14 日届出期限、在留期限からの逆算スケジュール

### Example 2 — 定期届出

> **User**: 今年度の定期届出 CSV を作成。対象者 24 名、全員スグクル派遣の農業分野。
>
> **ChatGPT (via SuguVisa)**:
>
> - `suguvisa_annual_report_csv_generate` が入管の正規フォーマットで出力
> - `suguvisa_application_data_validate` でデータ不整合を事前検出

### Example 3 — OCR + 検証

> **User**: 在留カード画像を添付「この方の在留期限は？」
>
> **ChatGPT (via SuguVisa)**:
>
> - `suguvisa_residence_card_parse` → 氏名・在留資格・在留期限抽出（画像は即時破棄）
> - `suguvisa_deadlines_calculate` → 次の届出期限を自動計算

## 9. 提出フロー / Submission flow (2026 Dashboard UI)

```
OpenAI Platform
  └─ Apps
      ├─ Create app  ← §1 を入力
      ├─ Step 2: Connection         → Manifest URL / MCP URL 貼り付け → auto-verify
      ├─ Step 3: Listing            → Copy + Screenshots 5 枚 + Demo MP4 アップロード
      ├─ Step 4: Authentication     → Auth0 設定貼り付け / DCR 有効化 / Scopes 選択
      ├─ Step 5: Pricing            → plans + one_time_passes (Ticket) を登録
      └─ Step 6: Safety / Policy    → §6-a〜6-d checklist → Submit for Review
```

## 10. 申請順序のベストプラクティス

- **Claude Connectors** → **ChatGPT Apps Store** の順で申請推奨
  - Claude 側で先に実トラフィックを取ってから OpenAI の審査を受けると、
    Policy Compliance の「live / production で動作」と「テスト済み」の証拠が揃う
- 審査期間: 通常 **1〜3 週間**。セキュリティ周りの質問が来る確率が高いので 24h SLA で返信
- OpenAI 商標（「ChatGPT」「GPT」等）をマーケティング素材に使わない

---

**Last updated**: 2026-04-25
**App version**: 0.9.4
**Status**: ✅ CSP 実装完了 / ✅ openai-app.json 正式スキーマ準拠 / ✅ Ticket 実装完了
**User-side blockers remaining**: Demo MP4 録画 + 撮影時の shot list は `docs/connectors-directory/demo-script.md` / ChatGPT 用 `redirect_uri` の Auth0 登録 (OpenAI 発行後)
