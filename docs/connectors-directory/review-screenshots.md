# 審査用スクリーンショット取得ガイド / Review Screenshot Guide

Claude Connectors Directory / ChatGPT Apps Store のどちらも **3–5 枚**のスクリーンショットが必要です。以下のシナリオで撮影し、`apps/mcp-server/public/assets/` に配置します。

## 推奨シナリオ / Recommended scenes

### 1. 申請パターン判定 (pattern detection)
- Claude / ChatGPT のチャットで、ユーザーが「現在 技能実習2号で、特定技能1号に変更したいです」と入力
- SuguVisa が `determine_application_type` → `get_required_documents` を連続で呼び、必要書類チェックリストを整形表示
- **ファイル名**: `screenshot-1.png` (1280x800)

### 2. 期限計算 + アラート
- ユーザー「在留期限 2026-07-31 です。今日からの期限を教えて」
- `calculate_deadlines` が 14 日届出・3ヶ月前・5 年上限・90 日 remainingDays を返し、⚠ 付きで強調
- **ファイル名**: `screenshot-2.png`

### 3. 定期届出 CSV 生成
- ユーザー「今年の定期届出の CSV を作成して」
- `generate_annual_report_csv` が 12 行のサンプルデータを含む CSV プレビューを返す
- **ファイル名**: `screenshot-3.png`

### 4. Golden Records 引用 + 出典表示
- ユーザー「2 号特定技能の建設分野の技能試験は何？」
- `search_golden_records` が出典 ID + 信頼スコア付きで引用
- **ファイル名**: `screenshot-4.png`

### 5. 在留カード OCR (Professional プラン)
- ユーザー: 在留カードの画像 (ダミー) を添付
- `ocr_residence_card` が氏名・在留資格・在留期限を抽出 → `validate_application_data` でリアルタイム検証
- **ファイル名**: `screenshot-5.png`

## 撮影ルール / Capture rules

- **解像度**: 1280x800 以上 (Retina なら 2560x1600)
- **フォーマット**: PNG (非透過)
- **実データ使用**: placeholder / Lorem ipsum 禁止 — ダミーでも現実的な日本語データで
- **個人情報**: 実在する在留カード番号・氏名を使わない (すべて `AB12345678`, `テスト太郎` 等)
- **UI**: Claude Desktop / ChatGPT のダークモード or ライトモード統一
- **言語**: 日本語版で撮影し、英語・インドネシア語サブセットも 1–2 枚は用意

## ファイル配置

```
apps/mcp-server/public/assets/
  screenshot-1.png
  screenshot-2.png
  screenshot-3.png
  screenshot-4.png
  screenshot-5.png
```

`openai-app.json` の `screenshots` 配列は既にこのパスを指しています:

```json
"screenshots": [
  "https://<domain>/assets/screenshot-1.png",
  "https://<domain>/assets/screenshot-2.png",
  "https://<domain>/assets/screenshot-3.png"
]
```

## 推奨ツール

- **Claude Desktop 録画**: macOS 標準の Screenshot (Shift + Cmd + 5)
- **ChatGPT**: Chrome DevTools の Device Mode で 1280x800 固定 → フルページスクショ
- **注釈**: CleanShot X で矢印・ハイライトを追加 (過度な加工は避ける)
