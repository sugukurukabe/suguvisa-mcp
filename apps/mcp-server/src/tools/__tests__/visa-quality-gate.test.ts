import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const ruleSets = require("../../data/rule-sets.json");
const formFieldMappings = require("../../data/form-field-mappings.json");
const referenceForms = require("../../data/reference-forms.json");
const ssw2Checklist = require("../../data/ssw2-document-checklist.json");

describe("visa accuracy quality gate", () => {
  it("全申請パターンの別記様式に紙申請フィールドマッピングがある", () => {
    for (const [patternId, pattern] of Object.entries(ruleSets.application_patterns) as Array<[string, { form_code: string }]>) {
      expect(formFieldMappings.forms[pattern.form_code], `${patternId} uses unmapped form_code ${pattern.form_code}`).toBeDefined();
      expect(formFieldMappings.forms[pattern.form_code].used_by, `${pattern.form_code} should reference ${patternId}`).toContain(patternId);
    }
  });

  it("全申請パターンに正式名称・期限目安・試験免除説明がある", () => {
    for (const [patternId, pattern] of Object.entries(ruleSets.application_patterns) as Array<[string, Record<string, unknown>]>) {
      expect(pattern.formal_name, `${patternId} formal_name`).toBeTruthy();
      expect(pattern.short_name, `${patternId} short_name`).toBeTruthy();
      expect(pattern.typical_processing_days, `${patternId} typical_processing_days`).toBeTruthy();
      expect(pattern.exam_exemption, `${patternId} exam_exemption`).toBeTruthy();
      expect((pattern.exam_exemption as { note?: string }).note, `${patternId} exam_exemption.note`).toBeTruthy();
    }
  });

  it("必須期限ルールが定義されている", () => {
    expect(ruleSets.deadlines["随時届出"].days).toBe(14);
    expect(ruleSets.deadlines["定期届出"].period).toBe("4/1〜5/31");
    expect(ruleSets.deadlines["更新申請可能開始"].months_before).toBe(3);
    expect(ruleSets.deadlines["特定技能1号通算上限"].years).toBe(5);
  });

  it("派遣が認められるSSW2分野は農業・漁業だけに限定されている", () => {
    const dispatchFields = Object.entries(ssw2Checklist.fields)
      .filter(([, value]) => (value as { has_dispatch: boolean }).has_dispatch)
      .map(([key]) => key)
      .sort();

    expect(dispatchFields).toEqual(["agriculture", "fishery"]);
    expect(ssw2Checklist.field_specific_documents.agriculture.employment_types).toContain("dispatch_corporate");
    expect(ssw2Checklist.field_specific_documents.fishery.employment_types).toContain("dispatch_corporate");
  });

  it("主要参考様式が公式様式マスタに存在する", () => {
    for (const formKey of ["1-2", "1-5", "1-6", "1-11", "1-17", "agriculture-1", "agriculture-2"]) {
      expect(referenceForms.forms[formKey], `missing reference form ${formKey}`).toBeDefined();
      expect(referenceForms.forms[formKey].fields.length, `reference form ${formKey} fields`).toBeGreaterThan(0);
    }
  });

  it("留学から特定技能変更の実務条件がルール化されている", () => {
    const studentPattern = ruleSets.application_patterns.CHANGE_SSW1_A;

    expect(studentPattern.special_documents).toContain("出席票または成績表（出席率80%以上を証明）");
    expect(studentPattern.notes.join(" ")).toContain("出席率80%以上");
    expect(ruleSets.practical_knowledge.student_to_ssw.attendance_safe_threshold_percent).toBe(80);
    expect(ruleSets.practical_knowledge.student_to_ssw.red_flags).toContain("資格外活動28時間超過の疑い");
  });

  it("実習から特定技能への実務判断と一括申請ガードが定義されている", () => {
    expect(ruleSets.practical_knowledge.technical_intern_to_ssw.preferred_preparation_months).toBe(3);
    expect(ruleSets.practical_knowledge.technical_intern_to_ssw.bridge_route_threshold_months).toBe(1.5);
    expect(ruleSets.practical_knowledge.bulk_application_rules.online_submission_deadline).toContain("前日まで");
    expect(ruleSets.correction_catalog.status).toBe("awaiting_real_cases");
  });
});
