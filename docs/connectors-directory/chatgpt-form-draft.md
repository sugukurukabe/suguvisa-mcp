# ChatGPT Apps Store (Apps SDK) — 申請フォーム下書き
# Submission form draft / Draf formulir pengajuan

提出先:
- <https://platform.openai.com/docs/apps-sdk>
- <https://platform.openai.com/docs/apps-sdk/submission>

申請窓口: OpenAI Platform → Apps → **Submit for review**

---

## 1. App Identity

| Field | Value (copy-paste) |
|---|---|
| **App name** | `SuguVisa — Japan SSW Visa AI` |
| **App ID (slug)** | `suguvisa-mcp` |
| **Developer name** | `Sugukuru Inc.` |
| **Developer legal name** | `スグクル株式会社 (Sugukuru Inc.)` |
| **Website** | `https://suguvisa.com` |
| **Support email** | `support@sugu-kuru.co.jp` |
| **Country** | `Japan` |
| **Address** | `〒892-0816 鹿児島県鹿児島市山下町7-1` |

## 2. Connection (MCP)

| Field | Value |
|---|---|
| **Manifest URL (Apps SDK)** | `https://mcp.suguvisa.com/.well-known/openai-app.json` |
| **GPT plugin manifest (legacy)** | `https://mcp.suguvisa.com/.well-known/ai-plugin.json` |
| **MCP server URL** | `https://mcp.suguvisa.com/mcp` |
| **OpenAPI 3.1 URL** | `https://mcp.suguvisa.com/openapi.yaml` |
| **Connection type** | `mcp` |
| **Transport** | `http` |

## 3. Listing Copy

### Tagline (≤ 60 chars, 英語)

```
Full automation for Japan's SSW visa applications.
```

### Localized taglines

| Locale | Value |
|---|---|
| `ja` | `日本の特定技能ビザを完全自動化。` |
| `en` | `Full automation for Japan's SSW visa applications.` |
| `id` | `Otomatisasi penuh visa SSW Jepang.` |

### Description (英語, 200-2000 chars)

```
SuguVisa is a business-grade ChatGPT app specialized in Japan's Specified Skilled Worker (SSW / 特定技能) visa. With 42 MCP tools, ChatGPT can guide you through the entire visa lifecycle — from determining the correct application type, to listing required documents with exemption logic, calculating the 14-day notification deadline, performing OCR on residence cards, generating the annual periodic-notification CSV, and tracking law changes.

Built for:
• Immigration lawyers (行政書士) processing dozens of SSW cases per month
• Registered support organizations (登録支援機関) managing annual reports
• Receiving companies (受入れ機関) hiring SSW workers directly
• Dispatched-worker platforms handling hundreds of placements

Every answer is grounded in authoritative sources — Immigration Services Agency notices and MOJ ordinances — with citations and confidence scores. No hallucinated visa advice.

Data residency: Tokyo (asia-northeast1). APPI-compliant. OAuth 2.1 + PKCE. PII encrypted at rest with Cloud KMS. Residence card images are discarded immediately after OCR.

Free plan available (5 basic tools, 100 calls/day). Starter ¥19,800/mo unlocks OCR, bulk generation, audit logging, and annual reports. Professional ¥49,800/mo adds legal search and autonomous workflow.
```

### Localized descriptions (ja / id は manifest に同期済)

マニフェスト `/.well-known/openai-app.json` の `localized_descriptions` を参照。

## 4. Categories

| Field | Value |
|---|---|
| **Primary** | `Business` |
| **Secondary** | `Legal`, `Productivity` |
| **Tags** | `immigration`, `visa`, `japan`, `ssw`, `hr`, `ocr`, `compliance` |
| **Content rating** | `general` |

## 5. Visual Assets

| Asset | Spec | URL |
|---|---|---|
| **Icon (512x512 PNG/SVG)** | 正方形、透過可 | `https://mcp.suguvisa.com/logo.svg` |
| **Store icon (1024x1024 PNG)** | 不透過推奨 | `https://mcp.suguvisa.com/icon-1024.png` ※申請前に PNG 書き出し要 |
| **Screenshot 1** | 1280x800 | `https://mcp.suguvisa.com/assets/screenshot-1.png` |
| **Screenshot 2** | 1280x800 | `https://mcp.suguvisa.com/assets/screenshot-2.png` |
| **Screenshot 3** | 1280x800 | `https://mcp.suguvisa.com/assets/screenshot-3.png` |
| **Screenshot 4** | 1280x800 | `https://mcp.suguvisa.com/assets/screenshot-4.png` |
| **Screenshot 5** | 1280x800 | `https://mcp.suguvisa.com/assets/screenshot-5.png` |

> ⚠️ **TODO**: `icon-1024.png` をまだ用意していない場合、logo.svg から書き出して `apps/mcp-server/public/icon-1024.png` に配置。

## 6. Legal & Compliance

| Field | Value |
|---|---|
| **Privacy policy** | `https://mcp.suguvisa.com/privacy` |
| **Terms of service** | `https://mcp.suguvisa.com/terms` |
| **Security** | `https://mcp.suguvisa.com/security` |
| **Support** | `https://mcp.suguvisa.com/support` |
| **Data residency** | `asia-northeast1 (Tokyo)` |
| **GDPR** | Not certified (primarily JP market) |
| **APPI** | Compliant |
| **SOC 2** | In progress |
| **Content rating** | `general` (no adult content, financial advice, or medical diagnosis) |

## 7. Authentication (OAuth)

| Field | Value |
|---|---|
| **Auth provider** | Auth0 |
| **Issuer** | `https://suguvisa-dev.jp.auth0.com/` |
| **Authorization URL** | `https://suguvisa-dev.jp.auth0.com/authorize` |
| **Token URL** | `https://suguvisa-dev.jp.auth0.com/oauth/token` |
| **Resource (audience)** | `https://mcp.suguvisa.com/` |
| **Grant types** | `authorization_code` + `refresh_token` |
| **PKCE** | Required (S256) |
| **DCR** | Enabled |

### Redirect URI (申請時に OpenAI から発行される)

```
⚠️ 申請後、OpenAI から ChatGPT 用 redirect_uri を受領
→ Auth0 Applications で ChatGPT 専用クライアント作成（DCR でも可）
→ Allowed Callback URLs に追加
```

### Requested scopes (申請フォームで選択)

| Scope | Description |
|---|---|
| `read:visa_case` | Read visa cases, patterns, and deadlines |
| `read:visa_rule` | Read application pattern catalog and rule sets |
| `read:golden_records` | Read authoritative immigration notices |
| `read:law_updates` | Track law changes |
| `generate:reason_letter` | Generate application reason letters |
| `generate:paper_form` | Map data to paper PDF forms |
| `generate:bulk_xlsm` | Generate bulk application Excel files |
| `generate:annual_report` | Generate annual notification CSV |
| `validate:application_data` | Validate applicant data |
| `review:document` | AI-powered document review |
| `write:submission_outcome` | Log submission outcomes |
| `write:audit_log` | Write audit log entries |
| `admin:tenant` | Manage tenant settings (optional) |
| `admin:golden_records` | Update reference data (optional) |
| `offline_access` | Refresh token for long sessions |

## 8. Pricing

| Plan | Price (JPY/month) | Currency | Included |
|---|---|---|---|
| **Free** | ¥0 | JPY | 5 basic tools, 100 calls/day |
| **Starter** | ¥19,800 | JPY | All visa tools, OCR, bulk generation, audit log, annual report |
| **Professional** | ¥49,800 | JPY | Starter + legal search + autonomous workflow + priority support |

- **Billing provider**: Stripe (Japan)
- **Billing model**: Subscription (monthly / yearly)
- **Trial**: 14-day free trial on Starter and Professional
- **Refund policy**: Pro-rated refund within first 30 days on request

## 9. Tools Overview (申請で「この app が何をするか」の説明用)

SuguVisa は 42 の MCP ツールを提供します。主要カテゴリ:

| Category | Tools (例) |
|---|---|
| **Pattern / routing** | `determine_application_type`, `get_required_documents`, `calculate_deadlines` |
| **OCR / data extraction** | `parse_residence_card`, `parse_passport`, `advanced_doc_extractor`, `lookup_corporate_number` |
| **Document generation** | `generate_online_csv`, `generate_bulk_xlsm`, `generate_paper_form`, `generate_reason_letter`, `generate_annual_report_csv` |
| **Validation** | `validate_application_data`, `ai_form_validator`, `pre_submission_checklist` |
| **Knowledge / search** | `search_golden_records`, `get_law_updates`, `search_legal_docs`, `get_complete_visa_guide` |
| **Audit / compliance** | `log_visa_action`, `get_visa_audit_logs`, `track_submission_outcome`, `check_wage_compliance`, `check_notification_deadline` |
| **Workflow** | `start_autonomous_visa_workflow`, `resume_autonomous_visa_workflow` |

完全なツール一覧は `/openapi.yaml` を参照。

## 10. Example Conversations (審査用)

### Example 1 — 申請パターン判定

> **User**: 技能実習 2 号から特定技能 1 号に変更したい社員がいます。必要書類と期限を教えて。
>
> **ChatGPT (via SuguVisa)**:
> 1. `determine_application_type` → `CHANGE_SSW1_C`（国内転職の標準ルート、審査期間 1〜3 ヶ月）
> 2. `get_required_documents` → 技能試験・日本語試験免除を自動適用した書類チェックリスト
> 3. `calculate_deadlines` → 14 日届出期限、在留期限からの逆算スケジュール

### Example 2 — 定期届出

> **User**: 今年度の定期届出 CSV を作成。対象者 24 名、全員スグクル派遣の農業分野。
>
> **ChatGPT (via SuguVisa)**:
> - `generate_annual_report_csv` が入管の正規フォーマットで出力
> - `validate:application_data` でデータ不整合を事前検出

### Example 3 — OCR + 検証

> **User**: 在留カード画像を添付「この方の在留期限は？」
>
> **ChatGPT (via SuguVisa)**:
> - `parse_residence_card` → 氏名・在留資格・在留期限抽出（画像は即時破棄）
> - `calculate_deadlines` → 次の届出期限を自動計算

## 11. Safety & Responsible AI

- **不可逆操作なし**: 入管への実申請送信は行わない。生成された書類は最終確認のうえユーザーが手動提出
- **PII 保護**: 在留カード・パスポート画像は OCR 後即時破棄、データベースに保存しない
- **テナント分離**: Supabase RLS で他テナントのデータには一切アクセス不可
- **出典付き回答**: すべての法令・通達引用に ID + 信頼スコア付き
- **レート制限**: per-principal 100 req/min、per-tenant 10,000 req/日
- **監査ログ**: 書き込みツールはすべて `write:audit_log` と連動、365 日保持、削除リクエスト可

## 12. Pre-submission Checklist (自動チェック)

```bash
# マニフェスト
curl -s https://mcp.suguvisa.com/.well-known/openai-app.json \
  | jq '{app_id, name, legal, pricing: .pricing.plans | length, screenshots: .screenshots | length}'

# OpenAPI
curl -s https://mcp.suguvisa.com/openapi.yaml | head -3

# MCP 疎通
curl -s -X POST https://mcp.suguvisa.com/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'

# 法務ページ全 200 確認
for p in / /privacy /terms /security /support /health; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' https://mcp.suguvisa.com$p)"
done
```

## 13. 申請フロー / Submission flow

1. OpenAI Platform → Apps → **Create app**
2. 基本情報を §1〜§7 から入力
3. Manifest URL を貼り付け → 自動検証
4. スクリーンショット 3-5 枚アップロード
5. OAuth redirect_uri を受領 → Auth0 側で ChatGPT クライアント設定
6. **Submit for review**
7. 審査（通常 1〜3 週間）→ 承認後 Apps Store で公開

## 14. 申請時の注意

- **申請順序**: Claude Connectors → ChatGPT Apps の順がおすすめ（Claude で先に実運用データが取れる）
- **審査中の問い合わせ**: OpenAI Developer Support に `support@sugu-kuru.co.jp` から 24 時間以内返信
- **ブランドガイドライン**: 「ChatGPT」「GPT」等 OpenAI 商標の誤用禁止。`SuguVisa` の名前のみ使用

---

**Last updated**: 2026-04-20
**App version**: 0.9.4
**Ready to submit**: ⚠️ `icon-1024.png` の書き出しと、スクリーンショット 5 枚配置後に送信可
