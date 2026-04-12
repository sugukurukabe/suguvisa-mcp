/**
 * SuguVisa REST API Router — GPT Actions / 外部 API 向け
 * 
 * MCP ツールと同等の機能を REST エンドポイントとして提供する。
 * OpenAI Custom GPT の Actions から呼び出せる形式。
 */
import { Router, Request, Response } from "express";
import {
  determinePattern,
  getRequiredDocumentsData,
  calculateDeadlinesData,
  generateAnnualReportCsvHandler,
  createOfflineExcel,
} from "../services/index.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const lawUpdatesData = require("../data/law-updates.json");

const router = Router();

// ─── POST /api/v1/tools/determine ───
router.post("/determine", (req: Request, res: Response) => {
  try {
    let { from_visa, to_visa, context, has_supervisor_experience } = req.body;

    if (!from_visa || !to_visa) {
      res.status(400).json({ status: "error", message: "from_visa and to_visa are required" });
      return;
    }

    // 特定技能2号計画だが実務経験不足 → 特定活動へフォールバック
    if (to_visa === "特定技能2号" && has_supervisor_experience === false) {
      to_visa = "特定活動";
      context = "2号移行準備";
    }

    const result = determinePattern(from_visa, to_visa, context);
    if (!result) {
      res.json({ status: "not_found", message: `申請パターンが見つかりません: ${from_visa} → ${to_visa}` });
      return;
    }

    res.json({
      status: "found",
      pattern_id: result.patternId,
      formal_name: result.pattern.formal_name,
      short_name: result.pattern.short_name,
      form_code: result.pattern.form_code,
      from_visa: result.pattern.from_visa,
      to_visa: result.pattern.to_visa,
      description: result.pattern.description,
      typical_processing_days: result.pattern.typical_processing_days,
      exam_exemption: result.pattern.exam_exemption,
      skip_conditions: result.pattern.skip_conditions,
      special_documents: result.pattern.special_documents,
      notes: result.pattern.notes,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── POST /api/v1/tools/required-documents ───
router.post("/required-documents", (req: Request, res: Response) => {
  try {
    const { pattern_id, support_type, is_same_employer_2year, is_domestic, industry_field, employer_type } = req.body;
    if (!pattern_id) {
      res.status(400).json({ status: "error", message: "pattern_id is required" });
      return;
    }
    const result = getRequiredDocumentsData({
      pattern_id,
      support_type: support_type || "delegated",
      is_same_employer_2year: is_same_employer_2year || false,
      is_domestic: is_domestic !== false,
      industry_field,
      employer_type: employer_type || "corporate",
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── POST /api/v1/tools/deadlines ───
router.post("/deadlines", (req: Request, res: Response) => {
  try {
    const { expiry_date, event_date, ssw1_start_date, coe_issue_date } = req.body;
    const result = calculateDeadlinesData({ expiry_date, event_date, ssw1_start_date, coe_issue_date });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── POST /api/v1/tools/validate ───
router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { fields } = req.body;
    if (!fields || typeof fields !== "object") {
      res.status(400).json({ status: "error", message: "fields object is required" });
      return;
    }
    // Dynamically import validators
    const validators = await import("../services/index.js");
    const results: Record<string, any> = {};
    let allValid = true;
    let errorCount = 0;

    for (const [key, value] of Object.entries(fields)) {
      let result: any;
      const val = String(value);

      if (key.includes("residence_card")) {
        result = validators.validateResidenceCardNumber(val);
      } else if (key.includes("corporate_number")) {
        result = validators.validateCorporateNumber(val);
      } else if (key.includes("furigana")) {
        result = validators.validateFurigana(val);
      } else if (key.includes("date")) {
        result = validators.validateDateFormat(val);
      } else {
        result = { valid: true, message: "No validation rule" };
      }
      results[key] = result;
      if (!result.valid) { allValid = false; errorCount++; }
    }

    res.json({
      status: allValid ? "all_valid" : "has_errors",
      summary: { total_fields: Object.keys(fields).length, errors: errorCount },
      results,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── POST /api/v1/tools/annual-report-csv ───
router.post("/annual-report-csv", async (req: Request, res: Response) => {
  try {
    const { reports } = req.body;
    if (!Array.isArray(reports)) {
      res.status(400).json({ status: "error", message: "reports array is required" });
      return;
    }
    const result = await generateAnnualReportCsvHandler(reports);
    // Parse the MCP content format back into a REST response
    const parsed = JSON.parse(result.content[0].text);
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── POST /api/v1/tools/annual-report-excel ───
router.post("/annual-report-excel", async (req: Request, res: Response) => {
  try {
    const { company_name, reporting_year, paper_form_data } = req.body;
    if (!company_name || !reporting_year) {
      res.status(400).json({ status: "error", message: "company_name and reporting_year are required" });
      return;
    }
    const outputPath = await createOfflineExcel(company_name, reporting_year, paper_form_data || []);
    res.json({
      status: "success",
      message: "オフライン用定期報告書（Excel）を生成しました",
      output_path: outputPath,
      processed_records: (paper_form_data || []).length,
      company_name,
      reporting_year,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── GET /api/v1/tools/law-updates ───
router.get("/law-updates", (req: Request, res: Response) => {
  try {
    let updates = [...lawUpdatesData.updates];
    const { since, keyword, status } = req.query;

    if (since && typeof since === "string") {
      const sinceDate = new Date(since);
      updates = updates.filter((u: any) => new Date(u.date) >= sinceDate);
    }
    if (keyword && typeof keyword === "string") {
      const kw = keyword.toLowerCase();
      updates = updates.filter((u: any) =>
        u.title.toLowerCase().includes(kw) || u.summary.toLowerCase().includes(kw)
      );
    }
    if (status && typeof status === "string") {
      updates = updates.filter((u: any) => u.status.includes(status));
    }

    res.json({
      status: "ok",
      data_version: lawUpdatesData.version,
      count: updates.length,
      updates,
      disclaimer: lawUpdatesData.disclaimer,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Also support POST for GPT compatibility
router.post("/law-updates", (req: Request, res: Response) => {
  try {
    let updates = [...lawUpdatesData.updates];
    const { since, keyword, status } = req.body;

    if (since && typeof since === "string") {
      const sinceDate = new Date(since);
      updates = updates.filter((u: any) => new Date(u.date) >= sinceDate);
    }
    if (keyword && typeof keyword === "string") {
      const kw = keyword.toLowerCase();
      updates = updates.filter((u: any) =>
        u.title.toLowerCase().includes(kw) || u.summary.toLowerCase().includes(kw)
      );
    }
    if (status && typeof status === "string") {
      updates = updates.filter((u: any) => u.status.includes(status));
    }

    res.json({
      status: "ok",
      data_version: lawUpdatesData.version,
      count: updates.length,
      updates,
      disclaimer: lawUpdatesData.disclaimer,
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
