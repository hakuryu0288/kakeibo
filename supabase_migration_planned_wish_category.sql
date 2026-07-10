-- 確定出費・欲しいものリストへのカテゴリ紐付け追加
-- Supabaseダッシュボードの SQL Editor で実行してください

ALTER TABLE planned_expenses
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE wish_list
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
