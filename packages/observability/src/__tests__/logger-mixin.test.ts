import { describe, expect, it } from "vitest";
import { obsMixin } from "../logger-mixin.js";
import { withObsContext } from "../context.js";

describe("obsMixin", () => {
  it("returns empty object when no context is active", () => {
    expect(obsMixin()).toEqual({});
  });

  it("returns request-scoped fields when context is active", async () => {
    await withObsContext(
      {
        requestId: "req-1",
        traceId: "abcdef0123456789abcdef0123456789",
        spanId: "abcdef0123456789",
        tenantId: "tenant-A",
        principalSubject: "user-1",
        operation: "mcp.tool.search",
      },
      async () => {
        expect(obsMixin()).toEqual({
          requestId: "req-1",
          traceId: "abcdef0123456789abcdef0123456789",
          spanId: "abcdef0123456789",
          tenantId: "tenant-A",
          principal: "user-1",
          operation: "mcp.tool.search",
        });
      },
    );
  });

  it("omits optional fields if absent", async () => {
    await withObsContext({ requestId: "req-2" }, async () => {
      expect(obsMixin()).toEqual({ requestId: "req-2" });
    });
  });
});
