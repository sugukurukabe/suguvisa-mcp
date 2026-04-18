/**
 * Directory Metadata / ディレクトリ掲載メタデータ / Metadata direktori
 *
 * Claude Connectors Directory と ChatGPT Apps Store / GPT Plugin の両方に掲載する
 * 共通の事実情報 (社名、連絡先、URL、カテゴリ、スコープ等) を単一ソースで管理する。
 * 各 manifest エンドポイントはこの構造体をフォーマットし直して返す。
 */
import { listPublicPlans } from "@suguvisa/billing";

export interface DirectoryMetadata {
  /** Stable short ID for store listings */
  slug: string;
  /** 表示名 (人間向け) */
  displayName: { ja: string; en: string; id: string };
  /** 1 行要約 (≤ 120 chars) */
  shortDescription: { ja: string; en: string; id: string };
  /** 長い説明 (マーケティングコピー相当) */
  longDescription: { ja: string; en: string; id: string };
  categories: string[];
  tags: string[];
  /** Distributor / owner */
  publisher: {
    legalName: string;
    displayName: string;
    website: string;
    supportEmail: string;
    country: string;
    address: string;
  };
  urls: {
    baseUrl: string;
    website: string;
    mcpEndpoint: string;
    restEndpoint: string;
    openapi: string;
    privacyPolicy: string;
    termsOfService: string;
    security: string;
    support: string;
    documentation: string;
    statusPage: string;
    logo: string;
    ogImage: string;
    favicon: string;
  };
  /** OAuth / API key 情報 */
  auth: {
    oauth2: {
      enabled: boolean;
      issuer: string;
      authorizationUrl: string;
      tokenUrl: string;
      scopes: Record<string, string>;
    };
    apiKey: {
      enabled: boolean;
      header: string;
      example: string;
    };
  };
  /** データの扱い (審査で重要) */
  dataHandling: {
    piiProcessed: string[];
    piiStored: string[];
    retentionDays: number;
    regions: string[];
    encryption: { atRest: string; inTransit: string };
    subprocessors: Array<{ name: string; purpose: string; url: string }>;
  };
  /** 同期: @suguvisa/billing から public plans のみ引き出す */
  plans: Array<{
    key: string;
    name: string;
    monthlyPriceJpy: number;
    features: string[];
  }>;
  version: string;
}

export function buildDirectoryMetadata(env: NodeJS.ProcessEnv = process.env): DirectoryMetadata {
  const baseUrl = env.SUGUVISA_BASE_URL ?? "https://mcp.suguvisa.com";
  const marketingUrl = env.SUGUVISA_MARKETING_URL ?? "https://suguvisa.com";
  const statusUrl = env.SUGUVISA_STATUS_URL ?? `${baseUrl}/status`;
  const auth0Domain = env.AUTH0_DOMAIN;
  const audience = env.AUTH0_AUDIENCE ?? baseUrl;

  const plans = listPublicPlans().map((p) => ({
    key: p.key,
    name: p.name,
    monthlyPriceJpy: p.monthlyPriceJpy,
    features: [
      p.features.ocr ? "residence_card_ocr" : null,
      p.features.legal_search ? "legal_search" : null,
      p.features.bulk_generation ? "bulk_generation" : null,
      p.features.audit_log ? "audit_log" : null,
      p.features.annual_report ? "annual_report" : null,
      p.features.autonomous_workflow ? "autonomous_workflow" : null,
    ].filter((x): x is string => Boolean(x)),
  }));

  return {
    slug: "suguvisa-mcp",
    displayName: {
      ja: "SuguVisa — 特定技能ビザ申請AI",
      en: "SuguVisa — Japan SSW Visa AI",
      id: "SuguVisa — AI Visa SSW Jepang",
    },
    shortDescription: {
      ja: "日本の特定技能ビザ申請を完全自動化。申請パターン判定・期限計算・書類生成・電子届出CSV・年次報告まで一気通貫。",
      en: "Full automation for Japan's SSW visa. Pattern detection, deadline calc, document generation, and annual reports in one flow.",
      id: "Otomatisasi penuh visa SSW Jepang: deteksi pola, perhitungan tenggat, pembuatan dokumen, dan laporan tahunan.",
    },
    longDescription: {
      ja: "SuguVisa は、日本の特定技能（SSW）ビザに特化した業務用 AI コネクタです。37 ツール以上を備え、申請種別の自動判定、必要書類リスト（省略条件自動適用）、期限計算（14 日届出ルール・通算 5 年上限・更新申請 3 ヶ月前）、在留カード OCR、定期届出 CSV/Excel 生成、紙様式 PDF マッピング、法改正情報、監査ログまでを提供します。行政書士・登録支援機関・受入れ機関・外国人申請者本人が利用できます。",
      en: "SuguVisa is a business-grade AI connector specialized in Japan's Specified Skilled Worker (SSW) visa. It exposes 37+ MCP tools including automatic application pattern detection, document checklists with exemption logic, deadline computation (14-day rule, 5-year cap, 3-month renewal window), residence card OCR, periodic notification CSV/Excel, paper form PDF mapping, law-change tracking, and audit logging. Built for immigration lawyers, registered support organizations, receiving companies, and applicants themselves.",
      id: "SuguVisa adalah konektor AI kelas bisnis khusus visa Pekerja Berketerampilan Spesifik (SSW) Jepang. Menyediakan 37+ alat MCP untuk deteksi otomatis pola permohonan, daftar dokumen dengan logika pengecualian, perhitungan tenggat (aturan 14 hari, batas 5 tahun, 3 bulan perpanjangan), OCR kartu izin tinggal, CSV/Excel pelaporan berkala, pemetaan formulir PDF, pelacakan perubahan hukum, dan log audit.",
    },
    categories: ["legal", "government", "productivity", "hr", "business"],
    tags: [
      "immigration",
      "visa",
      "specified-skilled-worker",
      "japan",
      "特定技能",
      "在留資格",
      "行政書士",
      "hr",
      "ocr",
    ],
    publisher: {
      legalName: "スグクル株式会社 / Sugukuru Inc.",
      displayName: "Sugukuru Inc.",
      website: marketingUrl,
      supportEmail: env.SUGUVISA_SUPPORT_EMAIL ?? "support@sugu-kuru.co.jp",
      country: "JP",
      address: "〒892-0816 鹿児島県鹿児島市山下町7-1",
    },
    urls: {
      baseUrl,
      website: marketingUrl,
      mcpEndpoint: `${baseUrl}/mcp`,
      restEndpoint: `${baseUrl}/api/v1/tools`,
      openapi: `${baseUrl}/openapi.yaml`,
      privacyPolicy: `${baseUrl}/privacy`,
      termsOfService: `${baseUrl}/terms`,
      security: `${baseUrl}/security`,
      support: `${baseUrl}/support`,
      documentation: `${baseUrl}/docs`,
      statusPage: statusUrl,
      logo: `${baseUrl}/logo.svg`,
      ogImage: `${baseUrl}/og-image.png`,
      favicon: `${baseUrl}/favicon.svg`,
    },
    auth: {
      oauth2: {
        enabled: Boolean(auth0Domain),
        issuer: auth0Domain ? `https://${auth0Domain}/` : "",
        authorizationUrl: auth0Domain ? `https://${auth0Domain}/authorize` : "",
        tokenUrl: auth0Domain ? `https://${auth0Domain}/oauth/token` : "",
        scopes: {
          "visa:read": "Read visa rules, patterns, and reference data",
          "visa:write": "Generate application CSVs, Excels, and paper form PDFs",
          "visa:ocr": "Run OCR on residence cards and passports",
          "visa:audit": "Read and write audit logs for your tenant",
          "tenant:admin": "Manage API keys and subscription",
        },
      },
      apiKey: {
        enabled: true,
        header: "Authorization",
        example: "Authorization: Bearer svmcp_xxxxxxxxxxxxxxxxxxxxxxxx",
      },
    },
    dataHandling: {
      piiProcessed: [
        "氏名 (ローマ字/漢字/かな)",
        "生年月日",
        "在留カード番号",
        "パスポート番号",
        "勤務先企業情報",
      ],
      piiStored: ["監査ログ（任意）", "テナント設定"],
      retentionDays: 365,
      regions: ["asia-northeast1 (Tokyo)"],
      encryption: {
        atRest: "Google Cloud KMS (AES-256)",
        inTransit: "TLS 1.3",
      },
      subprocessors: [
        { name: "Google Cloud Platform", purpose: "Hosting / Storage / OCR", url: "https://cloud.google.com/terms/data-processing-terms" },
        { name: "Supabase", purpose: "Database / Auth", url: "https://supabase.com/privacy" },
        { name: "Stripe", purpose: "Billing", url: "https://stripe.com/privacy" },
        { name: "Auth0", purpose: "OAuth 2.1 identity", url: "https://auth0.com/privacy" },
      ],
    },
    plans,
    version: env.APP_VERSION ?? "0.9.4",
  };
}
