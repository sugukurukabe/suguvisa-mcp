# Google Search Console 登録プレイブック

Claude Connectors Directory の "Server Logo URL" チェックを通すために、
Google の favicon キャッシュ（`https://www.google.com/s2/favicons?domain=mcp.suguvisa.com&sz=64`）
を mcp.suguvisa.com の正しい favicon で埋めるための最短経路。

**達成したいこと**
1. `mcp.suguvisa.com` を Google Search Console に登録
2. サイトマップを送信して高速クロールをリクエスト
3. 数日〜2 週間以内に Google の s2/favicons キャッシュが更新され、
   Anthropic 側で "I have verified that the favicon is correct" にチェックできる状態にする

---

## 0. どの検証方法を選ぶか

| 方法 | カバー範囲 | 所要時間 | 再デプロイ必要 | 推奨度 |
|---|---|---|---|---|
| **A. Domain (DNS TXT)** | `suguvisa.com` とすべての サブドメイン (mcp, api, www, etc.) | 5 分 | ❌ | ⭐⭐⭐ |
| B. URL prefix + HTML meta | `mcp.suguvisa.com` のみ | 10 分 | ✅ (1 回) | ⭐⭐ |
| C. URL prefix + HTML file | `mcp.suguvisa.com` のみ | 10 分 | ✅ (1 回) | ⭐⭐ |

推奨は **A の Domain プロパティ**。一度やれば suguvisa.com 系のすべてのサブドメインがカバーされるので、
将来 www/api/dashboard 追加した時も再設定不要。

---

## 方法 A — Domain プロパティ (DNS TXT、推奨) ⭐

### 1. Search Console で Domain プロパティを追加

1. https://search.google.com/search-console/welcome を開く
2. 左ペインで「プロパティを追加」
3. **ドメイン**（左側）を選択
4. 入力: `suguvisa.com`（サブドメインは書かない）
5. 「続行」

Google が TXT レコードの値を表示する。例:

```
google-site-verification=abcdef1234567890abcdef1234567890abcdef1234
```

### 2. Cloudflare で TXT レコードを追加

1. https://dash.cloudflare.com → `suguvisa.com` を選択
2. 左メニュー「DNS」→「レコード」
3. 「レコードを追加」:
   - Type: **TXT**
   - Name: `@`（= ルートドメイン）
   - Content: Google が表示した `google-site-verification=...` の**値全体**
   - TTL: `Auto`
   - Proxy status: 該当なし（TXT なので灰色の雲）
4. 「保存」

### 3. Search Console に戻って「確認」

30 秒〜数分で Google が TXT を検出 → 「所有権を確認しました」になる。

---

## 方法 B — URL prefix + HTML meta タグ（再デプロイ 1 回）

### 1. Search Console で URL prefix プロパティを追加

1. https://search.google.com/search-console/welcome
2. 「プロパティを追加」→ **URL プレフィックス**（右側）
3. 入力: `https://mcp.suguvisa.com`
4. 「続行」

### 2. 「HTML タグ」方式を選ぶ

Google が次のようなメタタグを表示する:

```html
<meta name="google-site-verification" content="abcDEF1234567890_xyz..." />
```

content の値（`abcDEF1234567890_xyz...`）だけをコピー。

### 3. Cloud Run に環境変数を追加してデプロイ

```bash
gcloud run services update suguvisa-mcp \
  --project=mcp-service-492010 \
  --region=asia-northeast1 \
  --update-env-vars=GOOGLE_SITE_VERIFICATION="abcDEF1234567890_xyz..."
```

（このサーバーの HTML レイアウトは `GOOGLE_SITE_VERIFICATION` 環境変数を読んで
`<meta name="google-site-verification" content="...">` を自動で `<head>` に埋め込む）

### 4. 検証

```bash
curl -s https://mcp.suguvisa.com/ | grep google-site-verification
```

表示されたら Search Console に戻って「確認」。

---

## 方法 C — URL prefix + HTML ファイル（再デプロイ 1 回）

### 1. Search Console で URL prefix プロパティを追加

方法 B と同じで `https://mcp.suguvisa.com` を追加。

### 2. 「HTML ファイル」方式を選ぶ

`google<TOKEN>.html` というファイルをダウンロードするよう指示される。
ファイル名の `<TOKEN>` 部分（例: `abcdef1234567890`）だけをコピー。

### 3. Cloud Run に環境変数を追加してデプロイ

```bash
gcloud run services update suguvisa-mcp \
  --project=mcp-service-492010 \
  --region=asia-northeast1 \
  --update-env-vars=GOOGLE_VERIFICATION_HTML_TOKEN="abcdef1234567890"
```

サーバーは `/google<TOKEN>.html` を動的に生成して返す。

### 4. 検証

```bash
curl https://mcp.suguvisa.com/googleabcdef1234567890.html
# 期待値:
# google-site-verification: googleabcdef1234567890.html
```

Search Console に戻って「確認」。

---

## 検証後 — クロール加速

Search Console で認証が通ったら、必ず次の 3 つを実施:

### 1. サイトマップを送信

左メニュー「サイトマップ」→
```
https://mcp.suguvisa.com/sitemap.xml
```
を入力して「送信」。

サイトマップは 7 URL を含む（root / privacy / terms / security / support / server-card.json / ai-plugin.json）

### 2. URL 検査 → インデックス登録をリクエスト

左上の検索バーに `https://mcp.suguvisa.com/` を入力 → 「インデックス登録をリクエスト」をクリック。
次の 5 URL にも同じことをやる（任意）:
- `https://mcp.suguvisa.com/privacy`
- `https://mcp.suguvisa.com/terms`
- `https://mcp.suguvisa.com/security`
- `https://mcp.suguvisa.com/support`
- `https://mcp.suguvisa.com/.well-known/mcp/server-card.json`

Google がほぼ即時にフェッチしに来る → favicon もその際に拾われる。

### 3. favicon が認識されたか確認

```bash
# 24〜72 時間後に確認
curl -sL "https://www.google.com/s2/favicons?domain=mcp.suguvisa.com&sz=64" -o /tmp/fav.png
file /tmp/fav.png
# 期待値: PNG image data, 64 x 64, 8-bit/color RGBA, non-interlaced
```

`16 x 16` で返ってきたらまだキャッシュ未更新 → 1〜2 週間待つ。

---

## Anthropic 側でやること（タイミング次第）

- **今すぐ提出する場合**: Claude Connectors Directory の
  "I have verified that the favicon is correct" のチェックボックスは **オフ**のまま、
  "Server Logo SVG (upload option)" に `logo.svg` を直接アップロードして提出する。
  favicon キャッシュが 2 週間以内に更新されれば、そちらのルートで自動的に正しいロゴが表示される。

- **1〜2 週間後、favicon が反映されたら**: Anthropic のサポートに返信して
  「favicon キャッシュ更新を確認しました、URL 方式でお使いください」と伝える。

---

## トラブルシュート

**Q. DNS TXT を追加したのに Search Console で確認できない**

- Cloudflare の Proxy が TXT を書き換えていないか確認（TXT は proxy 対象外なので通常は問題なし）
- `dig TXT suguvisa.com` で TXT が返るか確認
- TTL が長すぎる場合は 5–10 分待つ

**Q. HTML meta 方式で meta タグが出てこない**

- `GOOGLE_SITE_VERIFICATION` 環境変数が Cloud Run に設定されているか確認:
  ```bash
  gcloud run services describe suguvisa-mcp \
    --project=mcp-service-492010 --region=asia-northeast1 \
    --format='value(spec.template.spec.containers[0].env[].name)' | tr ';' '\n' | grep GOOGLE
  ```
- デプロイ後に Cloudflare CDN キャッシュがクリアされたか確認（パージ済みの場合は即時反映）

**Q. HTML ファイル方式で 404 が返る**

- `GOOGLE_VERIFICATION_HTML_TOKEN` の値が、Google がダウンロードさせた
  `google<TOKEN>.html` の `<TOKEN>` 部分と完全一致しているか確認
- 例: `googleabc123.html` → トークンは `abc123`（`google` は含まない）

---

## 参考

- Google Search Console: https://search.google.com/search-console
- Cloudflare DNS: https://dash.cloudflare.com
- favicon ガイド: https://developers.google.com/search/docs/appearance/favicon-in-search
