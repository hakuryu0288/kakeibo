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

export type Transaction = {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense'
  category_id: string | null
  memo: string | null
  created_at: string
  categories?: Category
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
