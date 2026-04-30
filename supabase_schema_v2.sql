-- 銀行口座
CREATE TABLE bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  balance DECIMAL NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- クレジットカード
CREATE TABLE credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  closing_day INTEGER DEFAULT 15,
  billing_day INTEGER DEFAULT 27,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- transactionsにクレカ紐付けを追加（credit_cardsの後に追加）
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL;

-- サブスク
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  billing_day INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ポイント充当
CREATE TABLE point_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  apply_month TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 固定費（口座から直接引き落とし）
CREATE TABLE fixed_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  billing_day INTEGER DEFAULT 27,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 見込み給料（月別）
CREATE TABLE expected_income (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount INTEGER NOT NULL,
  month TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 確定出費リスト
CREATE TABLE planned_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  month TEXT NOT NULL,
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  is_done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 欲しいものリスト
CREATE TABLE wish_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER,
  priority INTEGER DEFAULT 0,
  note TEXT,
  url TEXT,
  is_purchased BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 大型出費リスト
CREATE TABLE big_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  planned_date DATE,
  note TEXT,
  is_done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 現金残高
CREATE TABLE cash_balance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO cash_balance (amount) VALUES (0);

-- 現金メモ
CREATE TABLE cash_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- カレンダーメモ
CREATE TABLE calendar_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- フリマ商材
CREATE TABLE resale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_price INTEGER NOT NULL,
  sell_price INTEGER,
  status TEXT DEFAULT 'holding' CHECK (status IN ('holding', 'listed', 'sold')),
  platform TEXT,
  note TEXT,
  sold_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NISA設定
CREATE TABLE nisa_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  current_balance DECIMAL NOT NULL DEFAULT 0,
  monthly_contribution INTEGER DEFAULT 30000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO nisa_settings (current_balance, monthly_contribution) VALUES (0, 30000);
