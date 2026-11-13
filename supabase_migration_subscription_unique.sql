-- サブスクの自動登録が、同じ月に二重に登録されないようにする（任意）
-- アプリを開いたときと毎日の定時実行が同時に動いても、同じサブスク・同じ日付の取引は1件だけになる
-- Supabaseダッシュボードの SQL Editor で実行してください

CREATE UNIQUE INDEX IF NOT EXISTS transactions_subscription_date_unique
  ON transactions (subscription_id, date)
  WHERE subscription_id IS NOT NULL;
