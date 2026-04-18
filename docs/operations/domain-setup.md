# ドメインマッピング手順 / Domain setup / Pengaturan Domain

独自ドメイン `suguvisa.com` を Cloud Run に紐付ける手順です。
Cloudflare で管理している DNS を前提にします。

## 1. 最終構成 / Final topology

| ドメイン | 役割 | Cloud Run サービス |
|---|---|---|
| `suguvisa.com` | apex - マーケ + ダッシュボード | `suguvisa-dashboard` |
| `www.suguvisa.com` | apex へリダイレクト | `suguvisa-dashboard` |
| `mcp.suguvisa.com` | MCP サーバー (connector endpoint) | `suguvisa-mcp` |

- Stripe Webhook URL: `https://mcp.suguvisa.com/api/v1/billing/webhook`
- Auth0 audience: `https://mcp.suguvisa.com`
- dashboard → MCP: `NEXT_PUBLIC_SUGUVISA_API_URL=https://mcp.suguvisa.com`

## 2. 事前確認 / Preflight

```bash
gcloud config set project <YOUR_PROJECT>
gcloud config set run/region asia-northeast1

# 2 つのサービスがデプロイ済みか確認
gcloud run services list --region asia-northeast1 \
  --filter "metadata.name=(suguvisa-mcp OR suguvisa-dashboard)"
```

両方が `READY` になっていること。Domain Mapping はまだ GA と beta が混在しているので、
`gcloud beta` を使います。

```bash
gcloud components install beta        # 初回のみ
```

## 3. Cloudflare DNS の前準備 / Cloudflare pre-setup

Cloudflare のゾーンで **Proxy を一旦 OFF** にして DNS-only にします
(最初は Google-managed certificate の発行に DNS 検証が必要)。

1. Cloudflare Dashboard → `suguvisa.com` → **DNS**
2. 既存の `A`/`AAAA`/`CNAME` レコードで suguvisa.com に当たるものがあれば退避
3. SSL/TLS モードは後で **Full (strict)** に切り替える (この時点では触らなくて良い)

## 4. Cloud Run にドメインマッピング / Create domain mappings

```bash
# apex: suguvisa.com → dashboard
gcloud beta run domain-mappings create \
  --service suguvisa-dashboard \
  --domain suguvisa.com \
  --region asia-northeast1

# www: www.suguvisa.com → dashboard
gcloud beta run domain-mappings create \
  --service suguvisa-dashboard \
  --domain www.suguvisa.com \
  --region asia-northeast1

# mcp: mcp.suguvisa.com → mcp server
gcloud beta run domain-mappings create \
  --service suguvisa-mcp \
  --domain mcp.suguvisa.com \
  --region asia-northeast1
```

> 初回実行時に Search Console でのドメイン所有者検証を促されます。
> 画面の指示に従い Cloudflare DNS に一度だけ `TXT` レコードを追加 → 検証完了したら削除可能。

成功すると下記のような DNS 値が表示されます:

```
NAME             TYPE    DATA
suguvisa.com.    A       216.239.32.21
suguvisa.com.    A       216.239.34.21
suguvisa.com.    A       216.239.36.21
suguvisa.com.    A       216.239.38.21
suguvisa.com.    AAAA    2001:4860:4802:32::15
...
www              CNAME   ghs.googlehosted.com.
mcp              CNAME   ghs.googlehosted.com.
```

後で値を再確認したい時:

```bash
gcloud beta run domain-mappings describe \
  --domain suguvisa.com --region asia-northeast1
```

## 5. Cloudflare に DNS レコード登録 / Add records in Cloudflare

Cloudflare Dashboard → `suguvisa.com` → **DNS → Add record** で以下を追加:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `suguvisa.com` (`@`) | `216.239.32.21` | **DNS only** |
| A | `@` | `216.239.34.21` | DNS only |
| A | `@` | `216.239.36.21` | DNS only |
| A | `@` | `216.239.38.21` | DNS only |
| AAAA | `@` | `2001:4860:4802:32::15` | DNS only |
| AAAA | `@` | `2001:4860:4802:34::15` | DNS only |
| AAAA | `@` | `2001:4860:4802:36::15` | DNS only |
| AAAA | `@` | `2001:4860:4802:38::15` | DNS only |
| CNAME | `www` | `ghs.googlehosted.com` | DNS only |
| CNAME | `mcp` | `ghs.googlehosted.com` | DNS only |

> IP/CNAME 値は `domain-mappings describe` の出力を正とする。上記は 2025 年時点の参考値。

## 6. 証明書発行待ち / Wait for TLS

```bash
# 証明書ステータスが ACTIVE になるまで 5〜30 分ほど
watch -n 30 "gcloud beta run domain-mappings describe \
  --domain mcp.suguvisa.com --region asia-northeast1 \
  --format='value(status.conditions)'"
```

`CertificateProvisioned = True` になったら次へ。

## 7. Cloudflare Proxy を ON に (任意) / Enable Cloudflare proxy

Proxy を ON にすると Cloudflare の CDN / WAF / Rate Limit が使えます。

1. DNS レコードをすべて `Proxied` (オレンジ雲) に切替
2. **SSL/TLS → Overview → Full (strict)** を選択 (Cloud Run の証明書を検証)
3. **SSL/TLS → Edge Certificates** で `Always Use HTTPS = ON` / `HSTS` を有効化

> Proxy を ON にする場合、Claude / ChatGPT の SSE が長時間コネクションを張るので、
> Cloudflare の `Proxy Read Timeout` (Enterprise のみ調整可) に注意。
> 不要なら DNS only のまま運用しても OK (Google の証明書 + Google のネットワークで十分)。

## 8. Cloud Run 環境変数を更新 / Update Cloud Run env

```bash
# MCP server
gcloud run services update suguvisa-mcp --region asia-northeast1 \
  --update-env-vars "SUGUVISA_BASE_URL=https://mcp.suguvisa.com,SUGUVISA_MARKETING_URL=https://suguvisa.com,AUTH0_AUDIENCE=https://mcp.suguvisa.com"

# Dashboard
gcloud run services update suguvisa-dashboard --region asia-northeast1 \
  --update-env-vars "NEXT_PUBLIC_SUGUVISA_API_URL=https://mcp.suguvisa.com,NEXT_PUBLIC_SITE_URL=https://suguvisa.com"
```

## 9. スモークテスト / Smoke test

```bash
# MCP server
curl -I https://mcp.suguvisa.com/health
curl -s https://mcp.suguvisa.com/health | jq .
curl -s https://mcp.suguvisa.com/.well-known/mcp/server-card.json | jq .baseUrl
curl -s https://mcp.suguvisa.com/.well-known/oauth-protected-resource | jq .

# Dashboard
curl -I https://suguvisa.com/
curl -I https://www.suguvisa.com/
curl -I https://suguvisa.com/login
curl -I https://suguvisa.com/pricing

# verify CLI でまとめて
node packages/billing/dist/cli.js verify --url https://mcp.suguvisa.com
```

期待する結果:
- `/health` → 200 + `{"status":"ok","billing":{"mode":"stripe"},...}`
- `server-card.json` の `baseUrl` が `https://mcp.suguvisa.com`
- dashboard が 200 を返し、`/dashboard` は未ログインなら `/login` にリダイレクト

## 10. Stripe / Auth0 の URL 更新 / Update external services

### Stripe
1. Stripe Dashboard → **Developers → Webhooks**
2. 既存 endpoint を編集、URL を `https://mcp.suguvisa.com/api/v1/billing/webhook` に変更
3. 「Send test webhook」で `checkout.session.completed` を送信し 200 応答を確認

### Auth0
1. Auth0 Dashboard → **Applications → APIs**
2. SuguVisa MCP API の **Identifier** を `https://mcp.suguvisa.com` に更新
   (既存の identifier は外部クライアントに伝えているので注意。必要なら新 API を作成して旧 API は deprecated に)
3. **Applications** の Allowed Callback / Logout URL を Claude / ChatGPT の値に更新

## 11. DNS 伝播の確認 / Verify DNS propagation

```bash
dig +short A suguvisa.com
dig +short CNAME mcp.suguvisa.com
dig +short CNAME www.suguvisa.com
```

Cloudflare Proxy ON の場合は Cloudflare の IP (104.21.x / 172.67.x 等) が返ります。
Proxy OFF の場合は `ghs.googlehosted.com` 系 (216.239.32-38.21 等) が返ります。

## 12. よくあるトラブル / Troubleshooting

| 症状 | 原因と対処 |
|---|---|
| `The custom domain verification failed` | Search Console の所有者検証が未完了。gcloud が表示する TXT レコードを Cloudflare に追加 |
| `CertificateProvisioned=False` が 30 分以上続く | DNS が Cloudflare Proxy ON のまま。一旦 DNS only に戻して証明書発行 → 完了後 Proxy ON |
| `SSL_ERROR_NO_CYPHER_OVERLAP` / 証明書エラー | Cloudflare の SSL mode が `Flexible` になっている。`Full (strict)` に変更 |
| SSE (`/mcp`) が 100 秒で切断 | Cloudflare Free プランの timeout。DNS only にするか Enterprise プランへ |
| dashboard が 404 | Next.js middleware の設定と `NEXT_PUBLIC_SITE_URL` が不一致。`/login` は 200 でも `/` が 404 の場合は route が missing |
| Webhook が 400 | Stripe Dashboard の signing secret を Cloud Run の `STRIPE_WEBHOOK_SECRET` に更新忘れ |

## 13. 撤退手順 / Rollback

ドメインマッピングを外したい場合:

```bash
gcloud beta run domain-mappings delete --domain suguvisa.com --region asia-northeast1
gcloud beta run domain-mappings delete --domain www.suguvisa.com --region asia-northeast1
gcloud beta run domain-mappings delete --domain mcp.suguvisa.com --region asia-northeast1
```

Cloudflare 側の DNS レコードも削除する。
