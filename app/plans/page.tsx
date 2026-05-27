'use client'

import { useEffect, useState } from 'react'
import { Subscription, PlannedExpense, WishItem, BigExpense, CreditCard, FixedCost, BankAccount, Transaction, Category } from '@/lib/supabase'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function nextMonthOf(m: string) {
  const d = new Date(`${m}-01`)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PlansPage() {
  const [tab, setTab] = useState<'planned' | 'wish' | 'big' | 'sub' | 'fixed'>('planned')
  const [cards, setCards] = useState<CreditCard[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([])
  const [nextMonthPlanned, setNextMonthPlanned] = useState<PlannedExpense[]>([])
  const [wishList, setWishList] = useState<WishItem[]>([])
  const [bigExpenses, setBigExpenses] = useState<BigExpense[]>([])
  const [appliedSubIds, setAppliedSubIds] = useState<Set<string>>(new Set())
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const month = currentMonth()
  const nextMonth = nextMonthOf(month)
  const [, mon] = month.split('-')
  const [, nextMon] = nextMonth.split('-')
  const todayDay = new Date().getDate()

  // フォーム状態
  const [subForm, setSubForm] = useState({ name: '', amount: '', credit_card_id: '', billing_day: '1', category_id: '' })
  const [showSubForm, setShowSubForm] = useState(false)
  const [fixedForm, setFixedForm] = useState({ name: '', amount: '', bank_account_id: '', billing_day: '27' })
  const [showFixedForm, setShowFixedForm] = useState(false)
  const [planForm, setPlanForm] = useState({ name: '', amount: '', credit_card_id: '', month, note: '' })
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [wishForm, setWishForm] = useState({ name: '', price: '', priority: '0', note: '', url: '', planned_month: '' })
  const [showWishForm, setShowWishForm] = useState(false)
  const [bigForm, setBigForm] = useState({ name: '', amount: '', planned_date: '', note: '' })
  const [showBigForm, setShowBigForm] = useState(false)

  // インライン編集状態
  const [editPlanned, setEditPlanned] = useState<{ id: string; name: string; amount: string; credit_card_id: string; note: string } | null>(null)
  const [editWish, setEditWish] = useState<{ id: string; name: string; price: string; note: string; priority: string; planned_month: string } | null>(null)
  const [editBig, setEditBig] = useState<{ id: string; name: string; amount: string; planned_date: string; note: string } | null>(null)
  const [editSub, setEditSub] = useState<{ id: string; name: string; amount: string; billing_day: string; credit_card_id: string } | null>(null)
  const [editFixed, setEditFixed] = useState<{ id: string; name: string; amount: string; billing_day: string; bank_account_id: string } | null>(null)

  // 欲しい → 確定出費 移動フォーム
  const [moveWishId, setMoveWishId] = useState<string | null>(null)
  const [moveForm, setMoveForm] = useState({ amount: '', month: currentMonth(), credit_card_id: '' })

  // 確定出費 → 取引 登録フォーム
  const [registerPlannedId, setRegisterPlannedId] = useState<string | null>(null)
  const [registerDate, setRegisterDate] = useState(today())
  const [registerCardId, setRegisterCardId] = useState('')

  const fetchAll = () => {
    Promise.all([
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/fixed-costs').then((r) => r.json()),
      fetch(`/api/planned-expenses?month=${month}`).then((r) => r.json()),
      fetch(`/api/planned-expenses?month=${nextMonth}`).then((r) => r.json()),
      fetch('/api/wish-list').then((r) => r.json()),
      fetch('/api/big-expenses').then((r) => r.json()),
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([c, a, s, f, p, pn, w, b, txns, cats]) => {
      setCards(Array.isArray(c) ? c : [])
      setAccounts(Array.isArray(a) ? a : [])
      setSubscriptions(Array.isArray(s) ? s : [])
      setFixedCosts(Array.isArray(f) ? f : [])
      setPlannedExpenses(Array.isArray(p) ? p : [])
      setNextMonthPlanned(Array.isArray(pn) ? pn : [])
      setWishList(Array.isArray(w) ? w : [])
      setBigExpenses(Array.isArray(b) ? b : [])
      setCategories(Array.isArray(cats) ? cats : [])
      const applied = new Set<string>(
        (Array.isArray(txns) ? txns : [])
          .filter((t: Transaction) => t.subscription_id)
          .map((t: Transaction) => t.subscription_id as string)
      )
      setAppliedSubIds(applied)
      setLoading(false)
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch('/api/subscriptions/auto-apply', { method: 'POST' })
      .catch(() => {})
      .finally(() => fetchAll())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const post = async (url: string, body: object) => { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); fetchAll() }
  const patch = async (url: string, body: object) => { await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); fetchAll() }
  const del = async (url: string, id: string, msg: string) => { if (!confirm(msg)) return; await fetch(`${url}?id=${id}`, { method: 'DELETE' }); fetchAll() }

  // 欲しい → 確定出費へ移動
  const handleMoveToPlanned = async (wishId: string) => {
    const wish = wishList.find((w) => w.id === wishId)
    if (!wish) return
    await fetch('/api/planned-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: wish.name,
        amount: parseInt(moveForm.amount),
        month: moveForm.month || currentMonth(),
        credit_card_id: moveForm.credit_card_id || null,
        note: wish.note || null,
      }),
    })
    await fetch(`/api/wish-list?id=${wishId}`, { method: 'DELETE' })
    setMoveWishId(null)
    fetchAll()
  }

  // 確定出費 → 取引として登録
  const handleRegisterTransaction = async (plannedId: string) => {
    const planned = [...plannedExpenses, ...nextMonthPlanned].find((p) => p.id === plannedId)
    if (!planned) return
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: registerDate,
        amount: planned.amount,
        type: 'expense',
        credit_card_id: registerCardId || planned.credit_card_id || null,
        memo: planned.name + (planned.note ? `　${planned.note}` : ''),
        category_id: null,
        bank_account_id: null,
        point_balance_id: null,
      }),
    })
    await fetch('/api/planned-expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: plannedId, is_done: true }),
    })
    setRegisterPlannedId(null)
    fetchAll()
  }

  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const totalSubs = subscriptions.filter((s) => s.is_active).reduce((sum, s) => sum + s.amount, 0)
  const totalFixed = fixedCosts.filter((f) => f.is_active).reduce((sum, f) => sum + f.amount, 0)
  const totalPlanned = plannedExpenses.reduce((sum, p) => sum + p.amount, 0)
  const totalNextPlanned = nextMonthPlanned.reduce((sum, p) => sum + p.amount, 0)

  const tabs = [
    { key: 'planned', label: '確定出費' },
    { key: 'wish', label: '欲しい' },
    { key: 'big', label: '大型' },
    { key: 'sub', label: 'サブスク' },
    { key: 'fixed', label: '固定費' },
  ] as const

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">計画・予定</h1>

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-slate-400">読み込み中...</div> : (
        <>
          {/* サブスク */}
          {tab === 'sub' && (
            <div className="space-y-3">
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-xs text-indigo-600">月額サブスク合計</p>
                <p className="text-xl font-bold text-indigo-700">{yen(totalSubs)}</p>
              </div>
              <p className="text-xs text-slate-400 text-center">請求日が来ると自動でカード取引に追加されます</p>
              {subscriptions.map((s) => {
                const isPastDay = s.billing_day <= todayDay
                const isApplied = appliedSubIds.has(s.id)
                if (editSub?.id === s.id) {
                  return (
                    <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                      <input type="text" value={editSub.name} onChange={(e) => setEditSub({ ...editSub, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="サービス名" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={editSub.amount} onChange={(e) => setEditSub({ ...editSub, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="月額（円）" />
                        <input type="number" value={editSub.billing_day} min={1} max={31} onChange={(e) => setEditSub({ ...editSub, billing_day: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="請求日" />
                      </div>
                      <select value={editSub.credit_card_id} onChange={(e) => setEditSub({ ...editSub, credit_card_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm">
                        <option value="">クレカ未設定</option>
                        {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => setEditSub(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                        <button onClick={async () => {
                          await patch('/api/subscriptions', { id: editSub.id, name: editSub.name, amount: parseInt(editSub.amount), billing_day: parseInt(editSub.billing_day), credit_card_id: editSub.credit_card_id || null })
                          setEditSub(null)
                        }} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">保存</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-slate-400">毎月{s.billing_day}日　{s.credit_cards?.name ?? 'カードなし'}</p>
                      <select
                        value={s.category_id ?? ''}
                        onChange={(e) => patch('/api/subscriptions', { id: s.id, category_id: e.target.value || null })}
                        className="text-xs border border-slate-100 rounded px-1 py-0.5 bg-slate-50 text-slate-500 mt-1"
                      >
                        <option value="">カテゴリなし</option>
                        {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{yen(s.amount)}</span>
                      {s.credit_card_id && (
                        isPastDay ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${isApplied ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {isApplied ? `${mon}月済` : '未記録'}
                          </span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">
                            {s.billing_day}日予定
                          </span>
                        )
                      )}
                      <button onClick={() => patch('/api/subscriptions', { id: s.id, is_active: !s.is_active })}
                        className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                        {s.is_active ? 'ON' : 'OFF'}
                      </button>
                      <button onClick={() => setEditSub({ id: s.id, name: s.name, amount: String(s.amount), billing_day: String(s.billing_day), credit_card_id: s.credit_card_id ?? '' })} className="text-slate-400 hover:text-indigo-500">✏️</button>
                      <button onClick={() => del('/api/subscriptions', s.id, 'このサブスクを削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                    </div>
                  </div>
                )
              })}
              {showSubForm ? (
                <form onSubmit={async (e) => { e.preventDefault(); await post('/api/subscriptions', { name: subForm.name, amount: parseInt(subForm.amount), credit_card_id: subForm.credit_card_id || null, billing_day: parseInt(subForm.billing_day), category_id: subForm.category_id || null }); setSubForm({ name: '', amount: '', credit_card_id: '', billing_day: '1', category_id: '' }); setShowSubForm(false) }} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">サブスクを追加</h2>
                  <input type="text" placeholder="サービス名（例：Netflix）" value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="月額（円）" value={subForm.amount} onChange={(e) => setSubForm({ ...subForm, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="number" placeholder="請求日" value={subForm.billing_day} min={1} max={31} onChange={(e) => setSubForm({ ...subForm, billing_day: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                  </div>
                  <select value={subForm.credit_card_id} onChange={(e) => setSubForm({ ...subForm, credit_card_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm">
                    <option value="">クレカ未設定</option>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={subForm.category_id} onChange={(e) => setSubForm({ ...subForm, category_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm">
                    <option value="">カテゴリなし</option>
                    {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowSubForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">追加</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowSubForm(true)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ サブスクを追加</button>
              )}
            </div>
          )}

          {/* 固定費 */}
          {tab === 'fixed' && (
            <div className="space-y-3">
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-xs text-orange-600">月額固定費合計（口座引き落とし）</p>
                <p className="text-xl font-bold text-orange-700">{yen(totalFixed)}</p>
              </div>
              {fixedCosts.map((f) => {
                if (editFixed?.id === f.id) {
                  return (
                    <div key={f.id} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                      <input type="text" value={editFixed.name} onChange={(e) => setEditFixed({ ...editFixed, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="項目名" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={editFixed.amount} onChange={(e) => setEditFixed({ ...editFixed, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="金額（円）" />
                        <input type="number" value={editFixed.billing_day} min={1} max={31} onChange={(e) => setEditFixed({ ...editFixed, billing_day: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="引き落とし日" />
                      </div>
                      <select value={editFixed.bank_account_id} onChange={(e) => setEditFixed({ ...editFixed, bank_account_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm">
                        <option value="">口座未設定</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => setEditFixed(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                        <button onClick={async () => {
                          await patch('/api/fixed-costs', { id: editFixed.id, name: editFixed.name, amount: parseInt(editFixed.amount), billing_day: parseInt(editFixed.billing_day), bank_account_id: editFixed.bank_account_id || null })
                          setEditFixed(null)
                        }} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">保存</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={f.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-slate-400">毎月{f.billing_day}日　{f.bank_accounts?.name ?? '口座未設定'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{yen(f.amount)}</span>
                      <button onClick={() => patch('/api/fixed-costs', { id: f.id, is_active: !f.is_active })}
                        className={`text-xs px-2 py-0.5 rounded-full ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                        {f.is_active ? 'ON' : 'OFF'}
                      </button>
                      <button onClick={() => setEditFixed({ id: f.id, name: f.name, amount: String(f.amount), billing_day: String(f.billing_day), bank_account_id: f.bank_account_id ?? '' })} className="text-slate-400 hover:text-indigo-500">✏️</button>
                      <button onClick={() => del('/api/fixed-costs', f.id, 'この固定費を削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                    </div>
                  </div>
                )
              })}
              {showFixedForm ? (
                <form onSubmit={async (e) => { e.preventDefault(); await post('/api/fixed-costs', { name: fixedForm.name, amount: parseInt(fixedForm.amount), bank_account_id: fixedForm.bank_account_id || null, billing_day: parseInt(fixedForm.billing_day) }); setFixedForm({ name: '', amount: '', bank_account_id: '', billing_day: '27' }); setShowFixedForm(false) }} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">固定費を追加</h2>
                  <input type="text" placeholder="項目名（例：携帯代）" value={fixedForm.name} onChange={(e) => setFixedForm({ ...fixedForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="月額（円）" value={fixedForm.amount} onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="number" placeholder="引き落とし日" value={fixedForm.billing_day} min={1} max={31} onChange={(e) => setFixedForm({ ...fixedForm, billing_day: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                  </div>
                  <select value={fixedForm.bank_account_id} onChange={(e) => setFixedForm({ ...fixedForm, bank_account_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm">
                    <option value="">口座を選択</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowFixedForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">追加</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowFixedForm(true)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 固定費を追加</button>
              )}
            </div>
          )}

          {/* 確定出費 */}
          {tab === 'planned' && (
            <div className="space-y-3">
              <div className="bg-red-50 rounded-xl p-3 flex justify-between items-center">
                <p className="text-xs text-red-600 font-medium">今月（{mon}月）の確定出費</p>
                <p className="text-base font-bold text-red-700">{yen(totalPlanned)}</p>
              </div>
              {plannedExpenses.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">今月の確定出費なし</p>
              )}
              {plannedExpenses.map((p) => {
                if (editPlanned?.id === p.id) {
                  return (
                    <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                      <input type="text" value={editPlanned.name} onChange={(e) => setEditPlanned({ ...editPlanned, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="項目名" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={editPlanned.amount} onChange={(e) => setEditPlanned({ ...editPlanned, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="金額（円）" />
                        <select value={editPlanned.credit_card_id} onChange={(e) => setEditPlanned({ ...editPlanned, credit_card_id: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm">
                          <option value="">クレカなし</option>
                          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <input type="text" value={editPlanned.note} onChange={(e) => setEditPlanned({ ...editPlanned, note: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="備考（任意）" />
                      <div className="flex gap-2">
                        <button onClick={() => setEditPlanned(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                        <button onClick={async () => {
                          await patch('/api/planned-expenses', { id: editPlanned.id, name: editPlanned.name, amount: parseInt(editPlanned.amount), credit_card_id: editPlanned.credit_card_id || null, note: editPlanned.note || null })
                          setEditPlanned(null)
                        }} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">保存</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.credit_cards?.name ?? 'カードなし'}</p>
                        {p.note && <p className="text-xs text-slate-400 mt-0.5">📝 {p.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{yen(p.amount)}</span>
                        <button onClick={() => setEditPlanned({ id: p.id, name: p.name, amount: String(p.amount), credit_card_id: p.credit_card_id ?? '', note: p.note ?? '' })} className="text-slate-400 hover:text-indigo-500">✏️</button>
                        <button onClick={() => del('/api/planned-expenses', p.id, '削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                      </div>
                    </div>
                    {/* 取引として登録 */}
                    {registerPlannedId === p.id ? (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50 space-y-2">
                        <p className="text-xs font-semibold text-slate-500">カード取引として登録</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-slate-400">日付</label>
                            <input type="date" value={registerDate} onChange={(e) => setRegisterDate(e.target.value)} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs mt-0.5 bg-white" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">カード</label>
                            <select value={registerCardId || p.credit_card_id || ''} onChange={(e) => setRegisterCardId(e.target.value)} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs mt-0.5 bg-white">
                              <option value="">カードなし（現金）</option>
                              {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setRegisterPlannedId(null); setRegisterCardId('') }} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">キャンセル</button>
                          <button onClick={() => handleRegisterTransaction(p.id)} className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold">登録して完了にする</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRegisterPlannedId(p.id); setRegisterDate(today()); setRegisterCardId(p.credit_card_id ?? '') }}
                        className="w-full py-1.5 border-t border-slate-100 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        ＋ カード取引に登録して完了にする
                      </button>
                    )}
                  </div>
                )
              })}

              {/* 来月 */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">来月（{nextMon}月）</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="bg-amber-50 rounded-xl p-3 flex justify-between items-center">
                <p className="text-xs text-amber-600 font-medium">来月（{nextMon}月）の確定出費</p>
                <p className="text-base font-bold text-amber-700">{yen(totalNextPlanned)}</p>
              </div>
              {nextMonthPlanned.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">来月の確定出費なし</p>
              )}
              {nextMonthPlanned.map((p) => {
                if (editPlanned?.id === p.id) {
                  return (
                    <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border-l-2 border-amber-300 space-y-2">
                      <input type="text" value={editPlanned.name} onChange={(e) => setEditPlanned({ ...editPlanned, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="項目名" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={editPlanned.amount} onChange={(e) => setEditPlanned({ ...editPlanned, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="金額（円）" />
                        <select value={editPlanned.credit_card_id} onChange={(e) => setEditPlanned({ ...editPlanned, credit_card_id: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm">
                          <option value="">クレカなし</option>
                          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <input type="text" value={editPlanned.note} onChange={(e) => setEditPlanned({ ...editPlanned, note: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="備考（任意）" />
                      <div className="flex gap-2">
                        <button onClick={() => setEditPlanned(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                        <button onClick={async () => {
                          await patch('/api/planned-expenses', { id: editPlanned.id, name: editPlanned.name, amount: parseInt(editPlanned.amount), credit_card_id: editPlanned.credit_card_id || null, note: editPlanned.note || null })
                          setEditPlanned(null)
                        }} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">保存</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden border-l-2 border-amber-300">
                    <div className="p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.credit_cards?.name ?? 'カードなし'} · {nextMon}月</p>
                        {p.note && <p className="text-xs text-slate-400 mt-0.5">📝 {p.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{yen(p.amount)}</span>
                        <button onClick={() => setEditPlanned({ id: p.id, name: p.name, amount: String(p.amount), credit_card_id: p.credit_card_id ?? '', note: p.note ?? '' })} className="text-slate-400 hover:text-indigo-500">✏️</button>
                        <button onClick={() => del('/api/planned-expenses', p.id, '削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                      </div>
                    </div>
                    {registerPlannedId === p.id ? (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50 space-y-2">
                        <p className="text-xs font-semibold text-slate-500">カード取引として登録</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-slate-400">日付</label>
                            <input type="date" value={registerDate} onChange={(e) => setRegisterDate(e.target.value)} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs mt-0.5 bg-white" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">カード</label>
                            <select value={registerCardId || p.credit_card_id || ''} onChange={(e) => setRegisterCardId(e.target.value)} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs mt-0.5 bg-white">
                              <option value="">カードなし（現金）</option>
                              {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setRegisterPlannedId(null); setRegisterCardId('') }} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">キャンセル</button>
                          <button onClick={() => handleRegisterTransaction(p.id)} className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold">登録して完了にする</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRegisterPlannedId(p.id); setRegisterDate(today()); setRegisterCardId(p.credit_card_id ?? '') }}
                        className="w-full py-1.5 border-t border-slate-100 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        ＋ カード取引に登録して完了にする
                      </button>
                    )}
                  </div>
                )
              })}

              {showPlanForm ? (
                <form onSubmit={async (e) => { e.preventDefault(); await post('/api/planned-expenses', { name: planForm.name, amount: parseInt(planForm.amount), credit_card_id: planForm.credit_card_id || null, month: planForm.month, note: planForm.note || null }); setPlanForm({ name: '', amount: '', credit_card_id: '', month, note: '' }); setShowPlanForm(false) }} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">確定出費を追加</h2>
                  <input type="text" placeholder="項目名" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="金額（円）" value={planForm.amount} onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="month" value={planForm.month} onChange={(e) => setPlanForm({ ...planForm, month: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
                  </div>
                  <select value={planForm.credit_card_id} onChange={(e) => setPlanForm({ ...planForm, credit_card_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm">
                    <option value="">クレカ未設定</option>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="text" placeholder="備考（任意）" value={planForm.note} onChange={(e) => setPlanForm({ ...planForm, note: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowPlanForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">追加</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowPlanForm(true)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 確定出費を追加</button>
              )}
            </div>
          )}

          {/* 欲しいものリスト */}
          {tab === 'wish' && (
            <div className="space-y-3">
              {wishList.map((w) => {
                if (editWish?.id === w.id) {
                  return (
                    <div key={w.id} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                      <input type="text" value={editWish.name} onChange={(e) => setEditWish({ ...editWish, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="商品名" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={editWish.price} onChange={(e) => setEditWish({ ...editWish, price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="価格（円）" />
                        <select value={editWish.priority} onChange={(e) => setEditWish({ ...editWish, priority: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm">
                          <option value="0">優先度なし</option>
                          <option value="1">★ 低</option>
                          <option value="2">★★ 中</option>
                          <option value="3">★★★ 高</option>
                        </select>
                      </div>
                      <input type="month" value={editWish.planned_month} onChange={(e) => setEditWish({ ...editWish, planned_month: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="購入予定月" />
                      <input type="text" value={editWish.note} onChange={(e) => setEditWish({ ...editWish, note: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="メモ（任意）" />
                      <div className="flex gap-2">
                        <button onClick={() => setEditWish(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                        <button onClick={async () => {
                          await patch('/api/wish-list', { id: editWish.id, name: editWish.name, price: editWish.price ? parseInt(editWish.price) : null, priority: parseInt(editWish.priority), note: editWish.note || null, planned_month: editWish.planned_month || null })
                          setEditWish(null)
                        }} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">保存</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={w.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-3 flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium">{w.name}</p>
                          {Array.from({ length: w.priority }).map((_, i) => <span key={i} className="text-yellow-400 text-xs">★</span>)}
                        </div>
                        {w.price && <p className="text-xs text-slate-500">{yen(w.price)}</p>}
                        {w.planned_month && <p className="text-xs text-indigo-500">📅 {w.planned_month.replace('-', '年')}月予定</p>}
                        {w.note && <p className="text-xs text-slate-400">{w.note}</p>}
                      </div>
                      <div className="flex gap-2 items-center">
                        <button onClick={() => setEditWish({ id: w.id, name: w.name, price: w.price ? String(w.price) : '', note: w.note ?? '', priority: String(w.priority), planned_month: w.planned_month ?? '' })} className="text-slate-400 hover:text-indigo-500">✏️</button>
                        <button onClick={() => del('/api/wish-list', w.id, '削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                      </div>
                    </div>
                    {/* 確定出費へ移動 */}
                    {moveWishId === w.id ? (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50 space-y-2">
                        <p className="text-xs font-semibold text-slate-500">確定出費に移動</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-slate-400">金額（円）</label>
                            <input type="number" value={moveForm.amount} onChange={(e) => setMoveForm({ ...moveForm, amount: e.target.value })} placeholder={w.price ? String(w.price) : '0'} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs mt-0.5 bg-white" required />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">出費月</label>
                            <input type="month" value={moveForm.month} onChange={(e) => setMoveForm({ ...moveForm, month: e.target.value })} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs mt-0.5 bg-white" />
                          </div>
                        </div>
                        <select value={moveForm.credit_card_id} onChange={(e) => setMoveForm({ ...moveForm, credit_card_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white">
                          <option value="">クレカ未設定</option>
                          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => setMoveWishId(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">キャンセル</button>
                          <button
                            onClick={() => handleMoveToPlanned(w.id)}
                            disabled={!moveForm.amount}
                            className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                          >確定出費に移動</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setMoveWishId(w.id); setMoveForm({ amount: w.price ? String(w.price) : '', month: w.planned_month || currentMonth(), credit_card_id: '' }) }}
                        className="w-full py-1.5 border-t border-slate-100 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        → 確定出費に移動する
                      </button>
                    )}
                  </div>
                )
              })}
              {showWishForm ? (
                <form onSubmit={async (e) => { e.preventDefault(); await post('/api/wish-list', { name: wishForm.name, price: wishForm.price ? parseInt(wishForm.price) : null, priority: parseInt(wishForm.priority), note: wishForm.note || null, url: wishForm.url || null, planned_month: wishForm.planned_month || null }); setWishForm({ name: '', price: '', priority: '0', note: '', url: '', planned_month: '' }); setShowWishForm(false) }} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">欲しいものを追加</h2>
                  <input type="text" placeholder="商品名" value={wishForm.name} onChange={(e) => setWishForm({ ...wishForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="価格（任意）" value={wishForm.price} onChange={(e) => setWishForm({ ...wishForm, price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
                    <select value={wishForm.priority} onChange={(e) => setWishForm({ ...wishForm, priority: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm">
                      <option value="0">優先度なし</option>
                      <option value="1">★ 低</option>
                      <option value="2">★★ 中</option>
                      <option value="3">★★★ 高</option>
                    </select>
                  </div>
                  <input type="month" placeholder="購入予定月（任意）" value={wishForm.planned_month} onChange={(e) => setWishForm({ ...wishForm, planned_month: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
                  <input type="text" placeholder="メモ（任意）" value={wishForm.note} onChange={(e) => setWishForm({ ...wishForm, note: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowWishForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">追加</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowWishForm(true)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 追加</button>
              )}
            </div>
          )}

          {/* 大型出費 */}
          {tab === 'big' && (
            <div className="space-y-3">
              {bigExpenses.map((b) => {
                if (editBig?.id === b.id) {
                  return (
                    <div key={b.id} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                      <input type="text" value={editBig.name} onChange={(e) => setEditBig({ ...editBig, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="項目名" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={editBig.amount} onChange={(e) => setEditBig({ ...editBig, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" placeholder="金額（円）" />
                        <input type="date" value={editBig.planned_date} onChange={(e) => setEditBig({ ...editBig, planned_date: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
                      </div>
                      <input type="text" value={editBig.note} onChange={(e) => setEditBig({ ...editBig, note: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" placeholder="メモ（任意）" />
                      <div className="flex gap-2">
                        <button onClick={() => setEditBig(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                        <button onClick={async () => {
                          await patch('/api/big-expenses', { id: editBig.id, name: editBig.name, amount: parseInt(editBig.amount), planned_date: editBig.planned_date || null, note: editBig.note || null })
                          setEditBig(null)
                        }} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">保存</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={b.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{b.name}</p>
                      {b.planned_date && <p className="text-xs text-slate-400">予定日: {b.planned_date}</p>}
                      {b.note && <p className="text-xs text-slate-400">{b.note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{yen(b.amount)}</span>
                      <button onClick={() => setEditBig({ id: b.id, name: b.name, amount: String(b.amount), planned_date: b.planned_date ?? '', note: b.note ?? '' })} className="text-slate-400 hover:text-indigo-500">✏️</button>
                      <button onClick={() => del('/api/big-expenses', b.id, '削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                    </div>
                  </div>
                )
              })}
              {showBigForm ? (
                <form onSubmit={async (e) => { e.preventDefault(); await post('/api/big-expenses', { name: bigForm.name, amount: parseInt(bigForm.amount), planned_date: bigForm.planned_date || null, note: bigForm.note || null }); setBigForm({ name: '', amount: '', planned_date: '', note: '' }); setShowBigForm(false) }} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">大型出費を追加</h2>
                  <input type="text" placeholder="項目名" value={bigForm.name} onChange={(e) => setBigForm({ ...bigForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="金額（円）" value={bigForm.amount} onChange={(e) => setBigForm({ ...bigForm, amount: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="date" value={bigForm.planned_date} onChange={(e) => setBigForm({ ...bigForm, planned_date: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
                  </div>
                  <input type="text" placeholder="メモ（任意）" value={bigForm.note} onChange={(e) => setBigForm({ ...bigForm, note: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowBigForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">追加</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowBigForm(true)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 追加</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
