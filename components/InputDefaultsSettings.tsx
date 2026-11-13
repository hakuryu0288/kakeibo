'use client'

import { useEffect, useState } from 'react'
import type { BankAccount, Category, CreditCard } from '@/lib/supabase'
import { EMPTY_DEFAULTS, normalizeDefaults, type InputDefaults } from '@/lib/input-defaults'

// マスタ設定 > 入力の初期値
// 収支を入力するときに、最初から選ばれている支払い方法・カード・カテゴリを決める（全端末共通）
export default function InputDefaultsSettings({ cards, accounts }: { cards: CreditCard[]; accounts: BankAccount[] }) {
  const [d, setD] = useState<InputDefaults>(EMPTY_DEFAULTS)
  const [categories, setCategories] = useState<Category[]>([])
  const [loaded, setLoaded] = useState(false)
  const [missingTable, setMissingTable] = useState(false)
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('')

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.json()).catch(() => null),
      fetch('/api/categories').then((r) => r.json()).catch(() => []),
    ]).then(([st, cats]) => {
      setD(normalizeDefaults(st))
      setMissingTable(!!st?._missing)
      setCategories(Array.isArray(cats) ? cats : [])
      setLoaded(true)
    })
  }, [])

  // 変えたらすぐ保存する
  const update = async (patch: Partial<InputDefaults>) => {
    const next = { ...d, ...patch }
    setD(next)
    setStatus('saving')
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => null)
    setStatus(res && res.ok ? 'saved' : 'error')
  }

  if (!loaded) return <div className="text-center py-8 text-slate-400">読み込み中...</div>

  const select = 'w-full border border-slate-200 rounded-lg p-2 text-sm mt-1 bg-white'
  const seg = (on: boolean) => `flex-1 py-1.5 rounded-lg text-sm border transition-colors ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-500'}`

  return (
    <div className="space-y-3">
      {missingTable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          設定を保存する場所がまだありません。Supabaseの SQL Editor で <code>supabase_migration_app_settings.sql</code> を実行してください。
        </div>
      )}

      <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-red-600">支出の初期値</h2>
        <div>
          <label className="text-xs text-slate-500">支払い方法</label>
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => update({ expense_payment: 'cash' })} className={seg(d.expense_payment === 'cash')}>💴 現金</button>
            <button type="button" onClick={() => update({ expense_payment: 'card' })} className={seg(d.expense_payment === 'card')}>💳 カード</button>
            <button type="button" onClick={() => update({ expense_payment: 'bank' })} className={seg(d.expense_payment === 'bank')}>🏦 銀行</button>
          </div>
        </div>
        {d.expense_payment === 'card' && (
          <div>
            <label className="text-xs text-slate-500">カード</label>
            <select value={d.card_id ?? ''} onChange={(e) => update({ card_id: e.target.value || null })} className={select}>
              <option value="">選ばない</option>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {d.expense_payment === 'bank' && (
          <div>
            <label className="text-xs text-slate-500">口座</label>
            <select value={d.bank_account_id ?? ''} onChange={(e) => update({ bank_account_id: e.target.value || null })} className={select}>
              <option value="">選ばない</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-500">カテゴリ</label>
          <select value={d.expense_category_id ?? ''} onChange={(e) => update({ expense_category_id: e.target.value || null })} className={select}>
            <option value="">カテゴリなし</option>
            {categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-green-600">収入の初期値</h2>
        <div>
          <label className="text-xs text-slate-500">入金先</label>
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => update({ income_destination: 'cash' })} className={seg(d.income_destination === 'cash')}>💴 現金</button>
            <button type="button" onClick={() => update({ income_destination: 'bank' })} className={seg(d.income_destination === 'bank')}>🏦 銀行口座</button>
          </div>
        </div>
        {d.income_destination === 'bank' && (
          <div>
            <label className="text-xs text-slate-500">口座</label>
            <select value={d.income_bank_account_id ?? ''} onChange={(e) => update({ income_bank_account_id: e.target.value || null })} className={select}>
              <option value="">選ばない</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-500">カテゴリ</label>
          <select value={d.income_category_id ?? ''} onChange={(e) => update({ income_category_id: e.target.value || null })} className={select}>
            <option value="">カテゴリなし</option>
            {categories.filter((c) => c.type === 'income').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
      </div>

      <p className={`text-xs text-center ${status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
        {status === 'saving' ? '保存中...'
          : status === 'saved' ? '保存しました。次に収支を入力するときから使われます'
          : status === 'error' ? '保存できませんでした'
          : '変えるとすぐ保存されます（全端末共通）'}
      </p>
    </div>
  )
}
