# GCP / Visa Accuracy Quality Gate / Pemeriksaan Mutu GCP dan Akurasi Visa

## 目的 / Purpose / Tujuan

GPT Apps Store 申請前に、SuguVisa の法令検索、OCR、PII、申請判定、書類生成が「一次情報に基づく下書き支援」として説明できる状態にする。

Before ChatGPT Apps Store submission, ensure SuguVisa legal search, OCR, PII handling, application routing, and document generation can be described as draft assistance grounded in primary sources.

Sebelum pengajuan ke ChatGPT Apps Store, pastikan pencarian hukum, OCR, penanganan PII, penentuan permohonan, dan pembuatan dokumen SuguVisa dapat dijelaskan sebagai bantuan draf berbasis sumber primer.

## 必須環境変数 / Required Environment Variables / Variabel Lingkungan Wajib

| Area | Variables |
| --- | --- |
| GCP project | `GCP_PROJECT_ID` |
| Vertex AI Search | `VERTEX_SEARCH_PROJECT_ID`, `VERTEX_SEARCH_LOCATION`, `VERTEX_SEARCH_DATA_STORE_ID`, `VERTEX_LEGAL_CORPUS_GCS_URI` |
| Vertex AI Gemini | `VERTEX_AI_LOCATION`, `VERTEX_AI_MODEL`, `VERTEX_AI_FLASH_MODEL` |
| Document AI | `DOCUMENT_AI_LOCATION`, `DOCUMENT_AI_ID_PARSER_ID`, `DOCUMENT_AI_OCR_PROCESSOR_ID` |

## Grounding Policy / 根拠付けポリシー / Kebijakan Grounding

- `suguvisa_legal_docs_search` が `source: "vertex_ai_search"` と `grounding_level: "primary_source"` を返した場合だけ、最新法令・様式・期限の根拠として扱う。
- If the tool returns `gemini_knowledge_base` or `builtin_knowledge`, the answer is an unverified fallback and must not be treated as current-law proof.
- Jika hasil berasal dari `gemini_knowledge_base` atau `builtin_knowledge`, jawaban hanya fallback yang belum diverifikasi dan tidak boleh dianggap sebagai bukti hukum terbaru.

## OCR / PII Policy / OCR・PII方針 / Kebijakan OCR dan PII

- 在留カード・パスポート画像は Document AI に送信するが、SuguVisa アプリ側では永続保存しない。
- Structured OCR results must be confirmed by the user before being used for application data.
- Hasil OCR terstruktur harus dikonfirmasi pengguna sebelum digunakan sebagai data permohonan.
- Logs and observability data must use `@suguvisa/core/logger` redaction and must not include raw card numbers, passport numbers, addresses, or full images.

## Opt-in Integration Test / 明示実行の統合テスト / Tes Integrasi Opsional

```bash
RUN_GCP_INTEGRATION_TESTS=1 pnpm --filter @suguvisa/mcp-server-app test:gcp
```

このテストは本物の PII 画像を使わない。Document AI は processor 設定の存在確認まで行い、実画像 OCR はマスキング済み・合成サンプルを用意してから追加する。

The test does not use real PII images. Document AI is checked for processor readiness; real OCR samples should only be added with masked or synthetic images.

Tes ini tidak memakai gambar PII asli. Document AI dicek untuk kesiapan processor; sampel OCR nyata hanya boleh ditambahkan dengan gambar sintetis atau sudah dimasking.

## Manual Cloud Run Audit / Cloud Run 手動監査 / Audit Manual Cloud Run

```bash
gcloud run services describe suguvisa-mcp \
  --region asia-northeast1 \
  --format='json(spec.template.spec.containers[0].env,status.latestReadyRevisionName)'
```

値そのものは共有しない。確認するのは「キーが存在すること」「Secret Manager 参照が使われていること」「Vertex/Search/Document AI の project/location/datastore/processor が同じ本番系に向いていること」。

Do not share secret values. Confirm key presence, Secret Manager references, and that Vertex Search and Document AI IDs point to the intended production project/location.

Jangan bagikan nilai rahasia. Pastikan key ada, memakai Secret Manager, dan ID Vertex Search serta Document AI mengarah ke project/lokasi produksi yang benar.

## Submission Statement / 審査向け説明 / Pernyataan untuk Review

SuguVisa uses Google Cloud Vertex AI Search over a curated GCS legal corpus for primary-source legal grounding. If primary-source search is unavailable, the app marks the result as unverified fallback and instructs the assistant not to make definitive current-law claims. Document AI OCR is used for extraction only; raw images are not persisted by the application, and structured PII requires user confirmation before use in generated drafts.
