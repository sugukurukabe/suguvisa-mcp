# 🛂 SuguVisa MCP — 特定技能ビザ申請を完全自動化するAIサーバー

[![Smithery](https://smithery.ai/badge/@a-kabe-1qio/suguvisa-mcp)](https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp)

> **日本の特定技能（SSW）ビザ申請業務を、AIチャットだけで完結させる業界唯一のMCPサーバー。**

行政書士・登録支援機関・受入れ機関が日常的に行うビザ申請業務——申請種別の判定、必要書類の洗い出し、期限管理、書類生成——を **18種のAIツール** で自動化。Claude、ChatGPT、Cursor、Windsurf 等のAIアシスタントに直接組み込んで使えます。

### ✨ できること

- 🔍 **申請パターンの自動判定** — 「技能実習2号→特定技能1号」のように現在と申請先のビザを伝えるだけで、正式な申請種別・使用様式・標準処理期間・試験免除条件を瞬時に特定
- 📋 **必要書類リストの自動生成** — 130以上の申請パターンに対応。「2年以内の同一機関申請で省略可」「登録支援機関への委託で不要」等の省略条件を自動適用
- ⏰ **期限計算** — 随時届出の14日ルール、更新申請の3ヶ月前開始日、通算在留5年上限チェック、認定証明書の有効期限を自動算出し、リスクレベルを色分け警告
- 📸 **在留カードOCR** — Google Vertex AI Document AIによる高精度読み取り。氏名・国籍・在留資格・期限・カード番号を構造化データに変換（画像は保存しません）
- 📄 **オンライン申請CSV/Excel生成** — 入管オンライン申請システムに直接アップロード可能な形式で一括出力。公式.xlsmテンプレートへのマクロ非破壊データ注入にも対応
- 📝 **紙申請PDFマッピング** — 紙申請書の全フィールドにデータを自動マッピングし、完成度をパーセント表示
- 📊 **年次定期届出の自動生成** — 受入れ状況・活動状況・支援実施状況をCSV（オンライン用）とExcel（紙提出用）で同時出力
- 🤖 **自律型ワークフロー** — AIが対話で不足データを収集し、判定→検証→書類生成まで自動実行。途中で人間の確認を挟むHITLパターン対応
- ⚖️ **法改正の自動追跡** — 制度変更・運用要領の改定を自動的に把握し、申請への影響を通知
- 🔎 **法務文書のAI検索** — Vertex AI Searchで法務マニュアル・チェックリスト・テンプレートを自然言語検索
- 📈 **申請結果の統計分析** — 補正率・通過率を申請パターンごとに集計し、次回申請の改善提案を自動生成
- 🔒 **監査ログ** — 全操作をSupabaseに記録し、コンプライアンスとトレーサビリティを確保

### 🌏 対応プラットフォーム

| プラットフォーム | 接続方式 |
|:---:|:---:|
| **Claude Desktop / Cursor / Windsurf** | stdio MCP |
| **Claude.ai** | Remote MCP (Streamable HTTP) |
| **ChatGPT** | GPT Actions (OpenAPI) |
| **REST API** | Bearer Token 認証 |

## 🚀 クイックスタート

### Smithery 経由（推奨・ワンクリック）

```bash
npx -y @smithery/cli install @a-kabe-1qio/suguvisa-mcp --client claude
```

### Claude Desktop / Cursor（ローカル stdio）

`claude_desktop_config.json` に追加:

```json
{
  "mcpServers": {
    "suguvisa": {
      "command": "npx",
      "args": ["-y", "suguvisa-mcp"]
    }
  }
}
```

### Claude.ai（Remote MCP）

Settings > Integrations > Add Integration:
```
URL: https://suguvisa-mcp-731026511067.asia-northeast1.run.app/mcp
```

### ChatGPT（GPT Actions）

GPT Builder > Actions > Import from URL:
```
https://suguvisa-mcp-731026511067.asia-northeast1.run.app/openapi.yaml
```
Authentication: API Key (Bearer)

### REST API

```bash
# 申請種別の判定
curl -X POST https://suguvisa-mcp-731026511067.asia-northeast1.run.app/api/v1/tools/determine \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from_visa":"技能実習2号","to_visa":"特定技能1号"}'

# 期限計算
curl -X POST .../api/v1/tools/deadlines \
  -d '{"expiry_date":"2026-05-15","event_date":"2026-04-01"}'

# 法改正情報
curl https://suguvisa-mcp-731026511067.asia-northeast1.run.app/api/v1/tools/law-updates
```

---

## 🛠 提供ツール（18本）

### 判定・検証系
| ツール | REST エンドポイント | 説明 |
|--------|---------------------|------|
| `determine_application_type` | `POST /determine` | 在留資格変更の申請パターンを自動判定 |
| `get_required_documents` | `POST /required-documents` | 必要書類リスト（省略条件の自動判定付き） |
| `validate_application_data` | `POST /validate` | 在留カード番号、法人番号、日付等の検証 |
| `calculate_deadlines` | `POST /deadlines` | 期限計算（随時届出14日ルール、更新時期等） |
| `check_csv_missing_fields` | — | CSV 生成前の必須フィールドチェック |

### 入力支援系
| ツール | 説明 |
|--------|------|
| `generate_intake_sheet` | 情報入力シートを自動生成 |
| `parse_residence_card` | 在留カード OCR 結果の構造化・検証 |

### 出力・書類生成系
| ツール | REST エンドポイント | 説明 |
|--------|---------------------|------|
| `generate_online_csv` | `POST /annual-report-csv` | オンライン申請用 CSV 生成 |
| `generate_annual_report_offline` | `POST /annual-report-excel` | 定期報告 Excel 自動生成 |
| `generate_paper_form` | — | 紙申請用 PDF フォームマッピング |
| `generate_bulk_xlsm` | — | 一括申請用 Excel(.xlsm) データ注入 |

### エージェント系
| ツール | 説明 |
|--------|------|
| `start_autonomous_visa_workflow` | 自律型ビザ申請ワークフローを開始 |
| `resume_autonomous_visa_workflow` | 一時停止ワークフローを再開（HITL） |
| `track_submission_outcome` | 申請結果の記録と自己改善統計 |
| `log_visa_action` | 操作ログの記録 |
| `get_visa_audit_logs` | 監査ログの取得 |

### 情報系
| ツール | REST エンドポイント | 説明 |
|--------|---------------------|------|
| `get_law_updates` | `GET /law-updates` | 法改正・制度変更情報 |
| `search_legal_docs` | — | 法務文書のセマンティック検索 |

---

## 📐 アーキテクチャ

```
suguvisa-mcp/
├── src/
│   ├── index.ts              # Claude Desktop / Cursor (stdio MCP)
│   ├── server.ts             # HTTP サーバー (MCP + REST + Plugin Meta)
│   ├── services/             # サービスレイヤー
│   ├── routes/               # REST API & Plugin メタデータ
│   ├── tools/                # MCP ツール定義 (18本)
│   ├── agents/               # Vertex AI チャットエージェント (オプション)
│   ├── middleware/            # 認証、レートリミット、ログ
│   └── data/                 # ルールセット、法改正データ
├── public/
│   └── openapi.yaml          # OpenAPI 3.1 仕様書
└── smithery.yaml             # Smithery 設定
```

### 環境変数

| 変数 | 必須 | 説明 |
|------|:----:|------|
| `SUGUVISA_API_KEY` | 推奨 | REST API 用 Bearer 認証キー |
| `SUGUVISA_BASE_URL` | — | 本番 URL（デフォルト: localhost） |
| `GCP_PROJECT_ID` | △ | 在留カード OCR 利用時 |
| `GOOGLE_APPLICATION_CREDENTIALS` | △ | GCP サービスアカウントキー |
| `SUPABASE_URL` | △ | マルチテナント認証用 |
| `SUPABASE_SERVICE_KEY` | △ | Supabase サービスキー |

---

## 💻 開発

```bash
npm install
npm run build          # TypeScript ビルド
npm run dev            # 開発モード (stdio MCP)
npm run dev:http       # 開発モード (HTTP サーバー)
npm run start:http     # 本番起動
npm run test           # テスト
```

### エンドポイント

| エンドポイント | 用途 |
|--------------|------|
| `GET /health` | ヘルスチェック |
| `POST /mcp` | Claude.ai Remote MCP |
| `POST /api/v1/tools/*` | GPT Actions / REST API |
| `GET /.well-known/ai-plugin.json` | GPT プラグイン発見 |
| `GET /openapi.yaml` | OpenAPI 3.1 仕様書 |
| `GET /privacy` | プライバシーポリシー |

---

## 📄 ライセンス

MIT — [スグクル株式会社](https://sugu-kuru.co.jp)
