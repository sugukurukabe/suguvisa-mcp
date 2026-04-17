import { describe, expect, it } from "vitest";
import {
  getObsContext,
  newRequestId,
  parseTraceparent,
  updateObsContext,
  withObsContext,
} from "../context.js";

describe("ObsContext", () => {
  it("newRequestId returns valid UUID v4-ish string", () => {
    const id = newRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("withObsContext provides context inside the run", async () => {
    await withObsContext({ requestId: "req-1", operation: "test" }, async () => {
      expect(getObsContext()?.requestId).toBe("req-1");
    });
    expect(getObsContext()).toBeUndefined();
  });

  it("updateObsContext mutates current context", async () => {
    await withObsContext({ requestId: "req-2" }, async () => {
      updateObsContext({ tenantId: "tenant-A", attrs: { foo: "bar" } });
      const cur = getObsContext();
      expect(cur?.tenantId).toBe("tenant-A");
      expect(cur?.attrs?.foo).toBe("bar");
      updateObsContext({ attrs: { baz: "qux" } });
      expect(getObsContext()?.attrs).toEqual({ foo: "bar", baz: "qux" });
    });
  });

  it("contexts are isolated across async runs", async () => {
    const results: string[] = [];
    await Promise.all([
      withObsContext({ requestId: "r1" }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(getObsContext()!.requestId);
      }),
      withObsContext({ requestId: "r2" }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(getObsContext()!.requestId);
      }),
    ]);
    expect(results.sort()).toEqual(["r1", "r2"]);
  });
});

describe("parseTraceparent", () => {
  it("parses valid W3C header", () => {
    const header = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
    expect(parseTraceparent(header)).toEqual({
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
    });
  });

  it("returns undefined for invalid version", () => {
    expect(parseTraceparent("01-xxx-yyy-01")).toBeUndefined();
  });

  it("returns undefined for malformed", () => {
    expect(parseTraceparent("garbage")).toBeUndefined();
    expect(parseTraceparent(undefined)).toBeUndefined();
    expect(parseTraceparent("00-short-short-01")).toBeUndefined();
  });

  it("rejects non-hex ids", () => {
    expect(parseTraceparent("00-gggggggggggggggggggggggggggggggg-b7ad6b7169203331-01")).toBeUndefined();
  });
});
