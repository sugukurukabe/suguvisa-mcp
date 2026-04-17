/**
 * Schema Conformance 評価器 — 出力が期待される zod スキーマに準拠しているか
 * を検証する。ツールの structured output やプロンプトの JSON 応答品質を測る。
 *
 * Input:    { output: unknown }
 * Expected: { schemaKey: string } — evaluator に事前に登録したスキーマ名を参照
 */
import type { z } from "zod";
import type { EvalCase, EvalResult, Evaluator } from "../types.js";

export interface SchemaInput {
  output: unknown;
}

export interface SchemaExpected {
  schemaKey: string;
}

export interface SchemaEvaluatorOptions {
  schemas: Record<string, z.ZodTypeAny>;
  threshold?: number;
  name?: string;
}

export class SchemaConformanceEvaluator
  implements Evaluator<SchemaInput, SchemaExpected>
{
  readonly name: string;
  readonly description = "Validate output against a named zod schema";
  readonly threshold: number;
  private readonly schemas: Record<string, z.ZodTypeAny>;

  constructor(options: SchemaEvaluatorOptions) {
    this.schemas = options.schemas;
    this.threshold = options.threshold ?? 1.0;
    this.name = options.name ?? "schema";
  }

  async evaluate(
    c: EvalCase<SchemaInput, SchemaExpected>,
  ): Promise<EvalResult> {
    if (!c.expected) {
      return { score: 0, passed: false, message: "expected.schemaKey missing" };
    }
    const schema = this.schemas[c.expected.schemaKey];
    if (!schema) {
      return {
        score: 0,
        passed: false,
        message: `schema ${c.expected.schemaKey} not registered`,
      };
    }
    const parsed = schema.safeParse(c.input.output);
    if (parsed.success) {
      return {
        score: 1,
        passed: true,
        metrics: { conformant: 1 },
      };
    }
    return {
      score: 0,
      passed: false,
      message: parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; "),
      metrics: { conformant: 0 },
      details: { issues: parsed.error.issues },
    };
  }
}
