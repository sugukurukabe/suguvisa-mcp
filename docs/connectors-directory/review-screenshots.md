# 審査用スクリーンショット撮影ガイド / Review Screenshot Guide

Claude Connectors Directory / ChatGPT Apps Store どちらも **3〜5 枚** 必要。
このドキュメント通りに進めれば、サイドバーの個人情報漏洩・失敗フロー露出を避けて
審査に通る品質の素材が揃います。

---

## 🎬 撮影準備 (所要時間 10 分)

### Step 1. 撮影環境を決める

**推奨: Claude Desktop（Web より審査官受けが良い）**

- macOS: [https://www.anthropic.com/app](https://www.anthropic.com/app)（無料、現在のアカウントでログイン可）
- ディスプレイは 1280×800 以上（Retina 推奨、撮影後に縮小する）

### Step 2. 審査用の新規プロジェクトを作成

個人履歴（Iwan さん名、WIN 国際、取引先別未収金等）が映り込むのを避けるため、
**新規プロジェクトを 1 つ作り、その中だけで撮影** します。

1. Claude Desktop 左サイドバー → **プロジェクト** → **新規プロジェクト**
2. プロジェクト名: `SuguVisa Directory Screenshots`
3. プロジェクトを開いた状態で、これから撮るチャットは全部このプロジェクト配下に作成

**ポイント**: プロジェクト画面では左サイドバーに**そのプロジェクトのチャットしか表示されない**ので、
他の顧客・取引先の名前が露出しない。

### Step 3. SuguVisa コネクタがプロジェクトで有効か確認

1. プロジェクトの右上 → **コネクタ** を開く
2. `SuguVisa` を ON（既に接続済みならそのまま）
3. 一度テストで「こんにちは」と送信して、エラーが出ないこと確認

### Step 4. Claude の表示設定を整える

1. Claude Desktop 左下 → 設定 (⚙)
2. **外観**: **ライトモード** に統一（審査ドキュメントと統一感が出る）
3. **言語**: 日本語 UI
4. **推論の表示 (Show reasoning / Extended thinking)**: **OFF**
  - これをオンにすると "I need to find the right SuguVisa tool..." のような
   英語の思考プロセスが露出する
  - 前回のスクショで審査 NG 要因になっていた部分
5. サイドバーを折りたたむ (⌘ + /) or マウスで最小化

### Step 5. 画面解像度を固定

```bash
# macOS: ディスプレイ解像度を 1440×900 相当に設定
# System Settings → Displays → 「スペース広め」の隣の解像度を選ぶ
```

Claude Desktop のウィンドウサイズを **1280×800** に合わせる:

```bash
# AppleScript でウィンドウサイズを正確に合わせる
osascript -e 'tell application "System Events" to tell process "Claude"
  set size of window 1 to {1280, 800}
  set position of window 1 to {100, 100}
end tell'
```

---

## 📸 5 シナリオの撮影台本

各シナリオ、**コピペ用プロンプト**と**撮影ポイント**を記載。
プロンプトはそのまま Claude に貼ってください。

### Scenario 1 — 申請パターン判定 (必須)

**撮影ファイル名**: `screenshot-1.png`

**コピペプロンプト**:

```
技能実習2号を今年6月に修了予定の社員がいます。同じ農業分野で特定技能1号に変更したいです。
必要な書類リストと、今から逆算した申請スケジュールを教えてください。
在留期限は2026-08-15、会社はスグクル株式会社（派遣）です。
```

**撮影ポイント**:

- Claude が `determine_application_type` → `get_required_documents` → `calculate_deadlines` を連続で呼び出す
- ツール呼び出しボックスが 3 つ並ぶところ が見える状態で撮影
- 最終回答の書類チェックリスト冒頭まで収まるサイズ

**撮り方**: 回答が生成し終わった後に、ツール呼び出しの部分＋回答冒頭が 1 画面に収まる位置までスクロール
  → Cmd + Shift + 4 → Space → Claude ウィンドウをクリック

---

### Scenario 2 — 期限計算 (必須)

**撮影ファイル名**: `screenshot-2.png`

**コピペプロンプト**:

```
スタッフAさんの在留期限は2026-07-31です。以下の届出期限を全部計算して、
緊急度の高い順に並べて表示してください。
- 契約変更の随時届出（14日ルール）
- 定期届出（年次）
- 更新申請の開始可能日（3ヶ月前ルール）
- 特定技能1号の5年上限の残存
なお、特定技能1号取得日は2023-08-01です。
```

**撮影ポイント**:

- `calculate_deadlines` のツール呼び出し表示
- 期限が ⚠️ / ⚡ 等のアイコン付きで色分け表示されるとベスト
- 通算 5 年の残日数が計算されている部分を強調

---

### Scenario 3 — 定期届出 CSV 生成

**撮影ファイル名**: `screenshot-3.png`

**コピペプロンプト**:

```
2026年度（2025-04-01 〜 2026-03-31）の登録支援機関の定期届出CSVを作成してください。
対象者は以下の3名のテストデータで:

1. テスト太郎 (在留カード AB12345678, 農業, 2024-04-01 受入)
2. テスト花子 (在留カード AB23456789, 介護, 2024-10-01 受入)
3. テスト次郎 (在留カード AB34567890, 建設, 2025-01-15 受入)

CSV の先頭20行をプレビューしてください。
```

**撮影ポイント**:

- `generate_annual_report_csv` のツール呼び出し
- 生成された CSV がマークダウンの code block で表示される状態
- 列ヘッダーに「受入状況」「支援実施状況」等の正規フィールド名が見える

---

### Scenario 4 — Golden Records 引用 (出典付き回答の強み)

**撮影ファイル名**: `screenshot-4.png`

**コピペプロンプト**:

```
特定技能2号の「建設」分野で受験できる技能試験の種類と、
試験実施団体、合格基準を教えてください。
出典も必ず示してください。
```

**撮影ポイント**:

- `search_golden_records` のツール呼び出し
- 回答内に **出典 ID**（例: `immigration-notice-2024-xxx`）と **信頼スコア**（例: `0.92`）が表示される
- 「推測ではなく公式情報に基づく回答」であることが一目で分かる画

---

### Scenario 5 — 申請ワークフロー (自律型) ★差別化ポイント

**撮影ファイル名**: `screenshot-5.png`

**コピペプロンプト**:

```
特定技能1号の認定申請（海外から呼び寄せ）を自律ワークフローで開始してください。
申請者: PUTRA BUDI (インドネシア国籍、28歳男性、農業分野)
受入企業: 鹿児島農産株式会社（法人番号 1234567890123）
希望来日時期: 2026年9月

不足情報があれば質問してください。
```

**撮影ポイント**:

- `start_autonomous_visa_workflow` の呼び出し
- Claude が「以下の情報が不足しています: [ 過去の就労歴、試験合格証... ]」と構造化質問を返す
- これは SuguVisa の差別化ポイント（ただの Q&A でなく、足りない情報を能動的に聞く）

**代替案**（ワークフローツールが動かない場合）: **在留カード OCR** で代替

```
在留カード画像のダミーを読み取ってください。
（Claude の添付ボタンから ダミーカード画像を添付）
抽出結果と、次の届出期限を教えてください。
```

---

## 🔧 撮影テクニック

### macOS 標準スクリーンショット

```
Cmd + Shift + 4 → Space → Claude ウィンドウをクリック
```

→ `~/Desktop/スクリーンショット YYYY-MM-DD HH.MM.SS.png` として保存

保存先とファイル名のカスタマイズ:

```bash
# 保存先を固定
mkdir -p ~/Desktop/suguvisa-screenshots
defaults write com.apple.screencapture location ~/Desktop/suguvisa-screenshots
killall SystemUIServer

# 撮影後にリネーム
cd ~/Desktop/suguvisa-screenshots
mv "スクリーンショット 2026-04-20 *.png" screenshot-1.png   # 順番を確認しつつ
```

### CleanShot X（おすすめ、有料）

- スクショ取得 → 矢印・ハイライト・テキスト注釈を素早く追加
- 「ハイライト → 「このツール呼び出しがポイント」」と注釈を書ける

### 推論プロセス (thinking) が出てしまった場合

- 回答が完成した後に、**thinking セクションを折りたたむボタン** (▶ 矢印) を押してから撮影
- もしくは最終回答だけが見えるようにスクロール

---

## 📐 仕上げと解像度調整

### 推奨仕様

- **解像度**: 1280×800 〜 2560×1600
- **アスペクト比**: 16:10 or 4:3（ChatGPT Apps Store は 16:10 推奨）
- **ファイル形式**: PNG（不透過）
- **ファイルサイズ**: ≤ 2 MB（大きすぎると審査システムで弾かれる）

### ImageMagick / sips で一括処理

```bash
cd ~/Desktop/suguvisa-screenshots

# 1280x800 に収まるようリサイズ (アスペクト比維持、余白でパディング)
for f in screenshot-*.png; do
  sips -Z 1600 "$f" --out "resized-$f"
done

# ファイルサイズ確認
ls -lh resized-*.png
```

---

## 📂 配置先

撮影した画像を **リポジトリに配置**:

```bash
cp ~/Desktop/suguvisa-screenshots/screenshot-1.png \
   ~/suguvisa-mcp/apps/mcp-server/public/assets/

cp ~/Desktop/suguvisa-screenshots/screenshot-2.png \
   ~/suguvisa-mcp/apps/mcp-server/public/assets/

# 以下同様
```

最終的に下記パスで 200 OK になる:

```
https://mcp.suguvisa.com/assets/screenshot-1.png
https://mcp.suguvisa.com/assets/screenshot-2.png
https://mcp.suguvisa.com/assets/screenshot-3.png
https://mcp.suguvisa.com/assets/screenshot-4.png
https://mcp.suguvisa.com/assets/screenshot-5.png
```

### デプロイが必要

画像はビルド時に Docker image に含まれるため、リポジトリ push 後に
Cloud Run を再ビルド＆デプロイ:

```bash
cd ~/suguvisa-mcp
git add apps/mcp-server/public/assets/
git commit -m "feat: 審査用スクリーンショット 5 枚を追加"
# (壁が Cloud Build を走らせる or 私に依頼)
```

---

## ✅ 撮影完了チェック

撮り終わったら以下を確認:

- サイドバーに他のチャット名が映っていない
- 英語の思考プロセス (thinking) が露出していない
- 失敗メッセージ・エラー表示が無い
- 実在の顧客名・取引先名・スタッフ氏名が映っていない
- 5 枚すべて 1280×800 以上 & PNG
- 各ファイル 2 MB 以下
- ファイル名が `screenshot-1.png` 〜 `screenshot-5.png`

すべて OK なら、`apps/mcp-server/public/assets/` に配置 → 私に連絡してください。
ビルド＆デプロイ → 本番 200 OK 検証 → 申請送信の流れになります。

---

## 🚨 よくある失敗例（前回の撮影で実際に起きた問題）


| 問題                                        | 原因                     | 対策                        |
| ----------------------------------------- | ---------------------- | ------------------------- |
| サイドバーに `Iwan setiawan` 等の実名               | 既存プロジェクトのチャット履歴が見えていた  | 新規プロジェクト内で撮影              |
| `"I need to find the right tool..."` 等の英語 | Extended thinking が ON | 設定 OFF                    |
| 「要再認証で弾かれました」が表示                          | Auth0 再接続前の古いトークン      | コネクタを削除 → 再接続してから撮影       |
| 解像度がワイド過ぎ (3440×1440 等)                   | ウルトラワイドモニタで撮影          | 1280×800 〜 2560×1600 に収める |
| 取引先名・経理情報（未収金等）がサイドバー                     | 同上                     | 新規プロジェクトで撮影               |


