-- ============================================
-- 003: api_keys に label カラムを追加
-- Add a human-readable label column to api_keys
-- Menambahkan kolom label yang dapat dibaca ke api_keys
-- ============================================
-- 目的 / Purpose / Tujuan:
--   ダッシュボード上で API キーを識別するため
--   （例: "production-server", "ci-runner", "local-dev"）。
--   既存行の値は NULL のまま許容し、新規作成時にフロントで指定する運用。

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN public.api_keys.label IS
  'ユーザー表示用の識別ラベル / Human-readable label for UI / Label yang mudah dibaca untuk UI';
