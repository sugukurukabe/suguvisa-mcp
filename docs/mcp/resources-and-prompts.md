# MCP Resources & Prompts 設計書 / Design / Desain

## 目的 / Goals / Tujuan

SuguVisa MCP が LLM クライアント (Claude.ai / ChatGPT / Cursor / Windsurf) に対して提供する **Resources**（事前に読める静的・半静的な知識データ）と **Prompts**（定型ワークフロー）を設計する。ツール呼び出しの精度・引用の正確性・オンボーディング効率を高めることが目的。

Define the **Resources** (pre-read static/semi-static knowledge) and **Prompts** (reusable workflow templates) that SuguVisa MCP exposes to LLM clients. Improves tool call precision, citation fidelity, and onboarding efficiency.

Definisikan **Resources** (pengetahuan statis/semi-statis yang dibaca di awal) dan **Prompts** (template alur kerja yang dapat digunakan kembali) yang diekspos SuguVisa MCP ke klien LLM. Meningkatkan presisi pemanggilan tool, ketepatan sitasi, dan efisiensi onboarding.

## Resources

### URI 設計

全 Resource の URI スキームは `suguvisa://` を使い、名前空間は以下で分類する:

| Prefix | 目的 |
| --- | --- |
| `suguvisa://patterns/...` | 申請パターン (変更・更新・認定・転職等) |
| `suguvisa://industries/...` | 16 特定産業分野 |
| `suguvisa://forms/...` | 参考様式 (申請書類テンプレート) |
| `suguvisa://deadlines/...` | 期限ルール |
| `suguvisa://rules/...` | ビザルール全般 (work_during_application / version) |
| `suguvisa://law-updates/...` | 法改正情報 |
| `suguvisa://golden-records/...` | Golden Records (ナレッジベース) |
| `suguvisa://server/...` | サーバーメタ情報 (info / slo / changelog) |
| `suguvisa://compliance/...` | コンプライアンス (PII / legal-basis) |

### Static resources (固定 URI)

| URI | 形式 | 説明 |
| --- | --- | --- |
| `suguvisa://patterns/list` | JSON | 全申請パターンのサマリ |
| `suguvisa://industries/list` | JSON | 16 分野のサマリ |
| `suguvisa://forms/list` | JSON | 参考様式の一覧 |
| `suguvisa://law-updates/latest` | JSON | 法改正情報の最新リスト |
| `suguvisa://deadlines/rules` | JSON | 期限計算ルール（14日届出、3ヶ月更新、5年上限等）|
| `suguvisa://rules/work-during-application` | JSON | 申請中の就労可否ルール |
| `suguvisa://rules/version` | JSON | 搭載ルールセットのバージョン・更新者 |
| `suguvisa://golden-records/registry` | JSON | ローカル Golden Records レジストリ |
| `suguvisa://golden-records/types` | JSON | Golden Records の type 一覧 |
| `suguvisa://server/info` | JSON | サーバー名・バージョン・機能一覧 |
| `suguvisa://server/slo` | JSON | SLO / プラン別 SLA |
| `suguvisa://server/changelog` | JSON | 機能追加・変更の履歴 |
| `suguvisa://compliance/pii` | Markdown | PII 取扱いポリシー |

### Template resources (パラメータライズド URI)

MCP SDK の `ResourceTemplate` を使い、URI テンプレートで個別エンティティを返す:

| URI テンプレート | 説明 | autocomplete 対応 |
| --- | --- | --- |
| `suguvisa://patterns/{id}` | 申請パターンの完全な詳細 (書類・試験免除・注記) | ✅ |
| `suguvisa://industries/{code}` | 分野コードごとの詳細 | ✅ |
| `suguvisa://forms/{key}` | 参考様式の詳細 | ✅ |
| `suguvisa://golden-records/{type}` | type 別の Golden Records リスト (Firestore 接続時のみ) | ✅ |

`list` コールバックで既知の全 URI を列挙し、`complete` コールバックで path 変数の候補を返す。
これにより Claude.ai の画面で URI 入力時に補完が効く。

### Golden Records 連携

`registerGoldenRecordResources(server, { store })` に `GoldenRecordStore` を渡すと、Firestore 実データを `suguvisa://golden-records/{type}` として公開する。
レスポンス内の `embedding` フィールドは **常に除去** される (ペイロード肥大化と情報漏れ回避)。
store 未接続時 (CI / 開発環境) は template resource を **登録しない**。

### セキュリティ / PII

- Resource は **読み取り専用**、PII を含まない形で設計
- `embedding` 等の内部データは露出しない
- `suguvisa://compliance/pii` で明示的にポリシーを公開

## Prompts

### 既存 Prompts (register-tools.ts)

既に以下 8 件が登録済み:
`suguvisa_titp_to_ssw1_workflow` / `suguvisa_job_change_checklist` / `suguvisa_renewal_preparation` / `suguvisa_residence_card_verify` / `suguvisa_deadline_timeline_visualize` / `suguvisa_autonomous_visa_wizard` / `suguvisa_submission_feedback_record` / `suguvisa_ssw2_application_prepare`

### 新規追加 Prompts (resources/prompts.ts)

| 名称 | 目的 |
| --- | --- |
| `suguvisa_citation_answer_generate` | Golden Records を参照し、**出典付き** で質問に回答する |
| `suguvisa_ssw2_field_eligibility_check` | 特定技能2号の分野適合性を判定 |
| `suguvisa_weekly_visa_status_review` | 週次の在留状況レビュー (ダッシュボード生成) |
| `suguvisa_pre_submission_final_check` | 提出前の最終チェック (paper / online 切替) |
| `suguvisa_incident_triage` | 障害時の一次トリアージ |
| `suguvisa_tenant_onboarding` | 新規テナント (行政書士事務所 / 受入れ機関) のオンボーディング |

### 設計原則

1. **リソース経由で根拠を示す**: 各 prompt は `suguvisa://` URI を読むよう指示する
2. **構造化出力**: 表 (Markdown) / チェックリストで出力
3. **安全装置**: PII を含む質問には「回答本文ではマスクする」旨を明示
4. **計測可能性**: `operation` が自動的に observability の context に載る

## 拡張ポイント / Future Work

- `suguvisa://compliance/legal-basis/{rule_id}` — 各ルールの法令根拠を Resource として公開
- `suguvisa://server/metrics` — Prometheus スタイルの自己観測指標 (レート制限 / ツール成功率)
- Prompts を `@suguvisa/prompts` パッケージに抽出し、evals と組み合わせて A/B テスト
- Resource に更新通知 (sendResourceListChanged) を追加して、ルール改訂時にクライアント側で再読込

## テスト / Tests

`src/resources/__tests__/resources.test.ts` で以下を検証:
- 主要 13 件の静的 resource が URI で登録されている
- 3 + 1 件の template resource が URI テンプレートで登録されている
- パターン / 分野 / 様式の個別 resource が存在/不在で適切にハンドルされる
- Golden Records template は store 有無で条件付き登録
- 新規 6 件の prompt が args に応じて本文を生成する

`pnpm --filter @suguvisa/mcp-server-app test` — 全 **158 passed**
