// デモモード用のダミーデータ

const BANK_1 = { id: 'demo-bank-1', name: '楽天銀行', balance: 280000, note: null, created_at: '2024-01-01T00:00:00Z' }
const BANK_2 = { id: 'demo-bank-2', name: '三菱UFJ銀行', balance: 430000, note: null, created_at: '2024-01-01T00:00:00Z' }

const CARD_1 = {
  id: 'demo-card-1', name: '楽天カード', bank_account_id: 'demo-bank-1',
  closing_day: 25, billing_day: 3, color: '#e91e63', created_at: '2024-01-01T00:00:00Z',
  bank_accounts: BANK_1,
}
const CARD_2 = {
  id: 'demo-card-2', name: 'PayPayカード', bank_account_id: 'demo-bank-2',
  closing_day: 20, billing_day: 10, color: '#ff6b35', created_at: '2024-01-01T00:00:00Z',
  bank_accounts: BANK_2,
}

const CAT_FOOD     = { id: 'demo-cat-food',      name: '食費',     type: 'expense', budget_limit: 30000, color: '#ef4444', icon: '🍚', created_at: '2024-01-01T00:00:00Z' }
const CAT_EAT      = { id: 'demo-cat-eat',       name: '外食',     type: 'expense', budget_limit: 15000, color: '#f97316', icon: '🍜', created_at: '2024-01-01T00:00:00Z' }
const CAT_TRANSPORT = { id: 'demo-cat-transport', name: '交通費',   type: 'expense', budget_limit: 10000, color: '#3b82f6', icon: '🚃', created_at: '2024-01-01T00:00:00Z' }
const CAT_DAILY    = { id: 'demo-cat-daily',     name: '日用品',   type: 'expense', budget_limit: 10000, color: '#10b981', icon: '🧴', created_at: '2024-01-01T00:00:00Z' }
const CAT_LEISURE  = { id: 'demo-cat-leisure',   name: '娯楽',     type: 'expense', budget_limit: 20000, color: '#8b5cf6', icon: '🎮', created_at: '2024-01-01T00:00:00Z' }
const CAT_CLOTHES  = { id: 'demo-cat-clothes',   name: '衣服',     type: 'expense', budget_limit: 15000, color: '#ec4899', icon: '👕', created_at: '2024-01-01T00:00:00Z' }
const CAT_SUB      = { id: 'demo-cat-sub',       name: 'サブスク', type: 'expense', budget_limit:  5000, color: '#6366f1', icon: '📱', created_at: '2024-01-01T00:00:00Z' }
const CAT_SALARY   = { id: 'demo-cat-salary',    name: '給与',     type: 'income',  budget_limit: null,  color: '#22c55e', icon: '💰', created_at: '2024-01-01T00:00:00Z' }

const DEMO_CATEGORIES = [CAT_FOOD, CAT_EAT, CAT_TRANSPORT, CAT_DAILY, CAT_LEISURE, CAT_CLOTHES, CAT_SUB, CAT_SALARY]

const DEMO_BANK_ACCOUNTS = [BANK_1, BANK_2]

const DEMO_CREDIT_CARDS = [CARD_1, CARD_2]

const DEMO_POINT_BALANCES = [
  { id: 'demo-pt-1', name: '楽天ポイント', balance: 3200, created_at: '2024-01-01T00:00:00Z' },
]

const DEMO_SUBSCRIPTIONS = [
  { id: 'demo-sub-1', name: 'Netflix',       amount: 1490, credit_card_id: 'demo-card-1', category_id: 'demo-cat-sub', billing_day: 10, is_active: true, created_at: '2024-01-01T00:00:00Z', credit_cards: CARD_1 },
  { id: 'demo-sub-2', name: 'Spotify',       amount:  980, credit_card_id: 'demo-card-1', category_id: 'demo-cat-sub', billing_day: 15, is_active: true, created_at: '2024-01-01T00:00:00Z', credit_cards: CARD_1 },
  { id: 'demo-sub-3', name: 'Amazon Prime',  amount:  600, credit_card_id: 'demo-card-2', category_id: 'demo-cat-sub', billing_day:  7, is_active: true, created_at: '2024-01-01T00:00:00Z', credit_cards: CARD_2 },
]

const DEMO_FIXED_COSTS = [
  { id: 'demo-fc-1', name: '家賃',   amount: 68000, bank_account_id: 'demo-bank-1', billing_day: 27, is_active: true, created_at: '2024-01-01T00:00:00Z', bank_accounts: BANK_1 },
  { id: 'demo-fc-2', name: '電気代', amount:  6800, bank_account_id: 'demo-bank-2', billing_day: 28, is_active: true, created_at: '2024-01-01T00:00:00Z', bank_accounts: BANK_2 },
]

// 今月のデモ取引（2026-05想定だがどの月でも同じ内容を返す）
function makeTxns(month: string) {
  return [
    { id: 'demo-txn-13', date: `${month}-13`, amount: 1680, type: 'expense', category_id: 'demo-cat-food',      credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: 'スーパー',           created_at: '2024-01-01T00:00:00Z', categories: CAT_FOOD,      credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-12', date: `${month}-12`, amount: 1290, type: 'expense', category_id: 'demo-cat-daily',     credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: 'ドラッグストア',     created_at: '2024-01-01T00:00:00Z', categories: CAT_DAILY,     credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-11', date: `${month}-11`, amount: 1800, type: 'expense', category_id: 'demo-cat-eat',       credit_card_id: 'demo-card-2', bank_account_id: null, point_balance_id: null, memo: 'ランチ',             created_at: '2024-01-01T00:00:00Z', categories: CAT_EAT,       credit_cards: { name: 'PayPayカード', color: '#ff6b35' } },
    { id: 'demo-txn-10', date: `${month}-10`, amount:  870, type: 'expense', category_id: 'demo-cat-food',      credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: 'コンビニ',           created_at: '2024-01-01T00:00:00Z', categories: CAT_FOOD,      credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-09', date: `${month}-09`, amount: 4200, type: 'expense', category_id: 'demo-cat-clothes',   credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: 'ユニクロ',           created_at: '2024-01-01T00:00:00Z', categories: CAT_CLOTHES,   credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-08', date: `${month}-08`, amount: 3200, type: 'expense', category_id: 'demo-cat-leisure',   credit_card_id: 'demo-card-2', bank_account_id: null, point_balance_id: null, memo: '映画',               created_at: '2024-01-01T00:00:00Z', categories: CAT_LEISURE,   credit_cards: { name: 'PayPayカード', color: '#ff6b35' } },
    { id: 'demo-txn-07b', date: `${month}-07`, amount: 600, type: 'expense', category_id: 'demo-cat-sub',       credit_card_id: 'demo-card-2', bank_account_id: null, point_balance_id: null, memo: 'Amazon Prime',       created_at: '2024-01-01T00:00:00Z', categories: CAT_SUB,       credit_cards: { name: 'PayPayカード', color: '#ff6b35' } },
    { id: 'demo-txn-07a', date: `${month}-07`, amount: 1490, type: 'expense', category_id: 'demo-cat-sub',      credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: 'Netflix',            created_at: '2024-01-01T00:00:00Z', categories: CAT_SUB,       credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-05', date: `${month}-05`, amount: 2480, type: 'expense', category_id: 'demo-cat-food',      credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: 'スーパー',           created_at: '2024-01-01T00:00:00Z', categories: CAT_FOOD,      credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-04', date: `${month}-05`, amount: 1890, type: 'expense', category_id: 'demo-cat-daily',     credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: '日用品まとめ買い',   created_at: '2024-01-01T00:00:00Z', categories: CAT_DAILY,     credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-03', date: `${month}-03`, amount: 2580, type: 'expense', category_id: 'demo-cat-eat',       credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: '焼き肉ランチ',       created_at: '2024-01-01T00:00:00Z', categories: CAT_EAT,       credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-02', date: `${month}-02`, amount:  760, type: 'expense', category_id: 'demo-cat-transport', credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: '交通費',             created_at: '2024-01-01T00:00:00Z', categories: CAT_TRANSPORT, credit_cards: { name: '楽天カード',   color: '#e91e63' } },
    { id: 'demo-txn-01', date: `${month}-01`, amount: 1380, type: 'expense', category_id: 'demo-cat-food',      credit_card_id: 'demo-card-1', bank_account_id: null, point_balance_id: null, memo: 'スーパー',           created_at: '2024-01-01T00:00:00Z', categories: CAT_FOOD,      credit_cards: { name: '楽天カード',   color: '#e91e63' } },
  ]
}

function makeSummary(month: string) {
  return {
    month,
    totalBankBalance: 710000,
    prevMonthProjectedBalance: 731800,
    totalFixedCosts: 74800,
    totalExpectedIncome: 280000,
    totalCardCharges: 24220,
    pendingSubTotal: 980,
    totalPlannedExpenses: 39800,
    totalExpectedExpense: 65000,
    projectedBalance: 872000,
    resaleValue: 19500,
    nisaBalance: 1280000,
    cashAmount: 28500,
    totalAssets: 2200000,
    cardCharges: { 'demo-card-1': 18620, 'demo-card-2': 5600 },
    bankAccounts: DEMO_BANK_ACCOUNTS,
  }
}

const DEMO_EXPECTED_INCOME = [
  { id: 'demo-ei-1', amount: 280000, month: '2026-05', description: '5月給与', bank_account_id: 'demo-bank-2', created_at: '2024-01-01T00:00:00Z', bank_accounts: { name: '三菱UFJ銀行' } },
]

const DEMO_PLANNED_EXPENSES = [
  { id: 'demo-pe-1', name: 'AirPods Pro (第3世代)', amount: 39800, month: '2026-05', credit_card_id: 'demo-card-1', is_done: false, created_at: '2024-01-01T00:00:00Z', credit_cards: CARD_1 },
]

const DEMO_WISH_LIST = [
  { id: 'demo-wish-1', name: 'MacBook Pro 14インチ M4', price: 248000, priority: 3, note: 'メインPCの買い替え候補', url: null, is_purchased: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 'demo-wish-2', name: 'ニンテンドースイッチ2',   price:  37980, priority: 2, note: null, url: null, is_purchased: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 'demo-wish-3', name: 'ソニー WH-1000XM5',      price:  39600, priority: 1, note: '在宅ワーク用',         url: null, is_purchased: false, created_at: '2024-01-01T00:00:00Z' },
]

const DEMO_BIG_EXPENSES = [
  { id: 'demo-big-1', name: '旅行（九州）',   amount: 120000, planned_date: '2026-08-10', note: '夏休み旅行', is_done: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 'demo-big-2', name: '自動車保険',     amount:  45000, planned_date: '2026-11-01', note: null,         is_done: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 'demo-big-3', name: '引越し費用（未定）', amount: 200000, planned_date: null,       note: '来年以降',   is_done: false, created_at: '2024-01-01T00:00:00Z' },
]

const DEMO_INVESTMENTS = [
  { id: 'demo-inv-1', name: 'eMAXIS Slim 全世界株式', ticker: '0131319A', shares: 10,  purchase_price: 12000, purchase_date: '2023-04-01', currency: 'JPY', manual_price: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 'demo-inv-2', name: 'Apple Inc.',              ticker: 'AAPL',     shares:  5,  purchase_price:   185, purchase_date: '2024-01-15', currency: 'USD', manual_price: null, created_at: '2024-01-01T00:00:00Z' },
]

const DEMO_NISA = { id: 'demo-nisa-1', current_balance: 1280000, monthly_contribution: 100000, updated_at: '2026-05-01T00:00:00Z' }

const DEMO_CASH = { id: 'demo-cash-1', amount: 28500, updated_at: '2026-05-10T00:00:00Z' }

const DEMO_RESALE_ITEMS = [
  { id: 'demo-resale-1', name: 'Nintendo Switch Lite (コーラル)', quantity: 1, purchase_price: 12000, sell_price: 16000, status: 'holding', platform: null,       note: '箱なし美品', sold_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 'demo-resale-2', name: '龍が如く7 外伝',                  quantity: 1, purchase_price:  5000, sell_price:  3500, status: 'listed',  platform: 'メルカリ', note: null,         sold_at: null, created_at: '2024-01-01T00:00:00Z' },
]

const DEMO_CASH_MEMOS = [
  { id: 'demo-cmemo-1', content: '財布 15,000円', created_at: '2026-05-10T00:00:00Z' },
  { id: 'demo-cmemo-2', content: '小銭 3,500円',  created_at: '2026-05-10T00:00:00Z' },
]

// デモ用の株価
const DEMO_PRICES: Record<string, { ticker: string; price: number; currency: string; name: string }> = {
  '0131319A': { ticker: '0131319A', price: 18540, currency: 'JPY', name: 'eMAXIS Slim全世界株式' },
  'AAPL':     { ticker: 'AAPL',     price: 213.5, currency: 'USD', name: 'Apple Inc.' },
}

export function getDemoResponse(url: string): unknown {
  // URLオブジェクトを解析（相対URLのためダミーオリジンを使用）
  const urlObj = new URL(url, 'http://localhost')
  const path = urlObj.pathname
  const month = urlObj.searchParams.get('month') ?? '2026-05'

  if (path === '/api/summary')           return makeSummary(month)
  if (path === '/api/transactions')      return makeTxns(month)
  if (path === '/api/categories')        return DEMO_CATEGORIES
  if (path === '/api/bank-accounts')     return DEMO_BANK_ACCOUNTS
  if (path === '/api/credit-cards')      return DEMO_CREDIT_CARDS
  if (path === '/api/point-balances')    return DEMO_POINT_BALANCES
  if (path === '/api/subscriptions')     return DEMO_SUBSCRIPTIONS
  if (path === '/api/fixed-costs')       return DEMO_FIXED_COSTS
  if (path === '/api/expected-income')   return DEMO_EXPECTED_INCOME
  if (path === '/api/planned-expenses')  return DEMO_PLANNED_EXPENSES
  if (path === '/api/wish-list')         return DEMO_WISH_LIST
  if (path === '/api/big-expenses')      return DEMO_BIG_EXPENSES
  if (path === '/api/investments')       return DEMO_INVESTMENTS
  if (path === '/api/nisa')              return DEMO_NISA
  if (path === '/api/cash')              return DEMO_CASH
  if (path === '/api/resale-items')      return DEMO_RESALE_ITEMS
  if (path === '/api/cash-memos')        return DEMO_CASH_MEMOS
  if (path === '/api/calendar-memos')    return []
  if (path === '/api/point-redemptions') return []
  if (path === '/api/card-monthly-overrides') return []
  if (path === '/api/prices') {
    const ticker = urlObj.searchParams.get('ticker') ?? ''
    return DEMO_PRICES[ticker] ?? { ticker, price: 1000, currency: 'JPY', name: ticker }
  }

  // 未定義のエンドポイントはnullを返す（実際のAPIに通す）
  return null
}
