-- 月次処理履歴テーブル
-- Supabaseダッシュボードの SQL Editor で実行してください

CREATE TABLE monthly_closings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  snapshot JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
