'use client'

import { useEffect, useState } from 'react'
import { Transaction, Category } from '@/lib/supabase'

function formatYen(n: number) {
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
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    date: today(),
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category_id: '',
    memo: '',
  })

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([txns, cats]) => {
      setTransactions(Array.isArray(txns) ? txns : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchData() }, [month])

  const filteredCategories = categories.filter((c) => c.type === form.type)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || !form.date) return
    setSubmitting(true)
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: parseInt(form.amount),
        category_id: form.category_id || null,
      }),
    })
    setForm({ date: today(), amount: '', type: 'expense', category_id: '', memo: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この取引を削除しますか？')) return
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  const [year, mon] = month.split('-')

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">収支一覧</h1>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              const d = new Date(`${month}-01`)
              d.setMonth(d.getMonth() - 1)
              setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
            }}
            className="p-1 rounded hover:bg-slate-200"
          >◀</button>
          <span className="text-sm font-medium">{year}年{mon}月</span>
          <button
            onClick={() => {
              const d = new Date(`${month}-01`)
              d.setMonth(d.getMonth() + 1)
              setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
            }}
            className="p-1 rounded hover:bg-slate-200"
          >▶</button>
        </div>
      </div>

      {/* 入力フォーム */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">収支入力</h2>

          {/* 収入/支出切り替え */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'expense', category_id: '' })}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-red-500 text-white' : 'text-slate-500'}`}
            >支出</button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'income', category_id: '' })}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-green-500 text-white' : 'text-slate-500'}`}
            >収入</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">日付</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">金額（円）</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
                required
                min={1}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">カテゴリ</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
            >
              <option value="">カテゴリなし</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">メモ（任意）</label>
            <input
              type="text"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="メモを入力"
              className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
            >キャンセル</button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
            >{submitting ? '保存中...' : '保存'}</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition-colors"
        >
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
                    <p className="text-xs text-slate-400">{t.date}{t.memo ? '　' + t.memo : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatYen(t.amount)}
                  </span>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-slate-300 hover:text-red-400 text-lg leading-none"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
