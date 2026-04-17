# 評価パイプライン / Evaluation Pipeline / Pipeline Evaluasi

Promptfoo による継続的 Eval、Golden Records、テストデータセット、バージョン管理されたプロンプトを格納する。

Stores Promptfoo-based continuous evaluation, Golden Records, test datasets, and version-controlled prompts.

Menyimpan evaluasi berkelanjutan berbasis Promptfoo, Golden Records, dataset pengujian, dan prompt yang dikontrol versinya.

## ロードマップ / Roadmap / Peta Jalan

- Phase 2 Task 2.4 で `@suguvisa/evals` パッケージを導入済み。
  設計・使い方は [`docs/evals/README.md`](../docs/evals/README.md) を参照。
- `datasets/` に JSONL 形式の評価ケースを格納する。
- Promptfoo による継続的 Eval は将来的に判定エンジンの一部として検討。
