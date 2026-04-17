import { describe, it, expect } from "vitest";
import { buildLookupKey, determinePattern } from "../determine-application.js";

describe("determine-application", () => {
  describe("buildLookupKey", () => {
    it("should build key without context", () => {
      expect(buildLookupKey("留学", "特定技能1号")).toBe("留学_特定技能1号");
    });

    it("should build key with context", () => {
      expect(buildLookupKey("特定技能1号", "特定技能1号", "転職")).toBe("特定技能1号_特定技能1号_転職");
    });
  });

  describe("determinePattern", () => {
    it("should return the correct pattern exact match without context", () => {
      const result = determinePattern("海外在住", "特定技能1号");
      expect(result).not.toBeNull();
      expect(result?.patternId).toBe("GRANT_01");
      expect(result?.pattern.formal_name).toBe("在留資格認定証明書交付申請");
      // Check that the returned object matches the data definition
      expect(result?.lookupKey).toBe("海外在住_特定技能1号");
    });

    it("should return the correct pattern exact match with context", () => {
      const result = determinePattern("特定技能1号", "特定技能1号", "転職");
      expect(result).not.toBeNull();
      expect(result?.patternId).toBe("CHANGE_SSW1_D");
      expect(result?.lookupKey).toBe("特定技能1号_特定技能1号_転職");
    });

    it("should fallback to exact match without context if context provided but no context match found", () => {
      // If we ask for "留学_特定技能1号" with context "転職", it should fallback to "留学_特定技能1号"
      const result = determinePattern("留学", "特定技能1号", "転職");
      expect(result).not.toBeNull();
      // "留学_特定技能1号" maps to "CHANGE_SSW1_A"
      expect(result?.patternId).toBe("CHANGE_SSW1_A");
      expect(result?.lookupKey).toBe("留学_特定技能1号");
    });

    it("should use partial match fallback if from/to Visa match a pattern but are not in the lookup table", () => {
      // Let's force a partial match by passing a visa combination that is inside the pattern list but maybe not in lookup table.
      // Every item in application_patterns is technically matched by its from_visa and to_visa if not found in lookup.
      // "海外在住（ビザなし）" to "特定技能1号" is the actual from/to in GRANT_01, while lookup is "海外在住_特定技能1号"
      const result = determinePattern("海外在住（ビザなし）", "特定技能1号");
      expect(result).not.toBeNull();
      expect(result?.patternId).toBe("GRANT_01");
      expect(result?.lookupKey).toBe("fallback:海外在住（ビザなし）_特定技能1号");
    });

    it("should return null if no pattern is found", () => {
      const result = determinePattern("観光", "永住者");
      expect(result).toBeNull();
    });
  });
});
