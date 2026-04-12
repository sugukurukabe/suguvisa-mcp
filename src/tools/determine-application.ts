import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json");

interface ExamExemption {
  skill_test: boolean | "免除";
  japanese_test: boolean | "免除";
  note: string;
}

interface ApplicationPattern {
  formal_name: string;
  short_name: string;
  form_code: string;
  from_visa: string;
  to_visa: string;
  description: string;
  typical_processing_days: string;
  exam_exemption?: ExamExemption;
  skip_conditions?: string[];
  special_documents?: string[];
  notes?: string[];
}

const patternLookup: Record<string, string> = ruleSets.pattern_lookup;
const applicationPatterns: Record<string, ApplicationPattern> = ruleSets.application_patterns;

/**
 * from_visa × to_visa × context からルックアップキーを組み立てる
 * Build lookup key from fromVisa, toVisa, and context
 * Membangun kunci pencarian dari fromVisa, toVisa, dan context
 */
export function buildLookupKey(fromVisa: string, toVisa: string, context?: string): string {
  const base = `${fromVisa}_${toVisa}`;
  return context ? `${base}_${context}` : base;
}

/**
 * 申請種別を決定する
 * Determine application type
 * Menentukan jenis aplikasi
 */
export function determinePattern(fromVisa: string, toVisa: string, context?: string): { patternId: string; pattern: ApplicationPattern; lookupKey: string } | null {
  // 1) コンテキスト付きで完全一致 / Exact match with context / Cocok persis dengan konteks
  if (context) {
    const keyWithCtx = buildLookupKey(fromVisa, toVisa, context);
    const patternId = patternLookup[keyWithCtx];
    if (patternId && applicationPatterns[patternId]) {
      return { patternId, pattern: applicationPatterns[patternId], lookupKey: keyWithCtx };
    }
  }

  // 2) コンテキストなしで一致 / Match without context / Cocok tanpa konteks
  const key = buildLookupKey(fromVisa, toVisa);
  const patternId = patternLookup[key];
  if (patternId && applicationPatterns[patternId]) {
    return { patternId, pattern: applicationPatterns[patternId], lookupKey: key };
  }

  // 3) from_visa/to_visa 部分一致フォールバック / Partial match fallback / Cocok sebagian sebagai cadangan
  for (const [id, p] of Object.entries(applicationPatterns)) {
    if (p.from_visa === fromVisa && p.to_visa === toVisa) {
      return { patternId: id, pattern: p, lookupKey: `fallback:${fromVisa}_${toVisa}` };
    }
  }

  return null;
}

export function registerDetermineApplication(server: McpServer) {
  server.tool(
    "determine_application_type",
    "【申請パターン自動判定】現在の在留資格と申請先の在留資格から、正式な申請種別（変更・更新・認定）、使用様式（別記第30号の5等）、標準処理期間、試験免除条件を瞬時に特定。技能実習→特定技能、特定技能1号→2号、転職、更新など全パターンに対応。parse_residence_card の直後に使用してください。 / Instantly determines the exact application type, required form, processing period, and exam exemptions from current and target visa status.",
    {
      from_visa: z.string().describe(
        "現在の在留資格（parse_residence_card で取得した visa_type をそのまま入力してください） / Current visa status"
      ),
      to_visa: z.string().describe(
        "申請する在留資格（例: '特定技能1号', '特定活動'） / Target visa status"
      ),
      context: z.string().optional().describe(
        "追加コンテキスト（例: '転職', '更新'） / Additional context (e.g., 'job_change', 'renewal')"
      ),
      has_supervisor_experience: z.boolean().optional().describe(
        "【特定技能2号用】班長等の指導・監督実務経験があるか / For SSW2: Has supervisor/leader experience?"
      )
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ from_visa, to_visa, context, has_supervisor_experience }) => {
      // === 特定活動のスマート推論 ===
      // 在留カードには単に「特定活動」と記載される。ほとんどの場合は特定技能1号への
      // 移行準備（つなぎビザ）なので、to_visa が未指定 or 特定技能系でない場合は
      // 自動的に「特定技能1号への変更申請」として処理する。
      if (from_visa === "特定活動" || from_visa.includes("特定活動")) {
        // from_visa の正規化 — 「特定活動（46号）」「特定活動（特定技能準備）」等 → 「特定活動」
        from_visa = "特定活動";
        
        // to_visa が指定されていない、または「特定活動」のままの場合 → 特定技能1号を推定
        if (!to_visa || to_visa === "特定活動" || to_visa === from_visa) {
          to_visa = "特定技能1号";
        }
      }

      // 特定技能2号への変更・更新希望だが、実務経験が不足している場合の救済措置（特定活動へのフォールバック）
      if (to_visa === "特定技能2号" && has_supervisor_experience === false) {
        to_visa = "特定活動";
        context = "2号移行準備";
      }

      const result = determinePattern(from_visa, to_visa, context);

      if (!result) {
        const available = Object.entries(patternLookup)
          .map(([k, v]) => `  ${k} → ${v}`)
          .join("\n");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "not_found",
              message: `申請パターンが見つかりません: ${from_visa} → ${to_visa}${context ? ` (${context})` : ""}`,
              message_en: `Application pattern not found: ${from_visa} → ${to_visa}${context ? ` (${context})` : ""}`,
              message_id: `Pola aplikasi tidak ditemukan: ${from_visa} → ${to_visa}${context ? ` (${context})` : ""}`,
              hint: "from_visa と to_visa を以下の対応表から選んでください / Select from_visa and to_visa from the table below / Pilih from_visa dan to_visa dari tabel di bawah",
              available_patterns: available,
            }, null, 2),
          }],
        };
      }

      const { patternId, pattern, lookupKey } = result;

      // === 特定活動→特定技能1号の場合の追加コンテキスト ===
      const isTokkatsuToSSW1 = patternId === "CHANGE_SSW1_F";
      const isCompanyChange = isTokkatsuToSSW1 && (context === "転職" || context === "job_change");
      const reasonLetterRequired = isTokkatsuToSSW1; // 特定活動→SSW1は基本的に理由書が必要

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "found",
            lookup_key: lookupKey,
            pattern_id: patternId,
            formal_name: pattern.formal_name,
            short_name: pattern.short_name,
            form_code: pattern.form_code,
            from_visa: pattern.from_visa,
            to_visa: pattern.to_visa,
            description: pattern.description,
            typical_processing_days: pattern.typical_processing_days,
            exam_exemption: pattern.exam_exemption,
            skip_conditions: pattern.skip_conditions,
            special_documents: pattern.special_documents,
            notes: pattern.notes,
            reason_letter_required: reasonLetterRequired,
            company_change_detected: isCompanyChange,
            work_during_application: ruleSets.work_during_application,
            _ai_instructions:
              "📋 結果を以下の形式で提示してください：\n" +
              "1. パターン名と申請ルート（from_visa → to_visa）を見出しで表示\n" +
              "2. 試験免除情報がある場合は ✅/❌ アイコンで一目で分かるように表示\n" +
              "3. typical_processing_days を「通常〇〜〇日で処理」と自然な日本語で伝える\n" +
              "4. 次のステップとして get_required_documents を呼ぶことを提案（pattern_id を引き継ぐ）\n" +
              "5. 申請中の就労ルール（work_during_application）を必ず注意喚起する\n" +
              (isTokkatsuToSSW1 ?
                "\n🚨 【絶対ルール：特定活動について】\n" +
                "以下のことは絶対にしないでください：\n" +
                "- ❌「アルバイト系の特定活動では？」と聞く\n" +
                "- ❌「ワーホリ系では？」と聞く\n" +
                "- ❌「46号なのか？」と聞く\n" +
                "- ❌「就労制限なし」を見て「単純労働系」と推測する\n" +
                "- ❌ 不許可リスクを過度に強調して不安を煽る\n" +
                "\n" +
                "在留カードに「特定活動」と書いてある場合、就労制限の欄に「指定された活動のみ可」\n" +
                "「特定技能により指定された活動のみ可」等と書いてあれば、\n" +
                "★ これは100%「特定技能1号への移行準備のためのつなぎビザ」です ★\n" +
                "\n" +
                "やるべきことはシンプル：\n" +
                "✅ 「特定活動→特定技能1号の変更申請ですね」と即座に確定\n" +
                "✅ 分野（農業、外食など）を確認\n" +
                "✅ 新しい受入れ機関（会社名）を確認\n" +
                "✅ すぐに書類準備に入る\n" +
                "\n" +
                "【理由書について】\n" +
                "このパターンでは申請理由書（変更の経緯と理由）が必要です。\n" +
                "特に受入れ機関が変わる（転職を伴う）場合は、\n" +
                "「なぜ元の会社ではなく別の会社で特定技能をやるのか」を\n" +
                "論理的に説明する理由書が不可欠です。\n" +
                "generate_reason_letter ツール（use_ai: true）で生成可能です。\n"
              : ""),
            _next_actions: [
              { tool: "get_required_documents", reason: "必要書類リストを取得", params: { pattern_id: patternId } },
              ...(reasonLetterRequired ? [{ tool: "generate_reason_letter", reason: "申請理由書を生成（特定活動→SSW1変更の経緯説明）" }] : []),
              { tool: "calculate_deadlines", reason: "期限を計算（在留期限が分かれば）" },
              { tool: "validate_application_data", reason: "申請データの整合性チェック" },
            ],
          }, null, 2),
        }],
      };
    }
  );
}
