'use client'

import { useEffect, useMemo, useState } from 'react'
import { Transaction, Category } from '@/lib/supabase'

function formatYen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function getMonths(count: number): string[] {
  const months: string[] = []
  const d = new Date()
  d.setDate(1) // 月末日付で月を跨ぐとオーバーフローするため1日に固定
  for (let i = 0; i < count; i++) {
    months.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return months
}

type MonthSummary = {
  month: string
  income: number
  expense: number
}

export default function ReportsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<MonthSummary[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const months = useMemo(() => getMonths(6), [])

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      ...months.map((m) => fetch(`/api/transactions?month=${m}`).then((r) => r.json())),
    ]).then(([cats, ...txnsByMonth]) => {
      setCategories(Array.isArray(cats) ? cats : [])
      const summaries: MonthSummary[] = months.map((month, i) => {
        const txns: Transaction[] = Array.isArray(txnsByMonth[i]) ? txnsByMonth[i] : []
        return {
          month,
          income: txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
          expense: txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        }
      })
      setMonthlySummaries(summaries)
      const currentMonth = months[months.length - 1]
      setSelectedMonth(currentMonth)
      const currentTxns: Transaction[] = Array.isArray(txnsByMonth[months.length - 1])
        ? txnsByMonth[months.length - 1]
        : []
      setTransactions(currentTxns)
      setLoading(false)
    })
  }, [months])

  const handleMonthChange = async (month: string) => {
    setSelectedMonth(month)
    const txns = await fetch(`/api/transactions?month=${month}`).then((r) => r.json())
    setTransactions(Array.isArray(txns) ? txns : [])
  }

  const selectedSummary = monthlySummaries.find((s) => s.month === selectedMonth) ?? {
    income: 0,
    expense: 0,
    month: selectedMonth,
  }

  // カテゴリ別集計
  const categoryBreakdown = categories
    .filter((c) => c.type === 'expense')
    .map((cat) => ({
      category: cat,
      total: transactions
        .filter((t) => t.type === 'expense' && t.category_id === cat.id)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .filter((cb) => cb.total > 0)
    .sort((a, b) => b.total - a.total)

  const maxExpense = Math.max(...monthlySummaries.map((s) => s.expense), 1)

  const [year, mon] = selectedMonth ? selectedMonth.split('-') : ['', '']

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">月次レポート</h1>

      {loading ? (
        <div className="text-center py-8 text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* 6ヶ月棒グラフ */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">支出推移（6ヶ月）</h2>
            <div className="flex items-end gap-2 h-28">
              {monthlySummaries.map((s) => {
                const pct = (s.expense / maxExpense) * 100
                const isSelected = s.month === selectedMonth
                const [, m] = s.month.split('-')
                return (
                  <button
                    key={s.month}
                    onClick={() => handleMonthChange(s.month)}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div className="w-full flex flex-col justify-end" style={{ height: '96px' }}>
                      <div
                        className={`w-full rounded-t-md transition-all ${isSelected ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs ${isSelected ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                      {m}月
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 選択月サマリー */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">{year}年{mon}月の内訳</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-xs text-green-600">収入</p>
                <p className="text-sm font-bold text-green-700">{formatYen(selectedSummary.income)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-red-600">支出</p>
                <p className="text-sm font-bold text-red-700">{formatYen(selectedSummary.expense)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-indigo-600">収支</p>
                <p className={`text-sm font-bold ${selectedSummary.income - selectedSummary.expense >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>
                  {formatYen(selectedSummary.income - selectedSummary.expense)}
                </p>
              </div>
            </div>

            {/* カテゴリ内訳 */}
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">支出データなし</p>
            ) : (
              <div className="space-y-2">
                {categoryBreakdown.map((cb) => {
                  const pct = selectedSummary.expense > 0 ? (cb.total / selectedSummary.expense) * 100 : 0
                  const overBudget = cb.category.budget_limit != null && cb.total > cb.category.budget_limit
                  return (
                    <div key={cb.category.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{cb.category.icon} {cb.category.name}</span>
                        <span className="flex gap-2">
                          <span className="text-slate-400">{formatNumber(pct)}%</span>
                          <span className={overBudget ? 'text-red-600 font-bold' : ''}>{formatYen(cb.total)}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: overBudget ? '#ef4444' : cb.category.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function formatNumber(n: number, digits = 1) {
  return n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
