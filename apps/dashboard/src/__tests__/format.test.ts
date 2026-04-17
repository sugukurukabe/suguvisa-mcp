import { describe, it, expect } from "vitest";
import { formatJpy, formatDateJp, planBadgeTone } from "@/lib/format";

describe("format helpers", () => {
  it("formats JPY with locale separators", () => {
    expect(formatJpy(19800)).toBe("¥19,800");
    expect(formatJpy(0)).toBe("¥0");
    expect(formatJpy(1_234_567)).toBe("¥1,234,567");
  });

  it("formats date in Japanese locale", () => {
    const iso = "2026-04-17T00:00:00.000Z";
    const out = formatDateJp(iso);
    expect(out).toMatch(/\d{4}/);
    expect(out).toMatch(/04/);
  });

  it("returns dash for null/invalid date", () => {
    expect(formatDateJp(null)).toBe("—");
    expect(formatDateJp(undefined)).toBe("—");
    expect(formatDateJp("not-a-date")).toBe("—");
  });

  it("returns distinct tones for status kinds", () => {
    expect(planBadgeTone("active")).toMatch(/emerald/);
    expect(planBadgeTone("past_due")).toMatch(/amber/);
    expect(planBadgeTone("canceled")).toMatch(/rose/);
    expect(planBadgeTone("free")).toMatch(/slate/);
  });
});
