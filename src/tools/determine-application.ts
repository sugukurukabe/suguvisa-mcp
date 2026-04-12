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
    "現在のビザと申請するビザから、正式な申請種別・必要な手続きを自動判定します。parse_residence_card の直後に使用してください。Determine application type based on current and target visas.",
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
            work_during_application: ruleSets.work_during_application,
            _ai_instructions:
              "📋 結果を以下の形式で提示してください：\n" +
              "1. パターン名と申請ルート（from_visa → to_visa）を見出しで表示\n" +
              "2. 試験免除情報がある場合は ✅/❌ アイコンで一目で分かるように表示\n" +
              "3. typical_processing_days を「通常〇〜〇日で処理」と自然な日本語で伝える\n" +
              "4. 次のステップとして get_required_documents を呼ぶことを提案（pattern_id を引き継ぐ）\n" +
              "5. 申請中の就労ルール（work_during_application）を必ず注意喚起する",
          }, null, 2),
        }],
      };
    }
  );
}
