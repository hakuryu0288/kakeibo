-- カテゴリテーブル
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  budget_limit INTEGER,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT '💰',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 収支記録テーブル
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投資銘柄テーブル
CREATE TABLE investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  shares DECIMAL NOT NULL,
  purchase_price DECIMAL NOT NULL,
  purchase_date DATE,
  currency TEXT DEFAULT 'JPY',
  manual_price DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- デフォルトカテゴリ
INSERT INTO categories (name, type, color, icon, budget_limit) VALUES
  ('給与', 'income', '#10b981', '💼', NULL),
  ('副業', 'income', '#3b82f6', '💻', NULL),
  ('その他収入', 'income', '#8b5cf6', '🎁', NULL),
  ('食費', 'expense', '#ef4444', '🍽️', 50000),
  ('住居費', 'expense', '#f97316', '🏠', 80000),
  ('光熱費', 'expense', '#eab308', '⚡', 15000),
  ('通信費', 'expense', '#06b6d4', '📱', 10000),
  ('交通費', 'expense', '#8b5cf6', '🚃', 20000),
  ('娯楽', 'expense', '#ec4899', '🎮', 20000),
  ('医療', 'expense', '#14b8a6', '🏥', 10000),
  ('衣服', 'expense', '#a855f7', '👕', 15000),
  ('投資', 'expense', '#22c55e', '📈', NULL),
  ('その他', 'expense', '#6b7280', '📦', NULL);
