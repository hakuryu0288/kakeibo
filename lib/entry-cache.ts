// 収支入力に使う選択肢（カテゴリ・カード・口座）と初期値を、この端末に覚えておく。
// 次に開いたとき、サーバーからの読み込みを待たずにすぐ初期値を入れるため。
// 読み込みが終わったら最新の内容で上書きする。
import type { BankAccount, Category, CreditCard } from '@/lib/supabase'
import { normalizeDefaults, type InputDefaults } from '@/lib/input-defaults'

export type EntryCache = {
  categories: Category[]
  cards: CreditCard[]
  accounts: BankAccount[]
  defaults: InputDefaults
}

// デモモードの内容が実データの画面に混ざらないよう、キーを分ける
function key(): string {
  return localStorage.getItem('kakeibo_auth') === 'demo' ? 'kakeibo-entry-cache-demo' : 'kakeibo-entry-cache'
}

export function loadEntryCache(): EntryCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key())
    if (!raw) return null
    const c = JSON.parse(raw)
    return {
      categories: Array.isArray(c.categories) ? c.categories : [],
      cards: Array.isArray(c.cards) ? c.cards : [],
      accounts: Array.isArray(c.accounts) ? c.accounts : [],
      defaults: normalizeDefaults(c.defaults),
    }
  } catch {
    return null
  }
}

export function saveEntryCache(patch: Partial<EntryCache>) {
  try {
    const cur = loadEntryCache()
    localStorage.setItem(key(), JSON.stringify({ ...cur, ...patch }))
  } catch {
    // 保存できなくても動作には影響しない
  }
}
