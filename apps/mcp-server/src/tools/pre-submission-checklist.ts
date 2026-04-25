/**
 * suguvisa_submission_checklist_verify — 提出前最終チェックリスト
 *
 * オンライン申請またはに紙申請の直前に、全書類の整合性・不足を最終確認する。
 * validate_data のフィールド検証とは異なり、ここでは「書類セットとしてんmのt完全性」を確認。
 *
 * チェック項目:
 * 1. 必要書類の存在チェック（パターンIDに基づく）
 * 2. 申請データの整合性（名前の一致、日付の矛盾、報酬の最低賃金チェック）
 * 3. 署名・押印の確認事項
 * 4. 添付ファイル形式の確認（オンライン申請の場合）
 * 5. 提出先入管局の確認
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";
import { parseResidenceCardHandler } from "./parse-residence-card.js";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json");

// ──────────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────────

interface CheckItem {
  id: string;
  category: string;
  check: string;
  status: "pass" | "fail" | "warning" | "info" | "needs_confirmation";
  detail: string;
  action_needed?: string;
}

// ──────────────────────────────────────────────────
// 最低賃金データ（2026年版想定）
// ──────────────────────────────────────────────────
const MIN_WAGE_BY_PREFECTURE: Record<string, number> = {
  "東京": 1163, "神奈川": 1162, "大阪": 1114, "埼玉": 1078,
  "愛知": 1077, "千葉": 1076, "京都": 1058, "兵庫": 1052,
  "静岡": 1034, "三重": 1033, "広島": 1020, "滋賀": 1017,
  "北海道": 1010, "栃木": 1004, "茨城": 1005, "岐阜": 1001,
  "長野": 998, "福岡": 992, "富山": 998, "群馬": 985,
  "新潟": 985, "石川": 984, "奈良": 986, "福井": 984,
  "山梨": 988, "岡山": 982, "香川": 970, "徳島": 966,
  "宮城": 973, "和歌山": 979, "山口": 970, "大分": 954,
  "鳥取": 957, "島根": 962, "佐賀": 956, "長崎": 953,
  "熊本": 952, "鹿児島": 953, "宮崎": 952, "愛媛": 956,
  "高知": 952, "沖縄": 952, "山形": 955, "秋田": 951,
  "福島": 955, "青森": 953, "岩手": 952,
  // Default fallback
  "unknown": 950,
};

const NATIONAL_MIN_WAGE = 950; // 全国最低の目安

// ──────────────────────────────────────────────────
// 入管局データ
// ──────────────────────────────────────────────────
const IMMIGRATION_OFFICES: Record<string, { name: string; jurisdiction: string[]; address: string }> = {
  "tokyo": {
    name: "東京出入国在留管理局",
    jurisdiction: ["東京", "埼玉", "千葉", "茨城", "栃木", "群馬", "山梨", "長野", "新潟"],
    address: "東京都港区港南5-5-30",
  },
  "nagoya": {
    name: "名古屋出入国在留管理局",
    jurisdiction: ["愛知", "三重", "静岡", "岐阜", "福井", "富山", "石川"],
    address: "愛知県名古屋市港区正保町5-18",
  },
  "osaka": {
    name: "大阪出入国在留管理局",
    jurisdiction: ["大阪", "京都", "兵庫", "奈良", "滋賀", "和歌山"],
    address: "大阪府大阪市住之江区南港北1-29-53",
  },
  "hiroshima": {
    name: "広島出入国在留管理局",
    jurisdiction: ["広島", "山口", "岡山", "鳥取", "島根"],
    address: "広島県広島市中区上八丁堀2-31",
  },
  "fukuoka": {
    name: "福岡出入国在留管理局",
    jurisdiction: ["福岡", "佐賀", "長崎", "大分", "熊本", "鹿児島", "宮崎", "沖縄"],
    address: "福岡県福岡市中央区舞鶴3-5-25",
  },
  "sendai": {
    name: "仙台出入国在留管理局",
    jurisdiction: ["宮城", "福島", "山形", "岩手", "秋田", "青森"],
    address: "宮城県仙台市宮城野区五輪1-3-20",
  },
  "sapporo": {
    name: "札幌出入国在留管理局",
    jurisdiction: ["北海道"],
    address: "北海道札幌市中央区大通西12丁目",
  },
  "takamatsu": {
    name: "高松出入国在留管理局",
    jurisdiction: ["香川", "徳島", "高知", "愛媛"],
    address: "香川県高松市丸の内1-1",
  },
  "yokohama": {
    name: "横浜支局",
    jurisdiction: ["神奈川"],
    address: "神奈川県横浜市金沢区鳥浜町10-7",
  },
};

// ──────────────────────────────────────────────────
// チェックロジック
// ──────────────────────────────────────────────────

async function runPreSubmissionChecklist(params: {
  pattern_id: string;
  submission_method: "online" | "paper" | "both";
  applicant_data: Record<string, string | number | boolean | undefined>;
  prepared_documents: string[];
  employer_prefecture?: string;
  residence_card_image_base64?: string;
  residence_card_image_mime_type?: "image/jpeg" | "image/png" | "image/webp";
  ocr_text?: string;
}) {
  const { pattern_id, submission_method, applicant_data, prepared_documents, employer_prefecture, residence_card_image_base64, residence_card_image_mime_type, ocr_text } = params;

  const checks: CheckItem[] = [];
  const pattern = ruleSets.application_patterns[pattern_id];

  if (!pattern) {
    return {
      status: "error",
      message: `パターンID '${pattern_id}' が見つかりません。suguvisa_application_type_determine ツールで正しいパターンIDを取得してください。`,
    };
  }

  // ─── Category 1: 申請パターンの確認 ───
  checks.push({
    id: "PAT-001",
    category: "申請パターン",
    check: "申請パターンの特定",
    status: "pass",
    detail: `${pattern.formal_name}（${pattern.from_visa} → ${pattern.to_visa}）`,
  });

  // ─── Category 2: 必要書類の存在チェック ───
  const requiredDocCategories: Record<string, string[]> = {
    "申請書本体": [`application_form_${pattern.form_code}`],
    "パスポートの写し": ["passport_copy"],
    "在留カードの写し": ["residence_card_copy"],
    "写真（4cm×3cm）": ["photo"],
    "雇用契約書（参考様式1-5号）": ["ref_form_1-5"],
    "雇用条件書（参考様式1-6号）": ["ref_form_1-6"],
  };

  if (pattern_id === "GRANT_01") {
    requiredDocCategories["健康診断個人票"] = ["health_certificate"];
  }
  if (pattern_id.includes("TOKKATSU")) {
    requiredDocCategories["申請理由書"] = ["reason_letter"];
  }
  if (pattern_id === "CHANGE_SSW1_C") {
    requiredDocCategories["技能実習修了証明書"] = ["training_completion"];
  }

  for (const [docName, docKeys] of Object.entries(requiredDocCategories)) {
    const isPresent = docKeys.some((k) => prepared_documents.includes(k));
    checks.push({
      id: `DOC-${checks.length + 1}`.padStart(7, "0"),
      category: "必要書類",
      check: docName,
      status: isPresent ? "pass" : "fail",
      detail: isPresent ? "確認済み" : "未準備",
      action_needed: isPresent ? undefined : `${docName}を準備してください`,
    });
  }

  // ─── Category 3: データ整合性チェック ───
  const ad = applicant_data;

  // 3a. 名前の一致チェック
  if (ad.applicant_name) {
    checks.push({
      id: "DATA-001",
      category: "データ整合性",
      check: "申請人氏名の記載",
      status: "pass",
      detail: `氏名: ${ad.applicant_name}`,
    });
  } else {
    checks.push({
      id: "DATA-001",
      category: "データ整合性",
      check: "申請人氏名の記載",
      status: "fail",
      detail: "申請人氏名が未入力です",
      action_needed: "全書類で統一した氏名を使用してください（パスポート記載の通り）",
    });
  }

  // 3b. 在留期限チェック
  if (ad.visa_expiry) {
    const expiry = new Date(ad.visa_expiry as string);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      checks.push({
        id: "DATA-002",
        category: "データ整合性",
        check: "在留期限",
        status: "fail",
        detail: `在留期限が ${Math.abs(daysUntilExpiry)} 日前に満了しています`,
        action_needed: "在留期限切れの場合は速やかに入管に相談してください",
      });
    } else if (daysUntilExpiry <= 30) {
      checks.push({
        id: "DATA-002",
        category: "データ整合性",
        check: "在留期限",
        status: "warning",
        detail: `在留期限まで残り ${daysUntilExpiry} 日です。急いで申請してください`,
        action_needed: "在留期限の3ヶ月前から申請可能です。速やかに提出してください",
      });
    } else {
      checks.push({
        id: "DATA-002",
        category: "データ整合性",
        check: "在留期限",
        status: "pass",
        detail: `在留期限まで残り ${daysUntilExpiry} 日（${ad.visa_expiry}）`,
      });
    }
  }

  // 3c. 報酬の最低賃金チェック
  if (ad.hourly_wage || ad.monthly_salary) {
    const hourly = ad.hourly_wage
      ? Number(ad.hourly_wage)
      : ad.monthly_salary
      ? Math.round(Number(ad.monthly_salary) / 173.8) // 月173.8時間（法定）
      : 0;

    const prefMinWage = employer_prefecture
      ? MIN_WAGE_BY_PREFECTURE[employer_prefecture] || NATIONAL_MIN_WAGE
      : NATIONAL_MIN_WAGE;

    if (hourly < prefMinWage) {
      checks.push({
        id: "DATA-003",
        category: "データ整合性",
        check: "報酬額（最低賃金チェック）",
        status: "fail",
        detail: `時給換算 ${hourly}円 は${employer_prefecture || "全国"}の最低賃金 ${prefMinWage}円 を下回っています`,
        action_needed: "報酬額を最低賃金以上に設定してください。特定技能は日本人と同等以上の報酬が必須条件です",
      });
    } else {
      checks.push({
        id: "DATA-003",
        category: "データ整合性",
        check: "報酬額（最低賃金チェック）",
        status: "pass",
        detail: `時給換算 ${hourly}円 ≥ 最低賃金 ${prefMinWage}円${employer_prefecture ? `（${employer_prefecture}）` : ""}`,
      });
    }
  }

  // 3d. 雇用契約期間の確認
  if (ad.contract_start && ad.contract_end) {
    const start = new Date(ad.contract_start as string);
    const end = new Date(ad.contract_end as string);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

    checks.push({
      id: "DATA-004",
      category: "データ整合性",
      check: "雇用契約期間",
      status: months > 0 ? "pass" : "fail",
      detail: `${ad.contract_start} ～ ${ad.contract_end}（約${months}ヶ月間）`,
      action_needed: months <= 0 ? "雇用契約の終了日が開始日より後であることを確認してください" : undefined,
    });
  }

  // ─── Category 3.5: 在留カードOCR整合性チェック ───
  if (residence_card_image_base64 || ocr_text) {
    try {
      const ocrResponse = await parseResidenceCardHandler({
        image_base64: residence_card_image_base64,
        image_mime_type: residence_card_image_mime_type,
        ocr_text
      });
      const content0 = ocrResponse.content?.[0];
      const ocrResultText = content0 && typeof content0 === 'object' && 'text' in content0 ? content0.text : undefined;
      if (ocrResultText) {
        const ocrData = JSON.parse(ocrResultText);
        if (ocrData && ocrData.parsed) {
          const parsed = ocrData.parsed;
          // 氏名チェック
          if (parsed.name_romaji && ad.applicant_name) {
            const isNameMatch = typeof ad.applicant_name === 'string' && parsed.name_romaji.toLowerCase().replace(/\s+/g, '') === ad.applicant_name.toLowerCase().replace(/\s+/g, '');
            checks.push({
              id: "DATA-005",
              category: "OCRチェック",
              check: "氏名の一致（OCR vs 申請データ）",
              status: isNameMatch ? "pass" : "fail",
              detail: `OCR: ${parsed.name_romaji} / 申請: ${ad.applicant_name}`,
              action_needed: isNameMatch ? undefined : "在留カードと申請データの氏名が一致しません。修正してください。",
            });
          }
          // 在留期限チェック
          if (parsed.visa_expiry && ad.visa_expiry) {
            const isExpiryMatch = parsed.visa_expiry === String(ad.visa_expiry);
            checks.push({
              id: "DATA-006",
              category: "OCRチェック",
              check: "在留期限の一致（OCR vs 申請データ）",
              status: isExpiryMatch ? "pass" : "fail",
              detail: `OCR: ${parsed.visa_expiry} / 申請: ${ad.visa_expiry}`,
              action_needed: isExpiryMatch ? undefined : "在留カードと申請データの在留期限が一致しません。更新してください。",
            });
          }
        }
      }
    } catch (err: any) {
      checks.push({
        id: "DATA-OCR-ERR",
        category: "OCRチェック",
        check: "OCR解析エラー",
        status: "warning",
        detail: `OCR処理中にエラーが発生しました: ${err.message}`,
      });
    }
  }

  // ─── Category 4: 署名・押印チェック ───
  const signatureItems = [
    { doc: "雇用契約書", signer: "所属機関代表者と申請人の双方" },
    { doc: "受入れ誓約書", signer: "所属機関代表者" },
    { doc: "支援計画書（1号の場合）", signer: "支援責任者" },
  ];

  signatureItems.forEach((item, index) => {
    checks.push({
      id: `SIGN-${(index + 1).toString().padStart(3, "0")}`,
      category: "署名・押印",
      check: `${item.doc}の署名`,
      status: "needs_confirmation",
      detail: `${item.signer}の署名・押印が必要`,
      action_needed: "提出前に署名・押印の有無を最終確認してください",
    });
  });

  // ─── Category 5: 提出方法別チェック ───
  if (submission_method === "online" || submission_method === "both") {
    checks.push({
      id: "ONLINE-001",
      category: "オンライン申請",
      check: "ファイル形式チェック",
      status: "info",
      detail: "PDF: 10MB以下、JPEG/PNG: 5MB以下が推奨",
      action_needed: "全ての添付書類をPDF化し、ファイルサイズを確認してください",
    });
    checks.push({
      id: "ONLINE-002",
      category: "オンライン申請",
      check: "オンラインシステムアカウント",
      status: "needs_confirmation",
      detail: "在留申請オンラインシステム（https://www.ras-immi.moj.go.jp/）",
      action_needed: "申請取次者のアカウントが有効であることを確認してください",
    });
    checks.push({
      id: "ONLINE-003",
      category: "オンライン申請",
      check: "CSVデータの準備",
      status: prepared_documents.includes("csv_data") ? "pass" : "warning",
      detail: "一括申請用CSVデータ（suguvisa_online_csv_generate / suguvisa_bulk_xlsm_generate で生成可能）",
      action_needed: prepared_documents.includes("csv_data") ? undefined : "一括申請用CSVの準備を推奨します",
    });
  }

  if (submission_method === "paper" || submission_method === "both") {
    checks.push({
      id: "PAPER-001",
      category: "紙申請",
      check: "印刷とコピー",
      status: "info",
      detail: "申請書は2部作成（正本＋副本）。添付書類はコピーで可",
    });
    checks.push({
      id: "PAPER-002",
      category: "紙申請",
      check: "収入印紙（更新の場合）",
      status: pattern_id.includes("RENEWAL") ? "needs_confirmation" : "info",
      detail: pattern_id.includes("RENEWAL")
        ? "4,000円の収入印紙が必要です"
        : "変更申請・認定申請には収入印紙は不要です",
    });
  }

  // ─── Category 6: 提出先入管局 ───
  if (employer_prefecture) {
    const office = Object.values(IMMIGRATION_OFFICES).find((o) =>
      o.jurisdiction.includes(employer_prefecture)
    );
    if (office) {
      checks.push({
        id: "OFFICE-001",
        category: "提出先",
        check: "管轄入管局",
        status: "info",
        detail: `${office.name}（${office.address}）`,
      });
    }
  }

  // ─── 集計 ───
  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const confirmCount = checks.filter((c) => c.status === "needs_confirmation").length;
  const totalChecks = checks.length;
  const readiness = failCount === 0 ? (warningCount === 0 ? "ready" : "mostly_ready") : "not_ready";

  return {
    status: "ok",
    pattern_id,
    pattern_name: pattern.formal_name,
    from_visa: pattern.from_visa,
    to_visa: pattern.to_visa,
    submission_method,
    readiness,
    summary: {
      total_checks: totalChecks,
      pass: passCount,
      fail: failCount,
      warning: warningCount,
      needs_confirmation: confirmCount,
      pass_rate: `${Math.round((passCount / totalChecks) * 100)}%`,
    },
    checks,
    _ai_instructions:
      "📋 以下の形式で提出前チェックリストを表示してください：\n\n" +
      "## 提出準備状況\n" +
      `- ${readiness === "ready" ? "✅ **提出準備完了**" : readiness === "mostly_ready" ? "⚠️ **ほぼ準備完了（確認事項あり）**" : "❌ **未準備の項目があります**"}\n` +
      `- 合格: ${passCount} / 不合格: ${failCount} / 警告: ${warningCount} / 要確認: ${confirmCount}\n\n` +
      "## チェック結果\n" +
      "カテゴリごとにテーブル形式で結果を表示:\n" +
      "- ✅ pass → 緑\n" +
      "- ❌ fail → 赤（対応方法も記載）\n" +
      "- ⚠️ warning → 黄（推奨対応を記載）\n" +
      "- 🔍 needs_confirmation → 青（目視確認依頼）\n" +
      "- ℹ️ info → グレー\n\n" +
      (failCount > 0
        ? `## 🔴 アクション必要（${failCount}件）\n不合格項目を一覧にして、対応方法を具体的に案内\n`
        : "") +
      "\n## 次のステップ\n" +
      (failCount === 0
        ? "- 📤 提出方法に応じた手順を案内\n- 🏢 管轄入管局の情報を提示"
        : "- 不合格項目の解消を先に行う"),
    _next_actions: [
      ...(failCount > 0
        ? [{ action: "resolve_issues", reason: `${failCount}件の不合格項目を解消` }]
        : []),
      ...(submission_method === "online" || submission_method === "both"
        ? [{ tool: "suguvisa_online_csv_generate", reason: "オンライン申請用CSVデータ生成" }]
        : []),
      { tool: "suguvisa_deadlines_calculate", reason: "申請期限の確認" },
    ],
  };
}

// ──────────────────────────────────────────────────
// ツール登録
// ──────────────────────────────────────────────────

export function registerPreSubmissionChecklist(server: McpServer) {
  server.tool(
    "suguvisa_submission_checklist_verify",
    "【提出前最終チェックリスト】オンライン/紙申請の直前に、全書類の整合性・不足を最終確認。(1)必要書類の存在チェック (2)氏名・日付・報酬の整合性チェック（都道府県別最低賃金対応）(3)署名・押印の確認 (4)添付ファイル形式チェック（オンライン申請用）(5)管轄入管局の特定（全国8局+支局対応）。readiness判定: ready/mostly_ready/not_ready で提出可否を明示。 / Pre-submission checklist that validates all documents, data consistency, minimum wage, signatures, and identifies the jurisdictional immigration office.",
    {
      pattern_id: z.string().describe(
        "申請パターンID（例: 'CHANGE_SSW1_C', 'GRANT_01'）。suguvisa_application_type_determine で取得したIDを使用。"
      ),
      submission_method: z.enum(["online", "paper", "both"]).default("online").describe(
        "提出方法。online=オンライン申請、paper=紙申請（窓口提出）、both=両方準備"
      ),
      applicant_data: z.record(z.union([z.string(), z.number(), z.boolean()])).describe(
        "申請人のデータ（キー/値ペア）。以下のフィールドをチェック:\n" +
        "- applicant_name: 氏名\n" +
        "- visa_expiry: 在留期限（YYYY-MM-DD）\n" +
        "- hourly_wage / monthly_salary: 報酬（時給または月給）\n" +
        "- contract_start / contract_end: 雇用契約期間\n" +
        "- nationality: 国籍"
      ),
      prepared_documents: z.array(z.string()).describe(
        "準備済み書類のキー配列。例:\n" +
        "['passport_copy', 'residence_card_copy', 'photo', 'ref_form_1-5', 'ref_form_1-6', 'csv_data']"
      ),
      employer_prefecture: z.string().optional().describe(
        "所属機関（雇用主）の所在都道府県。最低賃金チェックと管轄入管局の特定に使用。\n" +
        "例: '東京', '鹿児島', '北海道'"
      ),
      residence_card_image_base64: z.string().optional().describe("在留カード画像のBase64エンコードデータ（表面）"),
      residence_card_image_mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]).optional().describe("画像のMIMEタイプ"),
      ocr_text: z.string().optional().describe("事前に読み取ったOCRテキスト（フォールバック用）"),
    },
    { title: "Pre-submission checklist", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async (params) => {
      const result = await runPreSubmissionChecklist(params as any);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
