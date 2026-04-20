# Claude Connectors Directory — 申請フォーム下書き
# Submission form draft / Draf formulir pengajuan

提出先: <https://support.anthropic.com/en/articles/11503832-claude-connectors-directory>
申請窓口: Anthropic Console → Settings → Connectors → **Submit to Directory**

---

## 1. Basic Information

| Field | Value (copy-paste) |
|---|---|
| **Display name** | `SuguVisa — Japan SSW Visa AI` |
| **Publisher / Organization** | `Sugukuru Inc.` |
| **Publisher legal name** | `スグクル株式会社 (Sugukuru Inc.)` |
| **Contact email** | `support@sugu-kuru.co.jp` |
| **Website** | `https://suguvisa.com` |
| **Country / Region** | `Japan (JP)` |
| **Business address** | `〒892-0816 鹿児島県鹿児島市山下町7-1` |

## 2. Connector Technical Details

| Field | Value |
|---|---|
| **MCP server URL** | `https://mcp.suguvisa.com/mcp` |
| **Server card URL** | `https://mcp.suguvisa.com/.well-known/mcp/server-card.json` |
| **Protected resource metadata** | `https://mcp.suguvisa.com/.well-known/oauth-protected-resource` |
| **Authentication** | `OAuth 2.1 (Authorization Code + PKCE) via Auth0` |
| **DCR (Dynamic Client Registration)** | `Enabled` |
| **Supported protocol version** | `2024-11-05` |
| **Transport** | `HTTP (Streamable)` |

## 3. Listing Copy (そのままフォームに貼れる形式)

### Short description (≤ 200 chars, 英語)

```
Full automation for Japan's Specified Skilled Worker (SSW) visa. Pattern detection, deadline calculation, document generation, and annual reports in one connector — built for immigration lawyers and receiving companies.
```

### Long description (英語, 200-2000 chars)

```
SuguVisa is a business-grade AI connector specialized in Japan's Specified Skilled Worker (SSW / 特定技能) visa. It exposes 42 MCP tools covering the full lifecycle of a visa case:

• Automatic application pattern detection (GRANT, RENEWAL, CHANGE_A/B/C/D) from the applicant's current status
• Required document checklists with built-in exemption logic (e.g. skipping tax certificates for applicants renewing within the same company within 1 year)
• Deadline computation — 14-day notification rule, 5-year cumulative cap on SSW1, 3-month renewal window
• Residence card and passport OCR (Google Cloud Document AI) with PII encryption via Cloud KMS
• Periodic notification CSV and Excel generation for the annual report to the Immigration Services Agency
• Paper-form PDF auto-mapping (in case of offline submission)
• Law-change tracking (SSW industry categories, test exemption rules, wage compliance thresholds)
• Audit logging for compliance (retained 365 days, deletable on request)

Built for immigration lawyers (行政書士), registered support organizations (登録支援機関), receiving companies (受入れ機関), and dispatched-worker platforms handling dozens to thousands of SSW cases. All tools return structured JSON with citations to the authoritative source (Immigration Services Agency notices, MOJ ordinances), enabling Claude to produce grounded, verifiable answers rather than guesses.

Data residency: asia-northeast1 (Tokyo). Compliant with Japan's Act on Protection of Personal Information (APPI). OAuth 2.1 with PKCE required.
```

### Japanese description (任意だが推奨)

```
SuguVisa は、日本の特定技能（SSW）ビザ申請に特化した業務用 AI コネクタです。42 の MCP ツールで、申請種別の自動判定、必要書類リスト（省略条件自動適用）、期限計算（14 日届出ルール・通算 5 年上限・更新申請 3 ヶ月前）、在留カード OCR、定期届出 CSV/Excel 生成、紙様式 PDF マッピング、法改正追跡、監査ログを提供します。行政書士・登録支援機関・受入れ機関・派遣事業者が、Claude と対話しながら数十〜数千件のビザ案件を処理できます。

すべてのツールは出典（入管通達・法務省令）付きの構造化 JSON を返すため、Claude の回答は推測ではなく根拠のある回答になります。データは東京リージョン (asia-northeast1) に保管、日本の個人情報保護法 (APPI) 準拠、OAuth 2.1 + PKCE 必須。
```

## 4. Categories & Tags

| Field | Value |
|---|---|
| **Primary category** | `Business` |
| **Secondary categories** | `Legal`, `Productivity` |
| **Tags** | `immigration`, `visa`, `japan`, `ssw`, `specified-skilled-worker`, `hr`, `ocr`, `compliance` |

## 5. Visual Assets

| Asset | URL |
|---|---|
| **Icon (256x256+ PNG/SVG)** | `https://mcp.suguvisa.com/logo.svg` |
| **OG image (1200x630 PNG)** | `https://mcp.suguvisa.com/og-image.png` |
| **Screenshot 1 — 申請パターン判定** | `https://mcp.suguvisa.com/assets/screenshot-1.png` |
| **Screenshot 2 — 期限計算** | `https://mcp.suguvisa.com/assets/screenshot-2.png` |
| **Screenshot 3 — 定期届出 CSV** | `https://mcp.suguvisa.com/assets/screenshot-3.png` |
| **Screenshot 4 — Golden Records 引用** | `https://mcp.suguvisa.com/assets/screenshot-4.png` |
| **Screenshot 5 — 在留カード OCR** | `https://mcp.suguvisa.com/assets/screenshot-5.png` |

## 6. Legal & Compliance

| Field | Value |
|---|---|
| **Privacy policy URL** | `https://mcp.suguvisa.com/privacy` |
| **Terms of service URL** | `https://mcp.suguvisa.com/terms` |
| **Security overview URL** | `https://mcp.suguvisa.com/security` |
| **Support URL** | `https://mcp.suguvisa.com/support` |
| **Status page URL** | `https://mcp.suguvisa.com/health` |
| **security.txt** | `https://mcp.suguvisa.com/.well-known/security.txt` |
| **Data residency** | `asia-northeast1 (Tokyo), Japan` |
| **Encryption at rest** | `Google Cloud KMS (AES-256)` |
| **Encryption in transit** | `TLS 1.3` |
| **Data retention** | `365 days default; deletable on request` |
| **Applicable frameworks** | `APPI (Japan Act on Protection of Personal Information)` |
| **Subprocessors** | Google Cloud Platform, Supabase, Stripe, Auth0 |

## 7. OAuth Configuration

| Field | Value |
|---|---|
| **OAuth issuer** | `https://suguvisa-dev.jp.auth0.com/` |
| **Authorization endpoint** | `https://suguvisa-dev.jp.auth0.com/authorize` |
| **Token endpoint** | `https://suguvisa-dev.jp.auth0.com/oauth/token` |
| **Resource indicator (audience)** | `https://mcp.suguvisa.com/` |
| **Grant types** | `authorization_code`, `refresh_token` |
| **PKCE** | `Required (S256)` |
| **Dynamic Client Registration** | `Enabled (OIDC DCR)` |

### Scopes (現在は Auth0 API に全 13 + offline_access を登録済み)

| Scope | Purpose |
|---|---|
| `read:visa_case` | 案件情報・申請パターン・期限の参照 |
| `read:golden_records` | 入管通達・公式情報の検索 |
| `read:law_updates` | 法改正情報の取得 |
| `generate:reason_letter` | 申請理由書の生成 |
| `generate:paper_form` | 紙様式 PDF の自動マッピング |
| `generate:bulk_xlsm` | 一括申請 Excel の生成 |
| `generate:annual_report` | 定期届出 CSV の生成 |
| `validate:application_data` | 申請データ検証 |
| `review:document` | AI 書類レビュー |
| `write:submission_outcome` | 申請結果の記録 |
| `write:audit_log` | 監査ログの書き込み |
| `admin:tenant` | テナント設定の変更 |
| `admin:golden_records` | 公式情報の更新 |
| `offline_access` | リフレッシュトークン取得 |

## 8. Pricing

| Plan | Price (JPY/month) | Features |
|---|---|---|
| **Free** | ¥0 | 5 basic tools, 100 calls/day |
| **Starter** | ¥19,800 | All visa tools, OCR, bulk generation, audit log, annual report, 10,000 calls/month |
| **Professional** | ¥49,800 | Starter + legal search + autonomous workflow + priority support, unlimited calls |

詳細: `https://mcp.suguvisa.com/.well-known/mcp/server-card.json` の `plans` フィールド

## 9. Use Cases (審査官向け具体例)

### Use case 1 — 行政書士が技能実習 2 号から特定技能 1 号への変更申請を準備

> User: 「A さんは技能実習 2 号を今年 6 月に修了予定で、同じ農業分野で特定技能 1 号に変更したいです。必要書類を教えて」
>
> Claude + SuguVisa:
> - `determine_application_type` で `CHANGE_SSW1_C` を自動判定
> - `get_required_documents` で技能試験・日本語試験免除の省略ロジックを適用した書類チェックリストを返す
> - `calculate_deadlines` で在留期限からの逆算スケジュールを提示
> - `generate_reason_letter` でドラフトを生成

### Use case 2 — 登録支援機関の定期届出（年 1 回）

> User: 「今年度の定期届出 CSV を作成して。対象者は 24 名」
>
> Claude + SuguVisa:
> - `generate_annual_report_csv` が入管の正規フォーマットで CSV 出力
> - `validate:application_data` で事前検証、不備があればエラー箇所を自然言語で返す

### Use case 3 — 在留カード OCR + 即時検証（Professional プラン）

> User: 在留カードの画像を添付
>
> Claude + SuguVisa:
> - `parse_residence_card` で氏名・在留資格・在留期限を抽出（PII は即時破棄）
> - `calculate_deadlines` で次の届出期限を提示

## 10. Safety & Responsible Use

- すべてのツールは **閲覧・生成** が中心で、入管への実申請送信は **行わない**
- 書類生成は確認プロンプト付き（最終提出前にユーザーレビュー必須）
- 在留カード・パスポート画像はサーバーに保存せず、OCR 後即時破棄
- 監査ログは tenant 単位で独立（他テナントのデータには一切アクセス不可、Supabase RLS で強制）
- レート制限: per-principal で 100 req/min、per-tenant で 10,000 req/日
- エラー時は機密情報を含まない自然言語メッセージを返す

## 11. Pre-submission Self-check

```bash
# すべて 200 OK を確認
for p in \
  /.well-known/mcp/server-card.json \
  /.well-known/oauth-protected-resource \
  /.well-known/security.txt \
  /privacy /terms /security /support /health \
  /logo.svg /og-image.png \
  /assets/screenshot-1.png /assets/screenshot-2.png /assets/screenshot-3.png
do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' https://mcp.suguvisa.com$p)"
done

# MCP 疎通
npx -y @modelcontextprotocol/inspector https://mcp.suguvisa.com/mcp
```

## 12. 申請フロー / Submission flow

1. Anthropic Console にログイン
2. Settings → **Connectors Directory** → **Submit new connector**
3. 上記 §1〜§10 をコピペ
4. スクリーンショットをアップロード or URL で指定
5. Anthropic の審査（通常 5〜10 営業日）
6. 承認後、Directory で公開

## 13. 審査中の連絡先

審査官からの質問には **24 時間以内** に返信すること（`support@sugu-kuru.co.jp` 自動転送済み）。

---

**Last updated**: 2026-04-20
**Server version**: 0.9.4
**Ready to submit**: ✅ 全項目本番で 200 OK 確認済み（スクリーンショットアップロード後に送信可）
