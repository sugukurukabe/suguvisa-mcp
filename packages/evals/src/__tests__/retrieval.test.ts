import { describe, expect, it, beforeAll } from "vitest";
import {
  DeterministicEmbeddingProvider,
  GLOBAL_TENANT_ID,
  HybridRetriever,
  InMemoryGoldenRecordStore,
} from "@suguvisa/golden-records";
import { RetrievalEvaluator, mrrScore, ndcgScore } from "../evaluators/retrieval.js";
import { runEvaluator } from "../runner.js";
import { parseJsonl } from "../dataset.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET = path.resolve(__dirname, "../../../../evals/datasets/retrieval-basic.jsonl");

describe("mrr / ndcg helpers", () => {
  it("MRR = 1 when first item is relevant", () => {
    expect(mrrScore(["a", "b", "c"], new Set(["a"]))).toBe(1);
  });
  it("MRR = 1/3 when third is relevant", () => {
    expect(mrrScore(["a", "b", "c"], new Set(["c"]))).toBeCloseTo(1 / 3, 5);
  });
  it("NDCG = 1 for identical ranking", () => {
    expect(ndcgScore(["a", "b", "c"], ["a", "b", "c"], 3)).toBe(1);
  });
});

describe("RetrievalEvaluator", () => {
  let retriever: HybridRetriever;

  beforeAll(async () => {
    const store = new InMemoryGoldenRecordStore();
    const embeddings = new DeterministicEmbeddingProvider(64);
    const records = [
      {
        id: "rec-ssw1-exemption",
        type: "visa_rule" as const,
        title: "特定技能1号 技能試験免除",
        summary: "技能実習2号を良好に修了した場合は技能試験と日本語試験が免除される",
        content:
          "技能実習2号を良好に修了した場合は、特定技能1号への移行時に技能試験と日本語試験が免除される。",
      },
      {
        id: "rec-notification-14day",
        type: "visa_rule" as const,
        title: "随時届出の14日ルール",
        summary: "在留カード記載事項変更や退職等は14日以内に届出が必要",
        content: "在留カードの紛失・再発行、退職、転職は14日以内に入管に届出が必要。",
      },
      {
        id: "rec-ssw2-field",
        type: "visa_rule" as const,
        title: "特定技能2号 分野要件",
        summary: "2号は分野によって監督経験が必要",
        content: "特定技能2号は分野ごとに監督経験・試験合格等の要件がある。",
      },
      {
        id: "rec-annual-report",
        type: "visa_rule" as const,
        title: "定期届出",
        summary: "毎年4月1日〜5月31日に提出",
        content: "定期届出は毎年4月1日から5月31日の間に提出する必要がある。",
      },
      {
        id: "rec-coe-validity",
        type: "visa_rule" as const,
        title: "認定証明書の有効期限",
        summary: "交付日から3ヶ月以内に入国が必要",
        content: "在留資格認定証明書は交付日から3ヶ月以内に入国しないと失効する。",
      },
    ];
    for (const r of records) {
      await store.create({
        tenantId: GLOBAL_TENANT_ID,
        id: r.id,
        type: r.type,
        title: r.title,
        summary: r.summary,
        content: r.content,
        source: { name: "test" },
        citations: [],
        validFrom: "2020-01-01T00:00:00.000Z",
        validUntil: null,
        metadata: {},
      });
    }
    retriever = new HybridRetriever({ store, embeddings });
  });

  it("evaluates a single case", async () => {
    const ev = new RetrievalEvaluator({ retriever, k: 3 });
    const res = await ev.evaluate({
      id: "t",
      input: { query: "在留カード 紛失 届出" },
      expected: { relevantIds: ["rec-notification-14day"] },
    });
    expect(res.score).toBe(1);
    expect(res.metrics?.mrr).toBeGreaterThan(0);
  });

  it("runs dataset and reaches acceptable hit rate", async () => {
    const cases = parseJsonl(fs.readFileSync(DATASET, "utf-8"));
    const ev = new RetrievalEvaluator({ retriever, k: 3 });
    const summary = await runEvaluator(
      ev,
      cases as Parameters<typeof ev.evaluate>[0][],
    );
    // ベースライン: 5 件中 4 件以上ヒットすれば OK (後に上げる)
    expect(summary.passed).toBeGreaterThanOrEqual(4);
    expect(summary.meanScore).toBeGreaterThan(0.6);
  });
});
