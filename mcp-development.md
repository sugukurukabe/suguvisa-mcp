# SuguVisa MCP 開発スキル

## プロジェクト概要

suguvisa-mcpは、特定技能1号・特定活動（特定技能準備）ビザ申請に特化した公開MCPサーバー。
行政書士・登録支援機関・受入れ機関がClaude.ai/Cursor/Claude Desktopから使う製品。

開発会社: スグクル株式会社（鹿児島県霧島市）
技術スタック: TypeScript, @modelcontextprotocol/sdk, zod, Cloud Run

## ツール開発パターン

### ファイル構成

```
src/tools/{tool-name}.ts  ← 1ツール1ファイル
```

### テンプレート

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function register{ToolName}(server: McpServer) {
  server.tool(
    "tool_name_snake_case",
    // description: 日本語 → English → Bahasa Indonesia の3言語
    "日本語の説明。English description. Deskripsi dalam Bahasa Indonesia.",
    {
      // zodスキーマ: .describe()で3言語の説明
      param: z.string().describe("日本語 / English / Bahasa Indonesia"),
    },
    async (params) => {
      // ロジック
      const result = { /* ... */ };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
```

### 3言語コメントルール（必須）

すべてのコメント、JSDoc、descriptionを3言語で記述する。
順番: 日本語 → English → Bahasa Indonesia

```typescript
// 在留期限の残日数を計算する
// Calculate remaining days until visa expiry
// Menghitung sisa hari sampai masa berlaku visa habis
const remainingDays = calculateDays(visaExpiry);
```

### エラーハンドリング

```typescript
// ユーザーの入力ミス → 具体的な修正方法を返す
// User input errors → return specific fix suggestions
// Kesalahan input pengguna → kembalikan saran perbaikan spesifik
if (/[\u30A0-\u30FF]/.test(nameKana)) {
  errors.push({
    field: "name_kana",
    message: "ふりがなにカタカナが含まれています。ひらがなに修正してください",
    message_en: "Furigana contains katakana. Please use hiragana only",
    message_id: "Furigana mengandung katakana. Harap gunakan hiragana saja",
    fix: convertToHiragana(nameKana),
  });
}
```

### テスト

各ツールに対してvitestのテストファイルを作成する:

```
src/tools/__tests__/{tool-name}.test.ts
```

テストケースは13パターンすべてをカバーする。

## データ参照

rule-sets.jsonに13申請パターンの完全マトリクスが定義されている。
ツールのロジックはこのJSONの`pattern_lookup`と`application_patterns`を参照すること。

```typescript
import ruleSets from "../data/rule-sets.json" with { type: "json" };

// パターン検索
// Pattern lookup
// Pencarian pola
const key = `${currentVisa}_${targetVisa}`;
const patternId = ruleSets.pattern_lookup[key];
const pattern = ruleSets.application_patterns[patternId];
```

## デプロイ

```bash
./deploy.sh  # Cloud Run（asia-northeast1）にデプロイ
npm publish   # npmに公開
```

## 禁止事項

- anyの使用禁止。必ず型を定義する
- console.logは使わない。MCPサーバーではconsole.errorを使う
- 個人情報（在留カード画像等）をサーバーに保存しない
- 入管の参考様式を改変しない（値のみを提供する）
- .envの値をハードコードしない
