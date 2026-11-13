import type { Transaction } from '@/lib/supabase'

// レポート・集計で「支出」とは別枠にするNISA積立。
// カテゴリ名に「NISA」が入っている支出（大文字小文字・全角半角は問わない）を対象にする。
// 残高やカードの引き落とし計算では、これまでどおり普通の支出として扱う。
export function isNisaName(name: string | null | undefined): boolean {
  return !!name && name.normalize('NFKC').toUpperCase().includes('NISA')
}

export function isNisaTxn(t: Pick<Transaction, 'type' | 'categories'>): boolean {
  return t.type === 'expense' && isNisaName(t.categories?.name)
}
