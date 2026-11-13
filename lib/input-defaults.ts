// 収支入力の初期値（マスタ設定の「入力の初期値」で決める。全端末で共通）
export type InputDefaults = {
  expense_payment: 'card' | 'cash' | 'bank'
  card_id: string | null
  bank_account_id: string | null
  expense_category_id: string | null
  income_destination: 'cash' | 'bank'
  income_bank_account_id: string | null
  income_category_id: string | null
  // 収支入力のカテゴリ選択に出さないカテゴリ（サブスク専用など）。過去の取引やサブスク設定では使える
  hidden_category_ids: string[]
}

export const EMPTY_DEFAULTS: InputDefaults = {
  expense_payment: 'card',
  card_id: null,
  bank_account_id: null,
  expense_category_id: null,
  income_destination: 'cash',
  income_bank_account_id: null,
  income_category_id: null,
  hidden_category_ids: [],
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
    hidden_category_ids: Array.isArray(o.hidden_category_ids)
      ? o.hidden_category_ids.filter((x): x is string => typeof x === 'string' && !!x)
      : [],
  }
}

// 入力欄に出すカテゴリ（隠したものを除く。ただし今選ばれているものは残す）
export function visibleCategories<T extends { id: string; type: string }>(
  categories: T[], type: string, hiddenIds: string[], keepId?: string | null,
): T[] {
  return categories.filter((c) => c.type === type && (!hiddenIds.includes(c.id) || c.id === keepId))
}
