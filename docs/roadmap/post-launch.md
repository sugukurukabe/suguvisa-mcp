# SuguVisa MCP — ディレクトリ公開後ロードマップ
# Post-launch roadmap / Peta jalan pasca peluncuran

Claude Connectors Directory / ChatGPT Apps Store への掲載完了後に着手する改善項目です。
審査通過を最優先にするため、公開前には実装しません。

## P1 — 即対応 (公開後 1〜2 週間以内) / Immediate

### 1. `list_application_patterns` / `get_pattern_catalog` ツールの追加

**背景**: 現状、申請パターンを網羅取得するエンドポイントが無い。
Claude / ChatGPT は `suguvisa_reason_letter_generate` の description に散在している ID
（`GRANT_01`, `CHANGE_SSW1_C`, `CHANGE_TOKKATSU_A〜D`, `GENERIC` 等）を
拾い集めて推測する必要があり、UX 上のロスが発生している（実ケースで確認済み）。

**実装スケッチ**:

```typescript
// apps/mcp-server/src/tools/list-application-patterns.ts
server.tool(
  "list_application_patterns",
  "SuguVisa が対応する申請パターンの完全一覧を返す。List all supported application patterns. Daftar semua pola aplikasi.",
  { locale: z.enum(["ja", "en", "id"]).default("ja").describe("表示言語") },
  async ({ locale }) => {
    const patterns = await loadPatternRegistry(locale);
    return { content: [{ type: "text", text: JSON.stringify(patterns, null, 2) }] };
  }
);
```

**出力イメージ**:

```json
{
  "patterns": [
    {
      "id": "CHANGE_SSW1_C",
      "type": "変更",
      "name": "在留資格変更（直接特定技能1号）",
      "trigger": "国内転職の標準ルート",
      "reviewPeriod": "1〜3ヶ月",
      "from": ["技能実習2号修了", "留学", "その他就労系"],
      "to": "特定技能1号",
      "employmentModes": ["sugukuru_dispatch", "sugukuru_agriculture", "direct_hire"]
    },
    /* ... */
  ]
}
```

**スコープ**: `read:visa_rule`（新規追加が必要）

**スコープマップ更新**:

```typescript
// apps/mcp-server/src/lib/tool-scopes.ts
list_application_patterns: ['read:visa_rule'],
get_pattern_catalog: ['read:visa_rule'],
```

### 2. `pattern_id` 命名体系の正規化

**背景**: 現在、2 系統の命名が混在している。

| 系統 | 例 | 出現場所 |
|---|---|---|
| v3 スキル（短縮形） | `grant`, `renewal`, `change_a`, `change_b`, `change_c`, `change_d` | `sugukuru-visa-applications` スキル、`rule-sets.json` |
| MCP スキーマ（詳細形） | `GRANT_01`, `CHANGE_SSW1_C`, `CHANGE_TOKKATSU_A〜D`, `GENERIC` | `suguvisa_reason_letter_generate` 等の description |

これが原因で AI クライアント（Claude / ChatGPT）が
「同じ申請パターンなのに 2 つ ID がある」と混乱し、
誤った `pattern_id` を渡すリスクがある。

**方針案**（要決定）:
- **案 A**: 詳細形を正とし、短縮形をエイリアスとして受ける
- **案 B**: 短縮形を正とし、詳細形をエイリアスとして受ける
- **案 C**: 両方を受け付けるバリデーション層を入れて、正規化関数 `normalizePatternId()` で内部的に統一

**推奨**: 案 C（段階的移行）
- Phase 1: `normalizePatternId()` を `packages/rules-engine` に追加
- Phase 2: すべてのツール入力で最初に `normalizePatternId()` を通す
- Phase 3: 将来的に短縮形 or 詳細形を deprecate（半年後の判断）

**実装タスク**:
- [ ] `packages/rules-engine/src/normalize-pattern-id.ts` を新規作成
- [ ] 既存ツールの入力バリデーションに挿入
- [ ] `list_application_patterns` は両方の ID を `aliases[]` で返す
- [ ] docs/knowledge/ に命名マッピング表を追加

---

## P2 — 中期 (公開後 1〜3 ヶ月) / Mid-term

- **RBAC を再度有効化**して、プラン別（free / starter / professional）にツールを絞る
  - 現在は RBAC OFF で全員が全スコープを取得
  - Auth0 Action で新規ユーザーに自動ロール付与 → プラン連動
- **`read:visa_case` 等のスコープ命名を server-card と一致させる**
  - server-card.json では `visa:read`, `visa:write`, `visa:ocr` の旧命名
  - 実際の RBAC は `read:visa_case`, `read:visa_rule`, ... の詳細命名
  - どちらかに寄せて整合性を取る
- **ChatGPT Apps SDK の UI コンポーネント**（カード・ステップウィザード）を実装
- **多言語 Golden Records**（インドネシア語・英語の引用源対応）

## P3 — 長期 (半年以降) / Long-term

- SOC 2 Type II 取得
- Supabase Edge Functions でのレート制御高度化
- 入管 API との直接連携（公開されれば）
- 同種ビザ（技術・人文知識・国際業務、高度専門職）への拡張

---

## 備忘: 公開直前にやったこと / Just-before-launch log

- ✅ Auth0 DCR 有効化、SuguVisa MCP API 作成（`https://mcp.suguvisa.com/` 末尾スラッシュ必須）
- ✅ Application Access Policy = Allow、Tenant Default Audience 設定
- ✅ RBAC OFF で DCR クライアントに全スコープ付与
- ✅ `read:visa_case` を Permissions に追加忘れていたので追加
- ✅ Auth0 ユーザーの Supabase テナント自動プロビジョニング実装
  （`apps/mcp-server/src/server.ts` + migration `005_tenants_auth0_sub.sql`）
- ✅ `/assets/` を public prefix に追加してスクリーンショット公開
