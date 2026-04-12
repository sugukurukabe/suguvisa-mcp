import { describe, it, expect } from "vitest";
import { calculateDeadlinesData } from "../calculate-deadlines.js";

function getDeadlineByType(deadlines: any[], type: string) {
  return deadlines.find((d) => d.type === type);
}

describe("calculate-deadlines", () => {
  it("should calculate 14-day rule for ad-hoc notifications", () => {
    // Event happened on 2024-01-01
    // 14 days later is 2024-01-15
    // Today is 2024-01-10
    const today = new Date(2024, 0, 10); // month is 0-indexed
    const result = calculateDeadlinesData({ event_date: "2024-01-01" }, today);
    const deadline = getDeadlineByType(result.deadlines, "随時届出");
    expect(deadline).toBeDefined();
    expect(deadline.deadline).toBe("2024-01-15");
    expect(deadline.days_remaining).toBe(5);
    expect(deadline.is_overdue).toBe(false);
    expect(deadline.urgency).toBe("urgent");
  });

  it("should calculate overdue ad-hoc notifications", () => {
    const today = new Date(2024, 0, 20);
    const result = calculateDeadlinesData({ event_date: "2024-01-01" }, today);
    const deadline = getDeadlineByType(result.deadlines, "随時届出");
    expect(deadline.is_overdue).toBe(true);
    expect(deadline.days_remaining).toBe(-5);
    expect(deadline.urgency).toBe("OVERDUE");
  });

  it("should calculate renewal start date (3 months before expiry)", () => {
    // Expiry: 2024-04-01
    // Application starts: 2024-01-01
    // Today: 2024-01-10
    const today = new Date(2024, 0, 10);
    const result = calculateDeadlinesData({ expiry_date: "2024-04-01" }, today);
    const deadline = getDeadlineByType(result.deadlines, "更新申請");
    expect(deadline).toBeDefined();
    expect(deadline.can_apply_from).toBe("2024-01-01");
    expect(deadline.can_apply_now).toBe(true);
    expect(deadline.days_until_expiry).toBe(82); // Leap year 2024: Jan 21 days + Feb 29 days + Mar 31 days + 1 day = 82
    expect(deadline.is_expired).toBe(false);
    expect(deadline.urgency).toBe("soon"); // <= 90 days
  });

  it("should detect expired visa renewal", () => {
    const today = new Date(2024, 4, 1); // May 1
    const result = calculateDeadlinesData({ expiry_date: "2024-04-01" }, today);
    const deadline = getDeadlineByType(result.deadlines, "更新申請");
    expect(deadline.is_expired).toBe(true);
    expect(deadline.urgency).toBe("EXPIRED");
  });

  it("should compute cumulative 5-year limit for SSW1", () => {
    // Start date: 2020-01-01 -> 5 years later: 2025-01-01
    // Today: 2024-12-01
    const today = new Date(2024, 11, 1);
    const result = calculateDeadlinesData({ ssw1_start_date: "2020-01-01" }, today);
    const deadline = getDeadlineByType(result.deadlines, "通算上限");
    expect(deadline).toBeDefined();
    expect(deadline.max_date).toBe("2025-01-01");
    expect(deadline.days_remaining).toBe(31); // Dec has 31 days
    expect(deadline.urgency).toBe("urgent"); // <= 180 days
  });

  it("should compute COE validity (3 months)", () => {
    // Issue: 2024-01-01 -> Expiry: 2024-04-01
    const today = new Date(2024, 2, 1); // March 1
    const result = calculateDeadlinesData({ coe_issue_date: "2024-01-01" }, today);
    const deadline = getDeadlineByType(result.deadlines, "認定証明書");
    expect(deadline).toBeDefined();
    expect(deadline.visa_application_deadline).toBe("2024-04-01");
    expect(deadline.days_remaining).toBe(31); // March has 31 days
    expect(deadline.urgency).toBe("normal"); // > 30 days
  });

  it("should generate periodic notification correctly", () => {
    const today = new Date(2024, 0, 10);
    const result = calculateDeadlinesData({}, today);
    const deadline = getDeadlineByType(result.deadlines, "定期届出");
    expect(deadline).toBeDefined();
    expect(deadline.period).toBe("2024/4/1〜5/31");
  });

  it("should calculate multiple deadlines at once", () => {
    const today = new Date(2024, 0, 10);
    const result = calculateDeadlinesData({ 
        expiry_date: "2024-04-01",
        ssw1_start_date: "2020-01-01"
    }, today);
    
    expect(result.deadlines.length).toBe(3); // expiry, ssw1, periodic
    expect(getDeadlineByType(result.deadlines, "更新申請")).toBeDefined();
    expect(getDeadlineByType(result.deadlines, "通算上限")).toBeDefined();
    expect(getDeadlineByType(result.deadlines, "定期届出")).toBeDefined();
  });
});
