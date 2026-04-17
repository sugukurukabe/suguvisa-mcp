import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateText, isVertexAIAvailable } from "../lib/vertex-ai.js";
import { createClient } from "@supabase/supabase-js";

// === 業務定型文テンプレート ===
const TEMPLATES: Record<string, Record<string, string>> = {
  // --- 勤務連絡 ---
  early_start: {
    ja: "明日は{time}集合です。",
    id: "Besok kumpul jam {time}.",
    vi: "Ngày mai tập trung lúc {time}.",
    my: "မနက်ဖြန် {time} မှာ စုရမည်။",
    zh: "明天{time}集合。",
    en: "Please gather at {time} tomorrow.",
  },
  overtime: {
    ja: "今日は{hours}時間残業があります。",
    id: "Hari ini ada lembur {hours} jam.",
    vi: "Hôm nay tăng ca {hours} tiếng.",
    my: "ဒီနေ့ အချိန်ပိုလုပ်ရမည် {hours} နာရီ။",
    zh: "今天加班{hours}小时。",
    en: "There will be {hours} hours of overtime today.",
  },
  day_off_change: {
    ja: "{date}は休みに変更です。{alt_date}が出勤日になります。",
    id: "Tanggal {date} berubah jadi libur. Tanggal {alt_date} jadi hari kerja.",
    vi: "Ngày {date} đổi thành nghỉ. Ngày {alt_date} đi làm.",
    my: "{date} ကို အနားယူရက် ပြောင်းပါသည်။ {alt_date} တက်ရမည်။",
    zh: "{date}改为休息日。{alt_date}改为工作日。",
    en: "The day off has been changed to {date}. {alt_date} will be a workday.",
  },
  rain_cancel: {
    ja: "雨天のため、今日は休みです。明日の連絡を待ってください。",
    id: "Karena hujan, hari ini libur. Tunggu info untuk besok.",
    vi: "Do mưa, hôm nay nghỉ. Chờ thông báo ngày mai.",
    my: "မိုးရွာနေသောကြောင့် ဒီနေ့ နားပါ။ မနက်ဖြန်အကြောင်း စောင့်ပါ။",
    zh: "因下雨，今天休息。请等待明天的通知。",
    en: "Due to rain, today is a day off. Please wait for tomorrow's notice.",
  },
  // --- 安全注意 ---
  heat_warning: {
    ja: "今日は猛暑です。こまめに水を飲んで、帽子をかぶってください。",
    id: "Hari ini sangat panas. Sering minum air dan pakai topi.",
    vi: "Hôm nay nóng. Uống nước thường xuyên và đội mũ.",
    my: "ဒီနေ့ အလွန်ပူပါသည်။ ရေမကြာခဏ သောက်ပြီး ဦးထုပ်ဆောင်းပါ။",
    zh: "今天很热。请经常喝水，戴帽子。",
    en: "It's very hot today. Drink water frequently and wear a hat.",
  },
  pesticide_warning: {
    ja: "今日は農薬散布日です。マスクと手袋を必ずつけてください。",
    id: "Hari ini hari penyemprotan pestisida. Wajib pakai masker dan sarung tangan.",
    vi: "Hôm nay phun thuốc trừ sâu. Bắt buộc đeo khẩu trang và găng tay.",
    my: "ဒီနေ့ ပိုးသတ်ဆေးဖျန်းရက်ဖြစ်ပါသည်။ မျက်နှာဖုံးနှင့် လက်အိတ်ဝတ်ပါ။",
    zh: "今天是喷洒农药的日子。请必须戴口罩和手套。",
    en: "Today is pesticide spraying day. You must wear a mask and gloves.",
  },
  machine_caution: {
    ja: "機械を使う前に、必ず安全チェックをしてください。",
    id: "Sebelum menggunakan mesin, wajib cek keamanan.",
    vi: "Trước khi sử dụng máy, bắt buộc kiểm tra an toàn.",
    my: "စက်ကို မသုံးမီ ဘေးကင်းစစ်ဆေးမှု ပြုလုပ်ပါ။",
    zh: "使用机器前，请务必进行安全检查。",
    en: "Before using any machine, always do a safety check.",
  },
  // --- 生活連絡 ---
  salary_day: {
    ja: "{date}が給料日です。通帳を確認してください。",
    id: "Gajian tanggal {date}. Silakan cek buku tabungan.",
    vi: "Ngày {date} là ngày lương. Hãy kiểm tra sổ tiết kiệm.",
    my: "{date} လစာထုတ်ရက်ဖြစ်ပါသည်။ စာရင်းစာအုပ် စစ်ဆေးပါ။",
    zh: "{date}是发工资的日子。请查看存折。",
    en: "Payday is on {date}. Please check your bankbook.",
  },
  health_check: {
    ja: "{date}に健康診断があります。朝食を食べないで来てください。",
    id: "Pemeriksaan kesehatan tanggal {date}. Jangan sarapan.",
    vi: "Khám sức khỏe ngày {date}. Không ăn sáng.",
    my: "{date} ကျန်းမာရေးစစ်ဆေးပါမည်။ နံနက်စာ မစားပါနဲ့။",
    zh: "{date}有健康检查。请不要吃早餐来。",
    en: "Health check on {date}. Please come without eating breakfast.",
  },
  meeting_notice: {
    ja: "{date}の{time}からミーティングがあります。必ず出席してください。",
    id: "Ada rapat tanggal {date} jam {time}. Wajib hadir.",
    vi: "Cuộc họp ngày {date} lúc {time}. Phải tham dự.",
    my: "{date} {time} မှာ အစည်းအဝေးရှိပါသည်။ မပျက်မကွက် တက်ပါ။",
    zh: "{date}{time}有会议。请务必参加。",
    en: "There will be a meeting on {date} at {time}. Attendance is mandatory.",
  },
};

// 言語コードマッピング
const LANGUAGE_MAP: Record<string, string> = {
  id: "インドネシア語", vi: "ベトナム語", my: "ミャンマー語",
  zh: "中国語", en: "英語", ja: "日本語",
  pt: "ポルトガル語", th: "タイ語", ne: "ネパール語",
  km: "クメール語（カンボジア語）", tl: "タガログ語（フィリピン語）",
};

// 専門用語辞書（農業・製造向け）
const DOMAIN_GLOSSARY: Record<string, Record<string, string>> = {
  agriculture: {
    "ハウス": "greenhouse/rumah kaca",
    "畝（うね）": "ridge/bedengan",
    "農薬": "pesticide/pestisida",
    "肥料": "fertilizer/pupuk",
    "収穫": "harvest/panen",
    "定植": "transplanting/tanam",
    "摘花": "deflowering/pemangkasan bunga",
    "灌水": "irrigation/pengairan",
    "マルチ": "mulch/mulsa",
    "育苗": "seedling/pembibitan",
  },
  manufacturing: {
    "プレス機": "press machine/mesin press",
    "フォークリフト": "forklift/forklift",
    "溶接": "welding/pengelasan",
    "クレーン": "crane/derek",
    "金型": "mold/cetakan",
    "旋盤": "lathe/mesin bubut",
    "品質検査": "quality inspection/inspeksi kualitas",
    "不良品": "defective product/produk cacat",
  },
};

export function registerTranslateWorkplaceMessage(server: McpServer) {
  // === ツール1: AI自由翻訳 ===
  server.tool(
    "translate_workplace_message",
    "【多言語翻訳】業務連絡や安全指示を外国人スタッフの母語に翻訳。農業・製造の専門用語辞書を内蔵し、Google翻訳より正確な現場用語の翻訳を実現。日本語→多言語、多言語→日本語の双方向対応。「やさしい日本語」への変換も可能。 / Translates workplace messages to/from foreign staff's native language with built-in agriculture & manufacturing glossary.",
    {
      message: z.string().describe(
        "翻訳したいメッセージ（日本語で書くと外国語に、外国語で書くと日本語に翻訳） / Message to translate"
      ),
      target_languages: z.array(z.string()).optional().describe(
        "翻訳先の言語コード配列（例: ['id', 'vi']）。省略時はインドネシア語・ベトナム語に翻訳。対応: id(インドネシア語), vi(ベトナム語), my(ミャンマー語), zh(中国語), en(英語), pt(ポルトガル語), th(タイ語), ne(ネパール語), km(クメール語), tl(タガログ語)"
      ),
      domain: z.enum(["agriculture", "manufacturing", "general"]).optional().describe(
        "業界（専門用語辞書を切替え）: agriculture(農業), manufacturing(製造), general(一般)"
      ),
      to_easy_japanese: z.boolean().optional().describe(
        "true にすると「やさしい日本語」にも変換する / Also convert to Easy Japanese"
      ),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ message, target_languages, domain, to_easy_japanese }) => {
      const langs = target_languages || ["id", "vi"];
      const domainKey = domain || "general";
      const baseGlossary = DOMAIN_GLOSSARY[domainKey] || {};

      let dynamicGlossary: Record<string, string> = {};
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
      
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data, error } = await supabase
            .from("domain_glossaries")
            .select("term_ja, term_translated")
            .eq("domain", domainKey);
            
          if (!error && data) {
            data.forEach(item => {
              if (item.term_ja && item.term_translated) {
                dynamicGlossary[item.term_ja] = item.term_translated;
              }
            });
          }
        } catch (e: any) {
          console.warn("[WARNING] Supabase 辞書の取得に失敗しました:", e.message);
        }
      }

      const glossary = { ...baseGlossary, ...dynamicGlossary };

      if (!isVertexAIAvailable()) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Vertex AI (Gemini) が設定されていません",
              detail: "GCP_PROJECT_ID と認証情報が必要です",
            }, null, 2),
          }],
        };
      }

      const langNames = langs.map(l => LANGUAGE_MAP[l] || l).join("、");
      const glossaryText = Object.entries(glossary)
        .map(([ja, trans]) => `  「${ja}」→ ${trans}`)
        .join("\n");

      const prompt = `あなたは日本の農場・工場で働く外国人スタッフ向けの通訳者です。
以下のメッセージを翻訳してください。

翻訳先言語: ${langNames}
業界: ${domainKey === "agriculture" ? "農業" : domainKey === "manufacturing" ? "製造業" : "一般"}

${glossaryText ? `【専門用語辞書】\n${glossaryText}\n` : ""}
${to_easy_japanese ? "【追加指示】日本語の原文を「やさしい日本語」にも変換してください。\n" : ""}

翻訳ルール:
1. 現場で使われる自然な表現にする（文学的な翻訳不要）
2. 専門用語は辞書の訳語を優先
3. 数字・日付・時刻はそのまま保持
4. 敬語は不要、シンプルで分かりやすく
5. 安全に関する注意は ⚠️ を先頭に付ける

入力メッセージ:
「${message}」

以下のJSON形式で回答してください:
{
  "original": "原文",
  ${to_easy_japanese ? '"easy_japanese": "やさしい日本語版",' : ""}
  "translations": {
    ${langs.map(l => `"${l}": {"language": "${LANGUAGE_MAP[l] || l}", "text": "翻訳文"}`).join(",\n    ")}
  },
  "notes": "翻訳上の注意点（あれば）"
}

JSONのみを出力してください。`;

      try {
        const result = await generateText(prompt, true); // Flash で高速翻訳
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "翻訳結果のパースに失敗", raw: result }, null, 2) }],
          };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...parsed,
              _ai_instructions: `翻訳結果を以下のフォーマットでユーザーに表示してください:
1. 各言語の翻訳を国旗絵文字付きで表示（🇮🇩 🇻🇳 🇲🇲 🇨🇳 🇬🇧）
2. やさしい日本語がある場合は📝マーク付きで表示
3. 注意事項があれば💡マーク付きで表示
4. 「この翻訳をSlackに転送しますか？」等のアクション提案をする`,
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "翻訳中にエラーが発生しました",
              detail: err.message,
            }, null, 2),
          }],
        };
      }
    }
  );

  // === ツール2: 定型文テンプレート翻訳 ===
  server.tool(
    "get_workplace_template",
    "【定型文テンプレート】「早出」「残業」「雨天中止」「農薬注意」など、現場でよく使う定型連絡を10言語に瞬時翻訳。AIを使わないので即レスポンス。変数（時間・日付等）の差し込みにも対応。 / Instantly translates common workplace phrases to 10 languages without AI. Supports variable substitution.",
    {
      template_id: z.string().describe(
        `テンプレートID: ${Object.keys(TEMPLATES).join(", ")} / Template ID`
      ),
      variables: z.record(z.string()).optional().describe(
        "変数の値（例: {time: '06:00', date: '4/15'}）/ Variable values"
      ),
      target_languages: z.array(z.string()).optional().describe(
        "表示する言語コード（省略時は全言語） / Language codes to show"
      ),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ template_id, variables, target_languages }) => {
      const template = TEMPLATES[template_id];
      if (!template) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: `テンプレート「${template_id}」が見つかりません`,
              available_templates: Object.keys(TEMPLATES).map(id => ({
                id,
                preview: TEMPLATES[id].ja,
              })),
              _ai_instructions: "利用可能なテンプレート一覧をユーザーに表示して選んでもらってください",
            }, null, 2),
          }],
        };
      }

      const langs = target_languages || Object.keys(template).filter(k => k !== "ja");
      const results: Record<string, string> = {};

      for (const lang of ["ja", ...langs]) {
        let text = template[lang];
        if (!text) continue;
        // 変数の差し込み
        if (variables) {
          for (const [key, value] of Object.entries(variables)) {
            text = text.replace(new RegExp(`\\{${key}\\}`, "g"), value);
          }
        }
        results[lang] = text;
      }

      const FLAG_MAP: Record<string, string> = {
        ja: "🇯🇵", id: "🇮🇩", vi: "🇻🇳", my: "🇲🇲",
        zh: "🇨🇳", en: "🇬🇧", pt: "🇧🇷", th: "🇹🇭",
        ne: "🇳🇵", km: "🇰🇭", tl: "🇵🇭",
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            template_id,
            translations: results,
            _ai_instructions: `テンプレート翻訳結果を以下のように表示:
${Object.entries(results).map(([lang, text]) => `${FLAG_MAP[lang] || "🏳️"} **${LANGUAGE_MAP[lang] || lang}**: ${text}`).join("\n")}

変数が未入力の場合は {time} 等のプレースホルダーが残るので、ユーザーに値を聞いてください。`,
          }, null, 2),
        }],
      };
    }
  );

  // === ツール3: テンプレート一覧 ===
  server.tool(
    "list_workplace_templates",
    "【定型文一覧】利用可能な定型文テンプレートの一覧を取得。「どんな定型文がある？」と聞かれたらこのツールを使用。 / Lists all available workplace message templates.",
    {},
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async () => {
      const list = Object.entries(TEMPLATES).map(([id, msgs]) => ({
        id,
        japanese: msgs.ja,
        available_languages: Object.keys(msgs),
        variables: (msgs.ja.match(/\{(\w+)\}/g) || []).map(v => v.replace(/[{}]/g, "")),
      }));

      const categories = {
        work_schedule: ["early_start", "overtime", "day_off_change", "rain_cancel"],
        safety: ["heat_warning", "pesticide_warning", "machine_caution"],
        daily_life: ["salary_day", "health_check", "meeting_notice"],
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            total: list.length,
            categories,
            templates: list,
            _ai_instructions: "テンプレート一覧をカテゴリ別に見やすく表示してください。カテゴリは「勤務連絡」「安全注意」「生活連絡」です。",
          }, null, 2),
        }],
      };
    }
  );
}
