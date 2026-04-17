import { describe, expect, it } from "vitest";
import { parseJsonl, serializeJsonl } from "../dataset.js";

describe("dataset parser", () => {
  it("parses JSONL and skips comments/empty", () => {
    const text = [
      "# comment",
      "",
      JSON.stringify({ id: "a", input: { q: 1 } }),
      JSON.stringify({ id: "b", input: { q: 2 }, expected: { r: 3 } }),
    ].join("\n");
    const out = parseJsonl(text);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("a");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJsonl("{not-json")).toThrow(/invalid JSONL/);
  });

  it("throws on missing id", () => {
    expect(() => parseJsonl(JSON.stringify({ input: {} }))).toThrow(/missing id/);
  });

  it("round-trips via serializeJsonl", () => {
    const cases: Array<{ id: string; input: Record<string, number> }> = [
      { id: "a", input: { x: 1 } },
      { id: "b", input: { y: 2 } },
    ];
    const s = serializeJsonl(cases);
    const parsed = parseJsonl(s);
    expect(parsed).toEqual(cases);
  });
});
