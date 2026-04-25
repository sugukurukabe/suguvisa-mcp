import { describe, expect, it } from "vitest";
import { SUGUVISA_USER_ROLES } from "../user-role-guidance.js";
import {
  SUGUVISA_SUPER_APP_BLUEPRINT,
  getCalendarSyncTarget,
  getRoleHomeSection,
  listMvpWorkspaceConnections,
} from "../super-app-blueprint.js";

describe("SuguVisa super app blueprint", () => {
  it("Google Calendar同期の対象期限と重複防止キーを定義している", () => {
    const dispatchDeadline = getCalendarSyncTarget("dispatch_change_14day");

    expect(dispatchDeadline.defaultReminderDays).toEqual([7, 3, 1]);
    expect(dispatchDeadline.requiredScopes).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(dispatchDeadline.duplicateKeyFields).toEqual(
      expect.arrayContaining(["tenant_id", "case_id", "deadline_type"]),
    );
  });

  it("MVPではCalendar MCP、Calendar API、Drive、Meetを採用しGmailは後段に分ける", () => {
    const mvpTypes = listMvpWorkspaceConnections().map((connection) => connection.type);

    expect(mvpTypes).toEqual(
      expect.arrayContaining([
        "google_calendar_official_mcp",
        "google_calendar_api",
        "drive_api",
        "google_meet",
      ]),
    );
    expect(mvpTypes).not.toContain("gmail_api");
  });

  it("全ユーザー立場にホーム画面セクションがある", () => {
    for (const role of SUGUVISA_USER_ROLES) {
      const section = getRoleHomeSection(role);

      expect(section.role).toBe(role);
      expect(section.headlineJa.length).toBeGreaterThan(0);
      expect(section.primaryWidgets.length).toBeGreaterThan(0);
      expect(section.nextBestActions.length).toBeGreaterThan(0);
    }
  });

  it("書類取込、専門家レビュー、分析KPIをカバーしている", () => {
    expect(SUGUVISA_SUPER_APP_BLUEPRINT.caseConcierge.outputCards).toEqual(
      expect.arrayContaining([
        "today_next_action",
        "missing_documents_by_party",
        "grounded_legal_warning",
      ]),
    );
    expect(SUGUVISA_SUPER_APP_BLUEPRINT.intakePipeline.map((step) => step.source)).toEqual(
      expect.arrayContaining(["gmail_attachment", "drive_file", "manual_upload", "calendar_note"]),
    );
    expect(SUGUVISA_SUPER_APP_BLUEPRINT.expertReviewTriggers.map((trigger) => trigger.id)).toEqual(
      expect.arrayContaining([
        "ungrounded_legal_answer",
        "work_permission_risk",
        "dispatch_legality_risk",
        "online_submission_same_day",
        "illegal_work_or_mismatched_duties",
        "student_attendance_low",
      ]),
    );
    expect(SUGUVISA_SUPER_APP_BLUEPRINT.analyticsKpis.map((kpi) => kpi.id)).toEqual(
      expect.arrayContaining([
        "deadline_overdue_count",
        "revision_required_rate",
        "grounded_answer_rate",
      ]),
    );
  });
});
