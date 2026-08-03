-- 銀行口座 ⇔ 現金の振替（引き出し・預け入れ）に対応
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'transfer'));

-- withdraw: 銀行→現金（引き出し） / deposit: 現金→銀行（預け入れ）
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_direction TEXT CHECK (transfer_direction IN ('withdraw', 'deposit'));
