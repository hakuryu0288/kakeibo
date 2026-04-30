'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Transaction, Category } from '@/lib/supabase'

type Summary = {
  income: number
  expense: number
  balance: number
}

type CategoryExpense = {
  category: Category
  total: number
}

function formatYen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([txns, cats]) => {
      setTransactions(Array.isArray(txns) ? txns : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setLoading(false)
    })
  }, [month])

  const summary: Summary = transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount
      else acc.expense += t.amount
      return acc
    },
    { income: 0, expense: 0, balance: 0 }
  )
  summary.balance = summary.income - summary.expense

  const categoryExpenses: CategoryExpense[] = categories
    .filter((c) => c.type === 'expense')
    .map((cat) => ({
      category: cat,
      total: transactions
        .filter((t) => t.type === 'expense' && t.category_id === cat.id)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .filter((ce) => ce.total > 0)
    .sort((a, b) => b.total - a.total)

  const recentTxns = transactions.slice(0, 5)
  const [year, mon] = month.split('-')

  const prevMonth = () => {
    const d = new Date(`${month}-01`)
    d.setMonth(d.getMonth() - 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(`${month}-01`)
    d.setMonth(d.getMonth() + 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">家計簿</h1>
        <div className="flex gap-2 items-center">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-slate-200">◀</button>
          <span className="text-sm font-medium">{year}年{mon}月</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-slate-200">▶</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-600 font-medium">収入</p>
              <p className="text-base font-bold text-green-700 mt-1">{formatYen(summary.income)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xs text-red-600 font-medium">支出</p>
              <p className="text-base font-bold text-red-700 mt-1">{formatYen(summary.expense)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${summary.balance >= 0 ? 'bg-indigo-50' : 'bg-orange-50'}`}>
              <p className={`text-xs font-medium ${summary.balance >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>残高</p>
              <p className={`text-base font-bold mt-1 ${summary.balance >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>
                {formatYen(summary.balance)}
              </p>
            </div>
          </div>

          {/* カテゴリ別支出 */}
          {categoryExpenses.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">カテゴリ別支出</h2>
              <div className="space-y-2">
                {categoryExpenses.map((ce) => {
                  const pct = summary.expense > 0 ? (ce.total / summary.expense) * 100 : 0
                  const overBudget = ce.category.budget_limit != null && ce.total > ce.category.budget_limit
                  return (
                    <div key={ce.category.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>
                          {ce.category.icon} {ce.category.name}
                          {overBudget && <span className="ml-1 text-red-500 font-bold">超過</span>}
                        </span>
                        <span className={overBudget ? 'text-red-600 font-bold' : ''}>
                          {formatYen(ce.total)}
                          {ce.category.budget_limit && (
                            <span className="text-slate-400"> /{formatYen(ce.category.budget_limit)}</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: overBudget ? '#ef4444' : ce.category.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 最近の取引 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-slate-700">最近の取引</h2>
              <Link href="/transactions" className="text-xs text-indigo-600">すべて見る</Link>
            </div>
            {recentTxns.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">この月の取引はありません</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTxns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{t.categories?.icon ?? '📦'}</span>
                      <div>
                        <p className="text-sm font-medium">{t.categories?.name ?? 'その他'}</p>
                        <p className="text-xs text-slate-400">{t.date}{t.memo ? '　' + t.memo : ''}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatYen(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* クイック入力ボタン */}
          <Link
            href="/transactions"
            className="block w-full bg-indigo-600 text-white text-center py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition-colors"
          >
            ＋ 収支を入力する
          </Link>
        </>
      )}
    </div>
  )
}
