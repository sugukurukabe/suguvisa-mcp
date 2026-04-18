/**
 * 法務・サポート・ランディング HTML ページ
 * Legal / support / landing HTML pages
 * Halaman hukum / dukungan / utama
 *
 * Claude Connectors と ChatGPT Apps Store の審査では Privacy / Terms /
 * Security / Support に実体ある日本語ページが必要。ここで一括提供する。
 */
import type { Request, Response } from "express";
import { buildDirectoryMetadata } from "./metadata.js";
import { layout } from "./html.js";

const LAST_UPDATED = "2026-04-17";

/* ---------- Landing ---------- */
export function landingHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();
  const body = `
  <section class="hero">
    <h1>${m.displayName.ja}</h1>
    <p class="lead">${m.shortDescription.ja}</p>
    <p>
      <a class="cta" href="${m.urls.documentation}">${`はじめる / Get started`}</a>
      <a class="cta secondary" href="${m.urls.mcpEndpoint}">MCP エンドポイント</a>
    </p>
  </section>

  <section>
    <h2>対応 AI クライアント / Supported AI clients</h2>
    <div class="plan-grid">
      <div class="card">
        <h3>Claude Desktop / Web</h3>
        <p class="muted">Connectors Directory 経由で 1 クリック追加。OAuth 2.1 (PKCE) + API Key。</p>
      </div>
      <div class="card">
        <h3>ChatGPT Apps (Apps SDK)</h3>
        <p class="muted">Apps Store から追加可能。OpenAI Apps SDK に準拠した MCP サーバーとして動作。</p>
      </div>
      <div class="card">
        <h3>Cursor / Smithery</h3>
        <p class="muted">stdio & HTTP の両対応。Smithery 経由で config の受け渡しが可能。</p>
      </div>
    </div>
  </section>

  <section>
    <h2>料金プラン / Plans</h2>
    <div class="plan-grid">
      ${m.plans
        .map(
          (p) => `
        <div class="card">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="price">¥${p.monthlyPriceJpy.toLocaleString()}<span class="muted" style="font-size:0.8rem;"> /月</span></p>
          <ul>${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
        </div>`,
        )
        .join("")}
    </div>
    <p><a href="/api/v1/billing/plans">JSON で全プラン表示</a></p>
  </section>

  <section>
    <h2>提供ツール / Tools</h2>
    <p>申請パターン判定、必要書類リスト、期限計算、在留カード OCR、定期届出 CSV/Excel、法改正トラッキング、Golden Records 検索など 37+ の MCP ツールを提供します。</p>
    <p><a href="${m.urls.openapi}">OpenAPI 仕様</a> · <a href="${m.urls.mcpEndpoint}">MCP エンドポイント</a></p>
  </section>

  <section>
    <h2>エンタープライズ向け / Enterprise</h2>
    <p>監査ログ、テナント管理、SSO、専用インフラ、SLA 等が必要な方は <a href="mailto:${m.publisher.supportEmail}">${m.publisher.supportEmail}</a> までお問い合わせください。</p>
  </section>
  `;

  res
    .status(200)
    .type("text/html")
    .send(layout({ title: m.shortDescription.ja, description: m.longDescription.ja, body, canonicalPath: "/" }));
}

/* ---------- Privacy Policy ---------- */
export function privacyHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();
  const body = `
  <h1>プライバシーポリシー / Privacy Policy / Kebijakan Privasi</h1>
  <p class="muted">最終更新 / Last updated / Diperbarui: ${LAST_UPDATED}</p>
  <p>${m.publisher.legalName}（以下「当社」）は、${m.displayName.ja} サービス（以下「本サービス」）における個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。</p>

  <h2>1. 収集する情報 / Data We Collect</h2>
  <ul>
    <li>ユーザーが入力する申請関連データ: ${m.dataHandling.piiProcessed.map((x) => `<code>${escapeHtml(x.ja)}</code>`).join(" / ")}</li>
    <li>認証情報 (OAuth / API Key, メールアドレス)</li>
    <li>利用ログ (IP アドレス, ツール呼び出し履歴, エラーログ)</li>
    <li>課金に必要な情報 (Stripe が処理する決済情報、当社は保持しません)</li>
  </ul>

  <h2>2. 利用目的 / How We Use Data</h2>
  <ul>
    <li>申請種別の判定、必要書類の提示、期限計算等、本サービスの提供</li>
    <li>不正利用の防止、レート制限の適用</li>
    <li>サービス品質改善および集計統計 (個人を特定しない形式)</li>
    <li>課金処理 (Stripe 経由)</li>
  </ul>

  <h2>3. データの保存と削除 / Retention & Deletion</h2>
  <p>申請データは原則として処理時のみ使用し、サーバー側には永続保存しません。監査ログ機能を明示的に有効化した場合は、テナント単位で最大 ${m.dataHandling.retentionDays} 日間保存されます。削除要求は ${m.publisher.supportEmail} までメールでお送りください。</p>

  <h2>4. データの保管場所 / Data Location</h2>
  <p>${m.dataHandling.regions.join(", ")} のリージョンに保管されます。保存時は ${m.dataHandling.encryption.atRest} で暗号化され、通信は ${m.dataHandling.encryption.inTransit} で保護されます。</p>

  <h2>5. 副処理者 / Subprocessors</h2>
  <table>
    <thead><tr><th>名称</th><th>目的</th><th>プライバシーポリシー</th></tr></thead>
    <tbody>
      ${m.dataHandling.subprocessors.map((s) => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.purpose)}</td><td><a href="${s.url}">${s.url}</a></td></tr>`).join("")}
    </tbody>
  </table>

  <h2>6. 第三者提供 / Third-Party Disclosure</h2>
  <p>法令に基づく場合を除き、ユーザーデータを第三者に提供または販売することはありません。</p>

  <h2>7. ユーザーの権利 / Your Rights</h2>
  <p>ユーザーはいつでも、自身のデータへのアクセス、訂正、削除、移行を請求できます。${m.publisher.supportEmail} までメールでご請求ください。</p>

  <h2>8. 子どもに関する情報 / Children's Data</h2>
  <p>本サービスは 18 歳未満を対象としておらず、意図的に未成年者の個人情報を収集することはありません。</p>

  <h2>9. 変更 / Changes</h2>
  <p>本ポリシーは予告なく改定されることがあります。重大な変更は本ページおよび管理画面で告知します。</p>

  <h2>10. お問い合わせ / Contact</h2>
  <p>${m.publisher.legalName} (${m.publisher.address})<br />
     Email: <a href="mailto:${m.publisher.supportEmail}">${m.publisher.supportEmail}</a></p>
  `;
  res
    .type("text/html")
    .send(layout({ title: "プライバシーポリシー", description: "SuguVisa Privacy Policy", body, canonicalPath: "/privacy" }));
}

/* ---------- Terms of Service ---------- */
export function termsHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();
  const body = `
  <h1>利用規約 / Terms of Service / Ketentuan Layanan</h1>
  <p class="muted">最終更新 / Last updated: ${LAST_UPDATED}</p>
  <p>本規約は ${m.publisher.legalName}（以下「当社」）と、${m.displayName.ja}（以下「本サービス」）の利用者（以下「お客様」）との間の契約条件を定めるものです。本サービスを利用することにより、本規約に同意したものとみなされます。</p>

  <h2>1. サービスの提供 / Service</h2>
  <p>本サービスは、日本の特定技能ビザ申請に関する情報提供・業務支援ツールです。本サービスは参考情報の提供にとどまり、法的助言 (legal advice) を構成するものではありません。最終的な申請判断は、弁護士または行政書士にご相談ください。</p>

  <h2>2. アカウント / Account</h2>
  <p>お客様は、正確かつ最新の情報を提供する責任を負います。API キーおよび OAuth クライアントシークレットは機密情報として厳重に管理してください。漏洩が疑われる場合は直ちに再発行してください。</p>

  <h2>3. 料金 / Pricing</h2>
  <p>プラン料金は <a href="/">トップページ</a> および <a href="/api/v1/billing/plans">/api/v1/billing/plans</a> に掲載されています。サブスクリプションは Stripe を通じて自動更新され、お客様はカスタマーポータルからいつでもキャンセルできます。</p>

  <h2>4. 利用可能な用途 / Acceptable Use</h2>
  <ul>
    <li>本サービスを用いて違法行為、他者への嫌がらせ、無断の大量データ取得を行ってはなりません。</li>
    <li>リバースエンジニアリング、競合サービスの学習データ収集を目的とした利用を禁じます。</li>
    <li>レート制限を回避する行為 (多重アカウント、プロキシの乱用) を禁じます。</li>
  </ul>

  <h2>5. 知的財産 / Intellectual Property</h2>
  <p>本サービスに関する著作権、商標権、その他の知的財産権は当社に帰属します。お客様が入力したデータの著作権はお客様に帰属し、当社はサービス提供に必要な範囲でのみ使用します。</p>

  <h2>6. 免責 / Disclaimer</h2>
  <p>当社は、本サービスの正確性、完全性、特定目的への適合性を保証しません。本サービスの利用により生じた一切の損害について、当社は責任を負いません (ただし、当社の故意または重過失による場合を除く)。</p>

  <h2>7. サービスの変更・停止 / Changes</h2>
  <p>当社は、事前の通知なく本サービスの内容を変更または停止することがあります。重大な変更は 30 日前に告知します。</p>

  <h2>8. 解約 / Termination</h2>
  <p>お客様はいつでもサブスクリプションを解約できます。当社は、本規約に違反するお客様のアクセスを予告なく停止できます。</p>

  <h2>9. 準拠法・管轄 / Governing Law</h2>
  <p>本規約は日本法に準拠し、鹿児島地方裁判所を第一審の専属的合意管轄裁判所とします。</p>

  <h2>10. 連絡先 / Contact</h2>
  <p>${m.publisher.legalName}<br />${m.publisher.address}<br />
     <a href="mailto:${m.publisher.supportEmail}">${m.publisher.supportEmail}</a></p>
  `;
  res
    .type("text/html")
    .send(layout({ title: "利用規約", description: "SuguVisa Terms of Service", body, canonicalPath: "/terms" }));
}

/* ---------- Security ---------- */
export function securityHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();
  const body = `
  <h1>セキュリティ / Security / Keamanan</h1>
  <p class="muted">最終更新 / Last updated: ${LAST_UPDATED}</p>

  <h2>1. インフラ / Infrastructure</h2>
  <ul>
    <li>ホスティング: Google Cloud Run (asia-northeast1 / Tokyo)</li>
    <li>データベース: Supabase (Row Level Security 有効)</li>
    <li>ベクトル検索: Vertex AI Vector Search</li>
    <li>CDN / DDoS: Google Cloud Load Balancer + Cloud Armor</li>
    <li>シークレット管理: Google Cloud Secret Manager</li>
  </ul>

  <h2>2. 暗号化 / Encryption</h2>
  <ul>
    <li>保存時: ${m.dataHandling.encryption.atRest}</li>
    <li>通信時: ${m.dataHandling.encryption.inTransit}</li>
    <li>個人情報 (PII) は envelope encryption でラップし、復号キーは KMS 管理</li>
  </ul>

  <h2>3. 認証・認可 / Authentication</h2>
  <ul>
    <li>OAuth 2.1 Resource Server (PKCE 必須)</li>
    <li>Protected Resource Metadata (RFC 9728) 対応</li>
    <li>API Key (Bearer) はテナント毎に発行、ローテーション可能</li>
    <li>すべてのツール呼び出しはテナント分離 + スコープチェック</li>
  </ul>

  <h2>4. レート制限 / Rate Limiting</h2>
  <p>IP 単位・プリンシパル単位・テナント単位の 3 層で制限を適用。異常検知時は自動的に 429 を返却します。</p>

  <h2>5. 監査ログ / Audit Log</h2>
  <p>Professional プラン以上ではテナントに紐づく監査ログを ${m.dataHandling.retentionDays} 日保持します。<code>/api/v1/audit</code> から照会できます。</p>

  <h2>6. 脆弱性報告 / Responsible Disclosure</h2>
  <p>セキュリティ上の問題を発見された場合は、<a href="mailto:${m.publisher.supportEmail}">${m.publisher.supportEmail}</a> (件名: [Security Report]) へご連絡ください。通常 2 営業日以内に受領確認、30 日以内に初動対応を行います。</p>

  <h2>7. コンプライアンス / Compliance</h2>
  <ul>
    <li>個人情報保護法 (APPI) 準拠</li>
    <li>SOC 2 Type I 取得準備中 (2026 年下期)</li>
    <li>GDPR: 現在は EU 居住者向けサービスとして提供していません</li>
  </ul>

  <h2>8. 副処理者 / Subprocessors</h2>
  <p><a href="/privacy#5-%E5%89%AF%E5%87%A6%E7%90%86%E8%80%85--subprocessors">プライバシーポリシー 5 章</a>をご覧ください。</p>
  `;
  res.type("text/html").send(layout({ title: "セキュリティ", description: "SuguVisa Security", body, canonicalPath: "/security" }));
}

/* ---------- Support ---------- */
export function supportHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();
  const body = `
  <h1>サポート / Support / Dukungan</h1>
  <p>${m.displayName.ja} に関するお問い合わせ、不具合報告、機能要望は下記からお願いします。</p>

  <h2>お問い合わせ / Contact</h2>
  <ul>
    <li>Email: <a href="mailto:${m.publisher.supportEmail}">${m.publisher.supportEmail}</a></li>
    <li>会社情報: ${m.publisher.legalName} (${m.publisher.address})</li>
    <li>営業時間: 平日 9:00–18:00 JST (祝日除く)</li>
  </ul>

  <h2>応答目標 / Response SLA</h2>
  <table>
    <thead><tr><th>プラン</th><th>初回応答</th><th>チャネル</th></tr></thead>
    <tbody>
      <tr><td>Free</td><td>ベストエフォート</td><td>Email</td></tr>
      <tr><td>Starter</td><td>2 営業日以内</td><td>Email</td></tr>
      <tr><td>Professional</td><td>1 営業日以内</td><td>Email + Slack Connect</td></tr>
      <tr><td>Enterprise</td><td>4 時間以内</td><td>Email + Slack Connect + 電話</td></tr>
    </tbody>
  </table>

  <h2>よくある質問 / FAQ</h2>
  <ul>
    <li>API キーの取得: <code>/api/v1/tenant/me</code> エンドポイントまたはダッシュボードから発行できます。</li>
    <li>料金・キャンセル: <a href="/api/v1/billing/portal">Stripe カスタマーポータル</a>からいつでも変更可能です。</li>
    <li>稼働状況: <a href="${m.urls.statusPage}">${m.urls.statusPage}</a> で確認できます。</li>
    <li>OCR の精度: 在留カード表面の撮影条件によりますが、鮮明な画像では 95% 以上の一致率を実測しています。</li>
  </ul>

  <h2>開発者向けリソース / Developer Resources</h2>
  <ul>
    <li><a href="${m.urls.openapi}">OpenAPI 仕様</a></li>
    <li><a href="${m.urls.mcpEndpoint}">MCP エンドポイント</a></li>
    <li><a href="/.well-known/mcp/server-card.json">MCP Server Card</a></li>
    <li><a href="/.well-known/ai-plugin.json">GPT Plugin Manifest</a></li>
    <li><a href="/.well-known/openai-app.json">OpenAI Apps SDK Manifest</a></li>
  </ul>
  `;
  res.type("text/html").send(layout({ title: "サポート", description: "SuguVisa Support", body, canonicalPath: "/support" }));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
