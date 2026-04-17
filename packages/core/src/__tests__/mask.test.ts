/**
 * マスキング関数のテスト
 * Tests for masking functions
 * Pengujian untuk fungsi masking
 */
import { describe, expect, it } from "vitest";
import {
  maskAddress,
  maskBankAccount,
  maskByKind,
  maskCorporateId,
  maskDob,
  maskEmail,
  maskGeneric,
  maskMyNumber,
  maskName,
  maskPassport,
  maskPhone,
  maskResidenceCard,
} from "../pii/mask.js";

describe("maskName", () => {
  it("masks Japanese names", () => {
    expect(maskName("田中太郎")).toBe("田***");
  });

  it("masks names with spaces (romanized)", () => {
    expect(maskName("GILANG PERMANA")).toBe("G***** P******");
  });

  it("handles single-character names", () => {
    expect(maskName("A")).toBe("A*");
  });

  it("handles empty strings", () => {
    expect(maskName("")).toBe("");
  });

  it("handles full-width spaces", () => {
    expect(maskName("田中　太郎")).toBe("田* 太*");
  });
});

describe("maskResidenceCard", () => {
  it("keeps first two characters", () => {
    expect(maskResidenceCard("AB12345678CD")).toBe("AB**********");
  });

  it("handles short values", () => {
    expect(maskResidenceCard("AB")).toBe("**");
    expect(maskResidenceCard("A")).toBe("*");
  });

  it("strips whitespace", () => {
    expect(maskResidenceCard("AB 1234 5678 CD")).toBe("AB**********");
  });
});

describe("maskPassport", () => {
  it("keeps first two characters", () => {
    expect(maskPassport("TK1234567")).toBe("TK*******");
  });

  it("handles very short values", () => {
    expect(maskPassport("TK")).toBe("**");
  });
});

describe("maskDob", () => {
  it("masks ISO date keeping year", () => {
    expect(maskDob("1995-03-15")).toBe("1995-**-**");
  });

  it("masks slash date keeping year", () => {
    expect(maskDob("1995/03/15")).toBe("1995/**/**");
  });

  it("returns fully masked for unknown format", () => {
    expect(maskDob("1995年3月15日")).toBe("****-**-**");
  });
});

describe("maskAddress", () => {
  it("preserves prefecture and city", () => {
    expect(maskAddress("鹿児島県指宿市十町1-1-1")).toBe("鹿児島県指宿市****");
  });

  it("preserves prefecture only", () => {
    expect(maskAddress("東京都")).toBe("東京都****");
  });

  it("handles non-Japanese addresses", () => {
    const result = maskAddress("Jl. Merdeka 10, Jakarta");
    expect(result.startsWith("Jl.")).toBe(true);
    expect(result).toContain("*");
  });
});

describe("maskPhone", () => {
  it("masks middle digits of Japanese mobile", () => {
    expect(maskPhone("090-1234-5678")).toBe("090-****-5678");
  });

  it("handles plain 11-digit numbers", () => {
    expect(maskPhone("09012345678")).toBe("090-****-5678");
  });

  it("handles short numbers", () => {
    expect(maskPhone("12")).toBe("**");
  });
});

describe("maskEmail", () => {
  it("masks local part only", () => {
    expect(maskEmail("taro.tanaka@example.com")).toBe(
      "t**********@example.com",
    );
  });

  it("handles single-char local", () => {
    expect(maskEmail("a@example.com")).toBe("a@example.com");
  });

  it("handles malformed email", () => {
    expect(maskEmail("notanemail")).toBe("**********");
  });
});

describe("maskCorporateId", () => {
  it("keeps first four digits", () => {
    expect(maskCorporateId("1234567890123")).toBe("1234*********");
  });

  it("strips non-digits", () => {
    expect(maskCorporateId("1234-5678-9012-3")).toBe("1234*********");
  });
});

describe("maskMyNumber", () => {
  it("masks every digit", () => {
    expect(maskMyNumber("123456789012")).toBe("************");
  });
});

describe("maskBankAccount", () => {
  it("keeps last four digits", () => {
    expect(maskBankAccount("1234567")).toBe("***4567");
  });

  it("handles short accounts", () => {
    expect(maskBankAccount("1234")).toBe("****");
  });
});

describe("maskGeneric", () => {
  it("hides second half", () => {
    expect(maskGeneric("secret123")).toBe("secr*****");
  });
});

describe("maskByKind dispatch", () => {
  it("dispatches residence_card", () => {
    expect(maskByKind("residence_card", "AB12345678CD")).toBe(
      "AB**********",
    );
  });

  it("dispatches passport", () => {
    expect(maskByKind("passport", "TK1234567")).toBe("TK*******");
  });

  it("falls back to generic for unknown", () => {
    expect(maskByKind("generic", "something")).toBe(maskGeneric("something"));
  });
});
