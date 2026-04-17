import type { EmbeddingProvider } from "../types.js";

/**
 * Vertex AI text-embedding provider
 * Vertex AI テキスト埋め込みプロバイダ
 * Penyedia embedding teks Vertex AI
 *
 * @google-cloud/aiplatform は optional peer dependency。
 * Cloud Run 実行環境でのみ利用し、ローカルテストでは Deterministic を使う。
 */
export interface VertexEmbeddingOptions {
  projectId: string;
  /** e.g. "asia-northeast1" */
  location: string;
  /** e.g. "text-embedding-004" */
  model?: string;
  /** Default: 768 */
  dimensions?: number;
}

export class VertexEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly #projectId: string;
  readonly #location: string;
  readonly #model: string;
  #clientPromise?: Promise<{
    predict: (request: unknown) => Promise<[unknown]>;
    endpointPath: string;
  }>;

  constructor(opts: VertexEmbeddingOptions) {
    this.#projectId = opts.projectId;
    this.#location = opts.location;
    this.#model = opts.model ?? "text-embedding-004";
    this.dimensions = opts.dimensions ?? 768;
  }

  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedBatch([text]);
    return vec!;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const { predict, endpointPath } = await this.#getClient();
    const instances = texts.map((t) => ({
      structValue: { fields: { content: { stringValue: t } } },
    }));
    const request = {
      endpoint: endpointPath,
      instances,
    };
    const [response] = await predict(request);
    // Response shape: { predictions: [{ structValue: { fields: { embeddings: { structValue: { fields: { values: { listValue: { values: [{ numberValue }] } } } } } } } }] }
    const predictions = (response as { predictions?: Array<unknown> }).predictions ?? [];
    return predictions.map((p) => extractValues(p));
  }

  async #getClient(): Promise<{
    predict: (request: unknown) => Promise<[unknown]>;
    endpointPath: string;
  }> {
    if (!this.#clientPromise) {
      this.#clientPromise = this.#createClient();
    }
    return this.#clientPromise;
  }

  async #createClient(): Promise<{
    predict: (request: unknown) => Promise<[unknown]>;
    endpointPath: string;
  }> {
    // dynamic import で optional peer dep を実行時解決
    const dynImport = new Function("specifier", "return import(specifier);") as (
      s: string,
    ) => Promise<Record<string, unknown>>;
    const mod = (await dynImport("@google-cloud/aiplatform")) as {
      PredictionServiceClient: new (options: { apiEndpoint: string }) => {
        predict: (request: unknown) => Promise<[unknown]>;
      };
    };
    const client = new mod.PredictionServiceClient({
      apiEndpoint: `${this.#location}-aiplatform.googleapis.com`,
    });
    const endpointPath = `projects/${this.#projectId}/locations/${this.#location}/publishers/google/models/${this.#model}`;
    return { predict: (req) => client.predict(req), endpointPath };
  }
}

function extractValues(prediction: unknown): number[] {
  const p = prediction as {
    structValue?: {
      fields?: {
        embeddings?: {
          structValue?: {
            fields?: {
              values?: {
                listValue?: {
                  values?: Array<{ numberValue?: number }>;
                };
              };
            };
          };
        };
      };
    };
  };
  const values = p.structValue?.fields?.embeddings?.structValue?.fields?.values?.listValue?.values ?? [];
  return values.map((v) => v.numberValue ?? 0);
}
