/**
 * Tool Routing 評価器 — あるツール呼び出し (args) が期待されるツールに
 * ルーティングされ、期待される出力キー / 値を含むかを検証する。
 *
 * Input:  { toolName: string, args: Record<string, unknown> }
 * Expected: { toolName?: string, outputContains?: Record<string, unknown> }
 *
 * 呼び出し先は `invokeTool` コールバックで注入する。これにより
 * MCP server に依存せず、テスト用のモックや本物のツールハンドラを
 * 差し替え可能。
 */
import type { EvalCase, EvalResult, Evaluator } from "../types.js";

export interface ToolInput {
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolExpected {
  toolName?: string;
  /** 結果（オブジェクト）に部分一致で含まれるべき key/value */
  outputContains?: Record<string, unknown>;
  /** 期待するパス (JSONPath 的な "a.b.c") のいずれかが存在すれば OK */
  outputHasPath?: string[];
}

export type InvokeToolFn = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

export interface ToolRoutingEvaluatorOptions {
  invokeTool: InvokeToolFn;
  threshold?: number;
  name?: string;
}

export class ToolRoutingEvaluator
  implements Evaluator<ToolInput, ToolExpected>
{
  readonly name: string;
  readonly description = "MCP tool routing and output shape check";
  readonly threshold: number;
  private readonly invokeTool: InvokeToolFn;

  constructor(options: ToolRoutingEvaluatorOptions) {
    this.invokeTool = options.invokeTool;
    this.threshold = options.threshold ?? 1.0;
    this.name = options.name ?? "tool-routing";
  }

  async evaluate(
    c: EvalCase<ToolInput, ToolExpected>,
  ): Promise<EvalResult> {
    const expected = c.expected ?? {};
    const expectedTool = expected.toolName ?? c.input.toolName;
    if (expected.toolName && expected.toolName !== c.input.toolName) {
      return {
        score: 0,
        passed: false,
        message: `input toolName ${c.input.toolName} does not match expected ${expected.toolName}`,
      };
    }
    let output: unknown;
    try {
      output = await this.invokeTool(c.input.toolName, c.input.args);
    } catch (err) {
      return {
        score: 0,
        passed: false,
        message: `tool ${c.input.toolName} threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
    checks.push({
      name: `routed_to_${expectedTool}`,
      ok: true,
    });

    if (expected.outputContains) {
      for (const [path, value] of Object.entries(expected.outputContains)) {
        const actual = getPath(output, path);
        const ok = deepContains(actual, value);
        checks.push({
          name: `contains:${path}`,
          ok,
          detail: ok ? undefined : `got=${JSON.stringify(actual)} expected~${JSON.stringify(value)}`,
        });
      }
    }

    if (expected.outputHasPath) {
      for (const path of expected.outputHasPath) {
        const actual = getPath(output, path);
        const ok = actual !== undefined;
        checks.push({
          name: `has:${path}`,
          ok,
          detail: ok ? undefined : `path ${path} missing`,
        });
      }
    }

    const total = checks.length;
    const passed = checks.filter((x) => x.ok).length;
    const score = total === 0 ? 1 : passed / total;
    return {
      score,
      passed: score >= this.threshold,
      message:
        score >= this.threshold
          ? undefined
          : `failed checks: ${checks
              .filter((x) => !x.ok)
              .map((x) => `${x.name}${x.detail ? ` (${x.detail})` : ""}`)
              .join("; ")}`,
      metrics: { checks_passed: passed, checks_total: total },
      details: { output, checks },
    };
  }
}

function getPath(obj: unknown, path: string): unknown {
  const segments = path.split(".");
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === undefined || cur === null) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function deepContains(actual: unknown, expected: unknown): boolean {
  if (expected === null || expected === undefined) return actual === expected;
  if (typeof expected !== typeof actual) return false;
  if (typeof expected !== "object") return actual === expected;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every((e) => actual.some((a) => deepContains(a, e)));
  }
  for (const [k, v] of Object.entries(expected as Record<string, unknown>)) {
    if (!deepContains((actual as Record<string, unknown>)[k], v)) return false;
  }
  return true;
}
