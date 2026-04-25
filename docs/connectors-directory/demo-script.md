# ChatGPT Apps Store — Demo Recording Script

# デモ動画台本 / Skrip Rekaman Demo

**Target**: OpenAI 審査員向けの **30〜90 秒** の MP4 (target: **60s**)。
**Goal**: "SuguVisa が ChatGPT でしか得られない価値を 60 秒で見せる"。
**Language**: 日本語ナレーション + 英字キャプション焼き付け。
**Aspect / resolution**: 1920×1080 (16:9), 30fps, H.264, under 50MB。
**Output**: `apps/mcp-server/public/assets/demo.mp4` → `https://mcp.suguvisa.com/assets/demo.mp4`

---

## 事前準備チェックリスト

- [ ] QuickTime Player (または OBS) で画面収録 (内蔵マイク OFF、別録り or AirPods でナレーション)
- [ ] ChatGPT (Plus) にログイン済み
- [ ] ChatGPT 左下「Apps & Connectors」 → SuguVisa が connected
- [ ] Auth0 は dev tenant ではなく **Production tenant** で接続済
- [ ] テストデータ: 技能実習2号のインドネシア人（架空）の CSV を 1 つ用意
  - 氏名: YAMANO BUDI / 在留資格: 技能実習2号(イ) / 在留期限: 2026-07-31
  - 受入: スグクル株式会社 / 分野: 農業 / 派遣先: 鹿児島農業生産組合
- [ ] ブラウザ window を 1440×900 前後にし、ダークテーマではなく **ライトテーマ** に統一
- [ ] Cursor, Slack, 他通知 OFF / フルスクリーン化して背景を白

---

## シーン構成 (合計 60s)

### Scene 1 — Title card (0:00 - 0:04, 4s)

**映像**: 白背景 + SuguVisa ロゴ + 「Japan SSW Visa AI for ChatGPT」
**字幕 (EN)**:

```
SuguVisa — the ChatGPT app for Japan's Specified Skilled Worker visa.
```

**ナレーション (JA)**:

> 「日本の特定技能ビザ専用 ChatGPT アプリ、スグビザです。」

---

### Scene 2 — The problem (0:04 - 0:12, 8s)

**映像**: 入管 HP を画面録画。参考様式 PDF / 届出一覧 / 届出期限 14 日という赤字 を 3 カット切り替え。
**字幕 (EN)**:

```
Japan's SSW visa — 18+ conversion patterns, 50+ forms,
14-day notification deadlines. Easy to miss. Expensive to fail.
```

**ナレーション (JA)**:

> 「申請パターンは 18 以上、書類は 50 種類以上、
> 届出期限は事由発生から 14 日以内。
> 現場では毎日、この複雑さと戦っています。」

---

### Scene 3 — The ask (0:12 - 0:22, 10s)

**映像**: ChatGPT 新規チャットを開き、在留カード画像（架空のYAMANO BUDI）を添付して以下を打ち込む。

```
この在留カードの人、帰国させずに特定技能 1 号に変えたい。
必要書類と 14 日以内にやるべき届出、教えて。
```

**字幕 (EN)**:

```
"Change this technical intern into SSW 1 without sending him home.
List all required docs and the 14-day notification."
```

**ナレーション (JA)**:

> 「ChatGPT にこう聞くだけで——」

---

### Scene 4 — Tool chain reveal (0:22 - 0:42, 20s)

**映像**: ChatGPT が SuguVisa の MCP ツール 3 本を連続実行。
画面右側に tool call バッジがポンポンと追加される演出を強調。

1. `suguvisa_residence_card_parse` → 氏名 / 在留資格 / 在留期限 / カード番号を抽出
2. `suguvisa_application_type_determine` → `CHANGE_SSW1_C`（国内転職ルート）確定
3. `suguvisa_required_documents_list` → 技能試験・日本語試験免除を自動適用した **12 点のチェックリスト**
4. `suguvisa_deadlines_calculate` → 14 日届出 + 在留期限逆算スケジュール + 5 年上限アラート

**字幕 (EN)**:

```
SuguVisa chains 4 MCP tools: OCR → pattern → docs → deadlines.
```

**ナレーション (JA)**:

> 「在留カードを OCR。パターン判定で『国内変更 C』と確定。
> 技能実習 2 号完了で試験免除を自動適用し、書類 12 点のチェックリストを出力。
> そして 14 日届出期限と、在留期限からの逆算スケジュールを計算します。」

---

### Scene 5 — Output + citations (0:42 - 0:52, 10s)

**映像**: ChatGPT の回答にある **出典 ID クリック** → MOJ 告示の該当条文 (golden_record) が inline でポップアップ。信頼スコア 0.98。

**字幕 (EN)**:

```
Every answer is cited. Confidence 0.98. No hallucinations.
```

**ナレーション (JA)**:

> 「すべての回答に法令の出典 ID と信頼スコアが付きます。
> ハルシネーションは許されない領域です。」

---

### Scene 6 — Outro (0:52 - 1:00, 8s)

**映像**: SuguVisa ロゴ + Free / Ticket ¥2,980 / Starter ¥19,800 / Professional ¥49,800 の 4 プラン表。

**字幕 (EN)**:

```
Free to try. ¥2,980 30-day pass. Built in Kagoshima, Japan.
suguvisa.com
```

**ナレーション (JA)**:

> 「無料プランから使えて、
> 使い切り 30 日パス 2,980 円。
> 日本の田舎から、日本で働くすべての外国人のために。」

---

## 編集メモ

- **字幕フォント**: 英字は `Inter 700` / 日本語は `Noto Sans JP Bold`、黒文字＋白フチ
- **ロゴ**: `apps/mcp-server/public/logo.png` (1024×576)
- **BGM**: なし、もしくは royalty-free ambient を -24 dB で薄く
- **イントロ / アウトロ**: 各 4〜8 秒のフェード
- **Tool call の見せ方**: 早送り厳禁。ツール名が画面に出ている時間を最低 1.5 秒確保

## 撮り直しトリガー

以下に該当したら **録画しなおし**:

- ChatGPT が "I can't use this tool" 系のエラーを返した → Auth0 連携確認後再撮影
- Tool バッジが 3 秒以内に 3 個以上重なって読めない → カメラズーム調整
- 文字化け / 中国語フォント置換が発生 → IME / フォント設定確認
- 法令 ID が開かなかった → golden_records のシードを確認

## 書き出し

```bash
# ffmpeg で 1080p / H.264 / AAC に統一
ffmpeg -i raw.mov \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p \
  -vf "scale=1920:1080:flags=lanczos" \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  demo.mp4

# サイズ確認 (50MB 以下が望ましい)
ls -lh demo.mp4

# アップ先
cp demo.mp4 apps/mcp-server/public/assets/demo.mp4
```

## デプロイ後の確認

```bash
curl -sI https://mcp.suguvisa.com/assets/demo.mp4 | grep -iE 'content-length|content-type|^http'
# Expected:
#   HTTP/2 200
#   content-type: video/mp4
#   content-length: < 50MB

# manifest の screenshots と並んで demo URL を OpenAI フォームに貼る
```

---

**Last updated**: 2026-04-25
