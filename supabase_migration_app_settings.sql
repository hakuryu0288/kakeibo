-- アプリの設定（収支入力の初期値など）を保存するテーブル
-- Supabaseダッシュボードの SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ほかのテーブルと同じく、公開用キーでは読み書きできないようにする
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
