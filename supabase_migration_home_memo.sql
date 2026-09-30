-- ホーム画面のメモ欄（全端末で共有する1件だけのメモ）
-- Supabaseダッシュボードの SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS home_memo (
  id TEXT PRIMARY KEY DEFAULT 'home',
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
