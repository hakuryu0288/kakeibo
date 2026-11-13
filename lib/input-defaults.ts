// 収支入力の初期値（マスタ設定の「入力の初期値」で決める。全端末で共通）
export type InputDefaults = {
  expense_payment: 'card' | 'cash' | 'bank'
  card_id: string | null
  bank_account_id: string | null
  expense_category_id: string | null
  income_destination: 'cash' | 'bank'
  income_bank_account_id: string | null
  income_category_id: string | null
}

export const EMPTY_DEFAULTS: InputDefaults = {
  expense_payment: 'card',
  card_id: null,
  bank_account_id: null,
  expense_category_id: null,
  income_destination: 'cash',
  income_bank_account_id: null,
  income_category_id: null,
}

// 保存されている値を、知っている項目だけ取り出して整える
export function normalizeDefaults(v: unknown): InputDefaults {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const str = (x: unknown) => (typeof x === 'string' && x ? x : null)
  return {
    expense_payment: o.expense_payment === 'cash' || o.expense_payment === 'bank' ? o.expense_payment : 'card',
    card_id: str(o.card_id),
    bank_account_id: str(o.bank_account_id),
    expense_category_id: str(o.expense_category_id),
    income_destination: o.income_destination === 'bank' ? 'bank' : 'cash',
    income_bank_account_id: str(o.income_bank_account_id),
    income_category_id: str(o.income_category_id),
  }
}
