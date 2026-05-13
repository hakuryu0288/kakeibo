'use client'

import { useEffect, useState } from 'react'
import { Transaction, Category, CreditCard, BankAccount, PointBalance } from '@/lib/supabase'

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

export default function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [points, setPoints] = useState<PointBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  const [form, setForm] = useState({
    date: today(),
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category_id: '',
    credit_card_id: '',
    bank_account_id: '',
    point_balance_id: '',
    payment: 'card' as 'cash' | 'card' | 'bank' | 'points',
    memo: '',
  })

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/point-balances').then((r) => r.json()),
    ]).then(([txns, cats, cds, accs, pts]) => {
      setTransactions(Array.isArray(txns) ? txns : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setCards(Array.isArray(cds) ? cds : [])
      setAccounts(Array.isArray(accs) ? accs : [])
      setPoints(Array.isArray(pts) ? pts : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchData() }, [month])

  const filteredCategories = categories.filter((c) => c.type === form.type)

  const handleTypeChange = (type: 'income' | 'expense') => {
    setForm({ ...form, type, category_id: '', credit_card_id: '', bank_account_id: '', point_balance_id: '', payment: type === 'expense' ? 'card' : 'cash' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || !form.date) return
    setSubmitting(true)

    const payload = {
      date: form.date,
      amount: parseInt(form.amount),
      type: form.type,
      category_id: form.category_id || null,
      memo: form.memo || null,
      credit_card_id: form.type === 'expense' && form.payment === 'card' ? form.credit_card_id || null : null,
      bank_account_id: form.type === 'income' && form.payment === 'bank' ? form.bank_account_id || null : null,
      point_balance_id: form.type === 'expense' && form.payment === 'points' ? form.point_balance_id || null : null,
    }

    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setForm({ date: today(), amount: '', type: 'expense', category_id: '', credit_card_id: '', bank_account_id: '', point_balance_id: '', payment: 'card', memo: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この取引を削除しますか？')) return
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  const handleEditSave = async (id: string) => {
    const amount = parseInt(editAmount)
    if (isNaN(amount) || amount <= 0) return
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, amount }),
    })
    setEditingId(null)
    fetchData()
  }

  const cardUsage = cards.map((card) => ({
    card,
    total: transactions
      .filter((t) => t.type === 'expense' && t.credit_card_id === card.id)
      .reduce((s, t) => s + t.amount, 0),
  })).filter((c) => c.total > 0)

  const [year, mon] = month.split('-')

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">収支一覧</h1>
        <div className="flex gap-2 items-center">
          <button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() - 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }} className="p-1 rounded hover:bg-slate-200">◀</button>
          <span className="text-sm font-medium">{year}年{mon}月</span>
          <button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }} className="p-1 rounded hover:bg-slate-200">▶</button>
        </div>
      </div>

      {/* カード使用額 */}
      {cardUsage.length > 0 && (
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2">カード今月使用額</p>
          <div className="space-y-1">
            {cardUsage.map(({ card, total }) => (
              <div key={card.id} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                  <span className="text-xs text-slate-600">{card.name}</span>
                </div>
                <span className="text-xs font-bold text-red-600">{yen(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 入力フォーム */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">収支入力</h2>

          {/* 収入/支出切り替え */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button type="button" onClick={() => handleTypeChange('expense')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-red-500 text-white' : 'text-slate-500'}`}>
              支出
            </button>
            <button type="button" onClick={() => handleTypeChange('income')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-green-500 text-white' : 'text-slate-500'}`}>
              収入
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">日付</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" required />
            </div>
            <div>
              <label className="text-xs text-slate-500">金額（円）</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" required min={1} />
            </div>
          </div>

          {/* 支払い方法 */}
          {form.type === 'expense' ? (
            <div>
              <label className="text-xs text-slate-500">支払い方法</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <button type="button" onClick={() => setForm({ ...form, payment: 'cash', credit_card_id: '', point_balance_id: '' })}
                  className={`py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'cash' ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500'}`}>
                  💴 現金
                </button>
                <button type="button" onClick={() => setForm({ ...form, payment: 'card', point_balance_id: '' })}
                  className={`py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'card' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-500'}`}>
                  💳 カード
                </button>
                <button type="button" onClick={() => setForm({ ...form, payment: 'points', credit_card_id: '' })}
                  className={`py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'points' ? 'bg-yellow-500 text-white border-yellow-500' : 'border-slate-200 text-slate-500'}`}>
                  ⭐ ポイント
                </button>
              </div>
              {form.payment === 'card' && (
                <select value={form.credit_card_id} onChange={(e) => setForm({ ...form, credit_card_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-2">
                  <option value="">カードを選択</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {form.payment === 'points' && (
                <select value={form.point_balance_id} onChange={(e) => setForm({ ...form, point_balance_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-2">
                  <option value="">ポイントを選択</option>
                  {points.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.balance.toLocaleString('ja-JP')} pt）</option>)}
                </select>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-500">入金先</label>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setForm({ ...form, payment: 'cash', bank_account_id: '' })}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'cash' ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500'}`}>
                  💴 現金
                </button>
                <button type="button" onClick={() => setForm({ ...form, payment: 'bank' })}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'bank' ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-500'}`}>
                  🏦 銀行口座
                </button>
              </div>
              {form.payment === 'bank' && (
                <select value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-2">
                  <option value="">口座を選択</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500">カテゴリ</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1">
              <option value="">カテゴリなし</option>
              {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">メモ（任意）</label>
            <input type="text" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="メモを入力" className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">キャンセル</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition-colors">
          ＋ 収支を入力する
        </button>
      )}

      {/* 取引一覧 */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">読み込み中...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-slate-400">この月の取引はありません</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{t.categories?.icon ?? '📦'}</span>
                  <div>
                    <p className="text-sm font-medium">{t.categories?.name ?? 'その他'}</p>
                    <p className="text-xs text-slate-400">
                      {t.date}
                      {t.credit_cards ? ` · 💳 ${t.credit_cards.name}` : ''}
                      {t.bank_accounts ? ` · 🏦 ${t.bank_accounts.name}` : ''}
                      {t.point_balances ? ` · ⭐ ${t.point_balances.name}` : ''}
                      {t.memo ? `　${t.memo}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {editingId === t.id ? (
                    <>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(t.id); if (e.key === 'Escape') setEditingId(null) }}
                        className="w-24 border border-indigo-300 rounded-lg px-2 py-0.5 text-sm text-right"
                        autoFocus
                        min={1}
                      />
                      <button onClick={() => handleEditSave(t.id)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-1">保存</button>
                      <button onClick={() => setEditingId(null)} className="text-slate-300 hover:text-slate-500 text-lg leading-none">×</button>
                    </>
                  ) : (
                    <>
                      <span className={`text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}{yen(t.amount)}
                      </span>
                      <button onClick={() => { setEditingId(t.id); setEditAmount(String(t.amount)) }} className="text-slate-300 hover:text-indigo-400 text-sm leading-none px-0.5">✏</button>
                      <button onClick={() => handleDelete(t.id)} className="text-slate-300 hover:text-red-400 text-lg leading-none">×</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
