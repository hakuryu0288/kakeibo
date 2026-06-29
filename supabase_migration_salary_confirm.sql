-- 見込み給料テーブルへのカラム追加
-- Supabaseダッシュボードの SQL Editor で実行してください

ALTER TABLE expected_income
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

ALTER TABLE expected_income
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE expected_income
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
