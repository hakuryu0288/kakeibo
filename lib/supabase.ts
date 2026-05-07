import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase環境変数が設定されていません。.env.localを確認してください。')
    _client = createClient(url, key)
  }
  return _client
}

// 後方互換のためのProxy（実際の呼び出しまで初期化しない）
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop]
  },
})

export type Category = {
  id: string
  name: string
  type: 'income' | 'expense'
  budget_limit: number | null
  color: string
  icon: string
  created_at: string
}

export type PointBalance = {
  id: string
  name: string
  balance: number
  created_at: string
}

export type Transaction = {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense'
  category_id: string | null
  credit_card_id: string | null
  bank_account_id: string | null
  point_balance_id: string | null
  subscription_id?: string | null
  memo: string | null
  created_at: string
  categories?: Category
  credit_cards?: CreditCard
  bank_accounts?: BankAccount
  point_balances?: PointBalance
}

export type Investment = {
  id: string
  name: string
  ticker: string
  shares: number
  purchase_price: number
  purchase_date: string | null
  currency: string
  manual_price: number | null
  created_at: string
}

export type BankAccount = {
  id: string
  name: string
  balance: number
  note: string | null
  created_at: string
}

export type CreditCard = {
  id: string
  name: string
  bank_account_id: string | null
  closing_day: number
  billing_day: number
  color: string
  created_at: string
  bank_accounts?: BankAccount
}

export type Subscription = {
  id: string
  name: string
  amount: number
  credit_card_id: string | null
  category_id: string | null
  billing_day: number
  is_active: boolean
  created_at: string
  credit_cards?: CreditCard
}

export type PointRedemption = {
  id: string
  credit_card_id: string
  amount: number
  apply_month: string
  note: string | null
  created_at: string
}

export type FixedCost = {
  id: string
  name: string
  amount: number
  bank_account_id: string | null
  billing_day: number
  is_active: boolean
  created_at: string
  bank_accounts?: BankAccount
}

export type ExpectedIncome = {
  id: string
  amount: number
  month: string
  description: string | null
  bank_account_id: string | null
  created_at: string
  bank_accounts?: { name: string }
}

export type PlannedExpense = {
  id: string
  name: string
  amount: number
  month: string
  credit_card_id: string | null
  is_done: boolean
  created_at: string
  credit_cards?: CreditCard
}

export type WishItem = {
  id: string
  name: string
  price: number | null
  priority: number
  note: string | null
  url: string | null
  is_purchased: boolean
  created_at: string
}

export type BigExpense = {
  id: string
  name: string
  amount: number
  planned_date: string | null
  note: string | null
  is_done: boolean
  created_at: string
}

export type ResaleItem = {
  id: string
  name: string
  quantity: number
  purchase_price: number
  sell_price: number | null
  status: 'holding' | 'listed' | 'sold'
  platform: string | null
  note: string | null
  sold_at: string | null
  created_at: string
}

export type NisaSettings = {
  id: string
  current_balance: number
  monthly_contribution: number
  updated_at: string
}

export type CashBalance = {
  id: string
  amount: number
  updated_at: string
}

export type CashMemo = {
  id: string
  content: string
  created_at: string
}

export type CardMonthlyOverride = {
  id: string
  credit_card_id: string
  month: string
  override_amount: number
  created_at: string
}

export type CalendarMemo = {
  id: string
  date: string
  memo: string | null
  amount: number
  created_at: string
}
