# SuguVisa — 特定技能ビザ申請 AI プラグイン

特定技能ビザ申請に特化した AI プラグイン。**Claude** と **ChatGPT** の両方に対応。

行政書士・登録支援機関・受入れ機関向け。

```
┌──────────────────────────────────────────────────────┐
│                     SuguVisa v0.2.0                  │
│                                                      │
│   ┌───────────┐  ┌───────────┐  ┌───────────────┐   │
│   │  Claude   │  │  ChatGPT  │  │  REST API     │   │
│   │  (MCP)    │  │  (Actions)│  │  (External)   │   │
│   └─────┬─────┘  └─────┬─────┘  └──────┬────────┘   │
│         │              │               │             │
│         ▼              ▼               ▼             │
│   ┌─────────────────────────────────────────────┐    │
│   │          Services Layer (Core Logic)         │    │
│   └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

## 接続方法

### 1. Claude Desktop / Cursor（ローカル stdio MCP）

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

または、GCP連携（在留カードOCR等）を使う場合:

```json
{
  "mcpServers": {
    "suguvisa": {
      "command": "node",
      "args": ["/path/to/suguvisa-mcp/dist/index.js"],
      "env": {
        "GCP_PROJECT_ID": "your-gcp-project",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/gcs-key.json"
      }
    }
  }
}
```

### 2. Claude.ai（Remote MCP コネクタ）

Settings > Connectors > Add custom connector:
```
URL: https://suguvisa-mcp.sugu-kuru.co.jp/mcp
Authentication: Bearer <your-api-key>
```

### 3. ChatGPT（Custom GPT / GPT Actions）

GPT Builder で新しい GPT を作成し、Actions を追加:

1. **Import from URL** をクリック
2. 以下の URL を入力:
   ```
   https://suguvisa-mcp.sugu-kuru.co.jp/openapi.yaml
   ```
3. Authentication → **API Key** → Bearer Token を設定
4. GPT の Instructions に以下を追加:
   ```
   まず /determine を呼んで申請パターンを特定し、
   返ってきた pattern_id を /required-documents に渡してください。
   ```

### 4. REST API（直接利用）

```bash
# 申請種別の判定
curl -X POST https://suguvisa-mcp.sugu-kuru.co.jp/api/v1/tools/determine \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from_visa":"技能実習2号","to_visa":"特定技能1号"}'

# 期限計算
curl -X POST .../api/v1/tools/deadlines \
  -d '{"expiry_date":"2026-05-15","event_date":"2026-04-01"}'

# 法改正情報
curl https://suguvisa-mcp.sugu-kuru.co.jp/api/v1/tools/law-updates
```

---

## 提供ツール（15本）

### 判定・検証系
| ツール | REST エンドポイント | 説明 |
|--------|---------------------|------|
| `determine_application_type` | `POST /api/v1/tools/determine` | 現在のビザ＋申請するビザから申請種別を自動判定 |
| `get_required_documents` | `POST /api/v1/tools/required-documents` | 必要書類リスト（省略条件の自動判定付き） |
| `validate_application_data` | `POST /api/v1/tools/validate` | 在留カード番号、法人番号、日付等の検証 |
| `calculate_deadlines` | `POST /api/v1/tools/deadlines` | 期限計算（随時届出14日ルール、更新時期等） |

### 入力支援系
| ツール | 説明 |
|--------|------|
| `generate_intake_sheet` | クライアントに渡す情報入力シートを自動生成 |
| `parse_residence_card` | 在留カードOCR結果の構造化・検証（Document AI連携） |

### 出力系
| ツール | REST エンドポイント | 説明 |
|--------|---------------------|------|
| `generate_online_csv` | `POST /api/v1/tools/annual-report-csv` | オンライン申請用CSVファイル生成 |
| `generate_annual_report_offline` | `POST /api/v1/tools/annual-report-excel` | オフライン定期報告Excel自動生成 |
| `generate_paper_form` | — | 紙申請用PDFフォームフィールドマッピング |
| `generate_bulk_xlsm` | — | 一括申請用Excel(.xlsm)へのデータ注入 |

### エージェント系
| ツール | 説明 |
|--------|------|
| `start_autonomous_visa_workflow` | 自律型ビザ申請ワークフローを開始 |
| `resume_autonomous_visa_workflow` | 一時停止したワークフローを再開（HITL） |
| `track_submission_outcome` | 申請結果の記録と自己改善統計 |

### 情報系
| ツール | REST エンドポイント | 説明 |
|--------|---------------------|------|
| `get_law_updates` | `GET /api/v1/tools/law-updates` | 法改正・制度変更情報 |
| `search_legal_docs` | — | 法務文書のセマンティック検索 |

---

## アーキテクチャ

```
suguvisa-mcp/
├── src/
│   ├── index.ts              # Claude Desktop / Cursor (stdio MCP)
│   ├── server.ts             # HTTP サーバー (MCP + REST + Plugin Meta)
│   ├── services/             # ★ サービスレイヤー (re-export hub)
│   │   └── index.ts
│   ├── routes/
│   │   ├── tools-rest.ts     # ★ GPT Actions 用 REST API ルーター
│   │   └── plugin-meta.ts    # ★ .well-known, openapi.yaml, /privacy
│   ├── tools/                # MCP ツール定義
│   ├── agents/               # Vertex AI チャットエージェント (オプション)
│   ├── middleware/            # 認証、レートリミット、ログ
│   └── data/                 # ルールセット、法改正データ
├── public/
│   └── openapi.yaml          # ★ OpenAPI 3.1 仕様書
├── chat-ui/                  # スタンドアロンWebフロントエンド (オプション)
└── claude-desktop-config.example.json
```

### 環境変数

| 変数 | 必須 | 説明 |
|------|:----:|------|
| `SUGUVISA_API_KEY` | 推奨 | Bearer 認証用 API キー |
| `SUGUVISA_BASE_URL` | — | 本番URL（GPTプラグイン用、デフォルト: localhost） |
| `ENABLE_STANDALONE_CHAT` | — | `true` で Vertex AI チャットモード有効化 |
| `GCP_PROJECT_ID` | △ | GCPプロジェクトID（Document AI使用時） |
| `GOOGLE_APPLICATION_CREDENTIALS` | △ | GCPサービスアカウントキー |
| `SUPABASE_URL` | △ | SaaS マルチテナント認証用 |
| `SUPABASE_SERVICE_KEY` | △ | Supabase サービスキー |

---

## 開発

```bash
npm install
npm run build          # TypeScript ビルド
npm run dev            # 開発モード (stdio MCP)
npm run dev:http       # 開発モード (HTTP サーバー)
npm run start:http     # 本番起動
npm run test           # テスト
```

### サーバー起動後のエンドポイント

| エンドポイント | 用途 |
|--------------|------|
| `GET /health` | ヘルスチェック |
| `POST /mcp` | Claude.ai Remote MCP |
| `POST /api/v1/tools/*` | GPT Actions / REST API |
| `GET /.well-known/ai-plugin.json` | GPT プラグイン発見 |
| `GET /openapi.yaml` | OpenAPI 3.1 仕様書 |
| `GET /privacy` | プライバシーポリシー |

---

## ライセンス

MIT — Sugukuru Inc.
