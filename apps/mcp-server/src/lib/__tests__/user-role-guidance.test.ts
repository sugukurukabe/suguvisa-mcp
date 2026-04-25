import { describe, expect, it } from "vitest";
import {
  SUGUVISA_USER_ROLES,
  formatUserRoleGuidanceForAi,
  getUserRoleGuidance,
} from "../user-role-guidance.js";

describe("user role guidance", () => {
  it("全ロールに回答方針と推奨ツールがある", () => {
    for (const role of SUGUVISA_USER_ROLES) {
      const guidance = getUserRoleGuidance(role);

      expect(guidance.role).toBe(role);
      expect(guidance.labelJa.length).toBeGreaterThan(0);
      expect(guidance.answerPolicy.length).toBeGreaterThan(0);
      expect(guidance.responsibilityBoundary.length).toBeGreaterThan(0);
      expect(guidance.recommendedTools.length).toBeGreaterThan(0);
    }
  });

  it("派遣元会社の従業員向けには派遣固有書類と14日届出を強調する", () => {
    const guidance = getUserRoleGuidance("dispatching_organization_staff");

    expect(guidance.labelJa).toContain("派遣元");
    expect(guidance.requiredFocus).toContain("派遣計画書（参考様式第1-12号）");
    expect(guidance.requiredFocus).toContain("就業条件明示書（参考様式第1-13号）");
    expect(guidance.requiredFocus).toContain("派遣先変更時の14日届出");
    expect(guidance.requiredFocus).toContain("派遣先の押印書類");
    expect(guidance.responsibilityBoundary).toContain("通常雇用");
  });

  it("派遣先担当者向けには所属機関本体と混同しない境界を返す", () => {
    const guidance = getUserRoleGuidance("dispatch_client_contact");

    expect(guidance.labelJa).toContain("派遣先");
    expect(guidance.responsibilityBoundary).toContain("特定技能所属機関");
    expect(guidance.answerPolicy).toContain("派遣元");
    expect(guidance.requiredFocus).toContain("派遣先概要書");
    expect(guidance.requiredFocus).toContain("押印書類");
  });

  it("外国人本人向けには退職後就労誤解と費用・郵送物を明示する", () => {
    const guidance = getUserRoleGuidance("foreign_worker");

    expect(guidance.primaryConcerns).toContain("申請費用と郵送物");
    expect(guidance.requiredFocus).toContain("退職後の就労不可リスク");
    expect(guidance.responsibilityBoundary).toContain("退職後すぐ別会社で働ける");
  });

  it("AI向け整形文に立場と責任境界が含まれる", () => {
    const text = formatUserRoleGuidanceForAi("foreign_worker");

    expect(text).toContain("ユーザー立場");
    expect(text).toContain("外国人本人");
    expect(text).toContain("責任境界");
  });
});
