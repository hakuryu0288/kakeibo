'use client'

import { useEffect, useState } from 'react'
import { Subscription, PlannedExpense, WishItem, BigExpense, CreditCard, FixedCost, BankAccount } from '@/lib/supabase'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PlansPage() {
  const [tab, setTab] = useState<'sub' | 'fixed' | 'planned' | 'wish' | 'big'>('sub')
  const [cards, setCards] = useState<CreditCard[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([])
  const [wishList, setWishList] = useState<WishItem[]>([])
  const [bigExpenses, setBigExpenses] = useState<BigExpense[]>([])
  const [loading, setLoading] = useState(true)
  const month = currentMonth()

  const [subForm, setSubForm] = useState({ name: '', amount: '', credit_card_id: '', billing_day: '1' })
  const [showSubForm, setShowSubForm] = useState(false)
  const [fixedForm, setFixedForm] = useState({ name: '', amount: '', bank_account_id: '', billing_day: '27' })
  const [showFixedForm, setShowFixedForm] = useState(false)
  const [planForm, setPlanForm] = useState({ name: '', amount: '', credit_card_id: '', month })
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [wishForm, setWishForm] = useState({ name: '', price: '', priority: '0', note: '', url: '' })
  const [showWishForm, setShowWishForm] = useState(false)
  const [bigForm, setBigForm] = useState({ name: '', amount: '', planned_date: '', note: '' })
  const [showBigForm, setShowBigForm] = useState(false)

  const fetchAll = () => {
    Promise.all([
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/fixed-costs').then((r) => r.json()),
      fetch(`/api/planned-expenses?month=${month}`).then((r) => r.json()),
      fetch('/api/wish-list').then((r) => r.json()),
      fetch('/api/big-expenses').then((r) => r.json()),
    ]).then(([c, a, s, f, p, w, b]) => {
      setCards(Array.isArray(c) ? c : [])
      setAccounts(Array.isArray(a) ? a : [])
      setSubscriptions(Array.isArray(s) ? s : [])
      setFixedCosts(Array.isArray(f) ? f : [])
      setPlannedExpenses(Array.isArray(p) ? p : [])
      setWishList(Array.isArray(w) ? w : [])
      setBigExpenses(Array.isArray(b) ? b : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchAll() }, [])

  const post = async (url: string, body: object) => { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); fetchAll() }
  const patch = async (url: string, body: object) => { await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); fetchAll() }
  const del = async (url: string, id: string, msg: string) => { if (!confirm(msg)) return; await fetch(`${url}?id=${id}`, { method: 'DELETE' }); fetchAll() }

  const totalSubs = subscriptions.filter((s) => s.is_active).reduce((sum, s) => sum + s.amount, 0)
  const totalFixed = fixedCosts.filter((f) => f.is_active).reduce((sum, f) => sum + f.amount, 0)
  const totalPlanned = plannedExpenses.filter((p) => !p.is_done).reduce((sum, p) => sum + p.amount, 0)

  const tabs = [
    { key: 'sub', label: 'サブスク' },
    { key: 'fixed', label: '固定費' },
    { key: 'planned', label: '確定出費' },
    { key: 'wish', label: '欲しい' },
    { key: 'big', label: '大型' },
  ] as const

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">計画・予定</h1>

      {/* スクロール可能なタブ */}
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
              {subscriptions.map((s) => (
                <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-slate-400">毎月{s.billing_day}日　{s.credit_cards?.name ?? 'カードなし'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{yen(s.amount)}</span>
                    <button onClick={() => patch('/api/subscriptions', { id: s.id, is_active: !s.is_active })}
                      className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {s.is_active ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => del('/api/subscriptions', s.id, 'このサブスクを削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                  </div>
                </div>
              ))}
              {showSubForm ? (
                <form onSubmit={async (e) => { e.preventDefault(); await post('/api/subscriptions', { name: subForm.name, amount: parseInt(subForm.amount), credit_card_id: subForm.credit_card_id || null, billing_day: parseInt(subForm.billing_day) }); setSubForm({ name: '', amount: '', credit_card_id: '', billing_day: '1' }); setShowSubForm(false) }} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
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
              {fixedCosts.map((f) => (
                <div key={f.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-slate-400">
                      毎月{f.billing_day}日　{f.bank_accounts?.name ?? '口座未設定'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{yen(f.amount)}</span>
                    <button onClick={() => patch('/api/fixed-costs', { id: f.id, is_active: !f.is_active })}
                      className={`text-xs px-2 py-0.5 rounded-full ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {f.is_active ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => del('/api/fixed-costs', f.id, 'この固定費を削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                  </div>
                </div>
              ))}
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
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-red-600">今月の確定出費合計</p>
                <p className="text-xl font-bold text-red-700">{yen(totalPlanned)}</p>
              </div>
              {plannedExpenses.map((p) => (
                <div key={p.id} className={`bg-white rounded-xl p-3 shadow-sm flex justify-between items-center ${p.is_done ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.credit_cards?.name ?? 'カードなし'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{yen(p.amount)}</span>
                    <button onClick={() => patch('/api/planned-expenses', { id: p.id, is_done: !p.is_done })}
                      className={`text-xs px-2 py-0.5 rounded-full ${p.is_done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.is_done ? '完了' : '未済'}
                    </button>
                    <button onClick={() => del('/api/planned-expenses', p.id, '削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                  </div>
                </div>
              ))}
              {showPlanForm ? (
                <form onSubmit={async (e) => { e.preventDefault(); await post('/api/planned-expenses', { name: planForm.name, amount: parseInt(planForm.amount), credit_card_id: planForm.credit_card_id || null, month: planForm.month }); setPlanForm({ name: '', amount: '', credit_card_id: '', month }); setShowPlanForm(false) }} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
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
              {wishList.map((w) => (
                <div key={w.id} className={`bg-white rounded-xl p-3 shadow-sm flex justify-between items-start ${w.is_purchased ? 'opacity-50' : ''}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium">{w.name}</p>
                      {Array.from({ length: w.priority }).map((_, i) => <span key={i} className="text-yellow-400 text-xs">★</span>)}
                    </div>
                    {w.price && <p className="text-xs text-slate-500">{yen(w.price)}</p>}
                    {w.note && <p className="text-xs text-slate-400">{w.note}</p>}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => patch('/api/wish-list', { id: w.id, is_purchased: !w.is_purchased })}
                      className={`text-xs px-2 py-0.5 rounded-full ${w.is_purchased ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {w.is_purchased ? '購入済' : '未購入'}
                    </button>
                    <button onClick={() => del('/api/wish-list', w.id, '削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                  </div>
                </div>
              ))}
              {showWishForm ? (
                <form onSubmit={async (e) => { e.preventDefault(); await post('/api/wish-list', { name: wishForm.name, price: wishForm.price ? parseInt(wishForm.price) : null, priority: parseInt(wishForm.priority), note: wishForm.note || null, url: wishForm.url || null }); setWishForm({ name: '', price: '', priority: '0', note: '', url: '' }); setShowWishForm(false) }} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
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
              {bigExpenses.map((b) => (
                <div key={b.id} className={`bg-white rounded-xl p-3 shadow-sm flex justify-between items-start ${b.is_done ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    {b.planned_date && <p className="text-xs text-slate-400">予定日: {b.planned_date}</p>}
                    {b.note && <p className="text-xs text-slate-400">{b.note}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{yen(b.amount)}</span>
                    <button onClick={() => patch('/api/big-expenses', { id: b.id, is_done: !b.is_done })}
                      className={`text-xs px-2 py-0.5 rounded-full ${b.is_done ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {b.is_done ? '完了' : '未済'}
                    </button>
                    <button onClick={() => del('/api/big-expenses', b.id, '削除しますか？')} className="text-slate-300 hover:text-red-400">×</button>
                  </div>
                </div>
              ))}
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
