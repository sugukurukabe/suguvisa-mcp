import { describe, it, expect } from "vitest";
import {
  validateResidenceCardNumber,
  validateCorporateNumber,
  validateFurigana,
  validateDateFormat,
  validateExpiryDate,
  validatePassportNumber,
  validatePhoneNumber,
  validateTotalSSW1Period
} from "../validate-data.js";

describe("validate-data", () => {
  describe("validateResidenceCardNumber", () => {
    it("should validate correct residence card number", () => {
      const result = validateResidenceCardNumber("AB12345678CD");
      expect(result.valid).toBe(true);
    });

    it("should invalidate incorrect residence card number", () => {
      const result = validateResidenceCardNumber("A12345678CD");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateCorporateNumber", () => {
    it("should invalidate non-13-digit corporate numbers", () => {
      expect(validateCorporateNumber("123456789012").valid).toBe(false);
      expect(validateCorporateNumber("12345678901234").valid).toBe(false);
      expect(validateCorporateNumber("abcdefghijklm").valid).toBe(false);
    });

    it("should validate check digit correctly", () => {
      // Real corporate number example: 8700110005901
      expect(validateCorporateNumber("8700110005901").valid).toBe(true);
      
      // Incorrect check digit (changed first digit)
      expect(validateCorporateNumber("7700110005901").valid).toBe(false);
    });
  });

  describe("validateFurigana", () => {
    it("should validate correct hiragana", () => {
      expect(validateFurigana("やまだ たろう").valid).toBe(true);
    });

    it("should invalidate katakana or kanji", () => {
      expect(validateFurigana("ヤマダ タロウ").valid).toBe(false);
      expect(validateFurigana("山田 太郎").valid).toBe(false);
    });
  });

  describe("validateDateFormat", () => {
    it("should validate YYYY-MM-DD", () => {
      expect(validateDateFormat("2026-04-01").valid).toBe(true);
    });

    it("should invalidate other formats", () => {
      expect(validateDateFormat("2026/04/01").valid).toBe(false);
      expect(validateDateFormat("01-04-2026").valid).toBe(false);
      expect(validateDateFormat("2026-13-01").valid).toBe(false); // Invalid month 13
    });
  });

  describe("validateExpiryDate", () => {
    it("should invalidate past dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const formatted = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;
      const result = validateExpiryDate(formatted);
      expect(result.valid).toBe(false);
      expect(result.daysLeft).toBeLessThan(0);
    });

    it("should provide warning for dates within 14 days", () => {
      const nearFuture = new Date();
      nearFuture.setDate(nearFuture.getDate() + 10);
      const formatted = `${nearFuture.getFullYear()}-${String(nearFuture.getMonth() + 1).padStart(2, '0')}-${String(nearFuture.getDate()).padStart(2, '0')}`;
      const result = validateExpiryDate(formatted);
      expect(result.valid).toBe(true);
      expect(result.message).toContain("⚠️");
      expect(result.daysLeft).toBe(10);
    });

    it("should provide message for dates within 60 days", () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 30);
      const formatted = `${farFuture.getFullYear()}-${String(farFuture.getMonth() + 1).padStart(2, '0')}-${String(farFuture.getDate()).padStart(2, '0')}`;
      const result = validateExpiryDate(formatted);
      expect(result.valid).toBe(true);
      expect(result.message).not.toContain("⚠️");
      expect(result.daysLeft).toBe(30);
    });

    it("should validate normal future dates", () => {
      const veryFarFuture = new Date();
      veryFarFuture.setDate(veryFarFuture.getDate() + 100);
      const formatted = `${veryFarFuture.getFullYear()}-${String(veryFarFuture.getMonth() + 1).padStart(2, '0')}-${String(veryFarFuture.getDate()).padStart(2, '0')}`;
      const result = validateExpiryDate(formatted);
      expect(result.valid).toBe(true);
      expect(result.daysLeft).toBe(100);
    });
  });

  describe("validatePassportNumber", () => {
    it("should validate 6-9 alphanumeric uppercase", () => {
      expect(validatePassportNumber("A1234567").valid).toBe(true);
      expect(validatePassportNumber("123456789").valid).toBe(true);
    });

    it("should invalidate lowercase", () => {
      expect(validatePassportNumber("a1234567").valid).toBe(false);
    });

    it("should invalidate too short or too long", () => {
      expect(validatePassportNumber("A1234").valid).toBe(false);
      expect(validatePassportNumber("A1234567890").valid).toBe(false);
    });
  });

  describe("validatePhoneNumber", () => {
    it("should validate domestic numbers", () => {
      expect(validatePhoneNumber("090-1234-5678").valid).toBe(true);
      expect(validatePhoneNumber("03-1234-5678").valid).toBe(true);
    });

    it("should validate international numbers", () => {
      expect(validatePhoneNumber("+62-812-3456-7890").valid).toBe(true);
    });

    it("should invalidate weird formats", () => {
      expect(validatePhoneNumber("090-abc").valid).toBe(false);
    });
  });

  describe("validateTotalSSW1Period", () => {
    it("should invalidate if > 60 months", () => {
      expect(validateTotalSSW1Period("61").valid).toBe(false);
    });

    it("should warn if between 54 and 60 months", () => {
      const r = validateTotalSSW1Period("55");
      expect(r.valid).toBe(true);
      expect(r.message).toContain("⚠️");
    });

    it("should validate normal months", () => {
      const r = validateTotalSSW1Period("36");
      expect(r.valid).toBe(true);
      expect(r.message).not.toContain("⚠️");
    });
  });
});
