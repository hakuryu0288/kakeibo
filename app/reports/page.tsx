'use client'

import { useEffect, useMemo, useState } from 'react'
import { Transaction, Category, CreditCard } from '@/lib/supabase'

function formatYen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function formatNumber(n: number, digits = 1) {
  return n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function getYearMonths(year: number): string[] {
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const months: string[] = []
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    if (ym <= currentYM) months.push(ym)
  }
  return months
}

type MonthSummary = { month: string; income: number; expense: number }

export default function ReportsPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [categories, setCategories] = useState<Category[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<MonthSummary[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [allTxns, setAllTxns] = useState<Record<string, Transaction[]>>({})
  const [loading, setLoading] = useState(true)
  const [detailTab, setDetailTab] = useState<'category' | 'card'>('category')

  const months = useMemo(() => getYearMonths(selectedYear), [selectedYear])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      ...months.map((m) => fetch(`/api/transactions?month=${m}`).then((r) => r.json())),
    ]).then(([cats, cds, ...txnsByMonth]) => {
      setCategories(Array.isArray(cats) ? cats : [])
      setCards(Array.isArray(cds) ? cds : [])

      const txnMap: Record<string, Transaction[]> = {}
      months.forEach((m, i) => { txnMap[m] = Array.isArray(txnsByMonth[i]) ? txnsByMonth[i] : [] })
      setAllTxns(txnMap)

      const summaries: MonthSummary[] = months.map((month, i) => {
        const txns: Transaction[] = Array.isArray(txnsByMonth[i]) ? txnsByMonth[i] : []
        return {
          month,
          income: txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
          expense: txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        }
      })
      setMonthlySummaries(summaries)
      setSelectedMonth(months[months.length - 1])
      setLoading(false)
    })
  }, [months])

  const selectedTxns = allTxns[selectedMonth] ?? []

  const selectedSummary = monthlySummaries.find((s) => s.month === selectedMonth) ?? {
    income: 0, expense: 0, month: selectedMonth,
  }

  const categoryBreakdown = categories
    .filter((c) => c.type === 'expense')
    .map((cat) => ({
      category: cat,
      total: selectedTxns.filter((t) => t.type === 'expense' && t.category_id === cat.id).reduce((s, t) => s + t.amount, 0),
    }))
    .filter((cb) => cb.total > 0)
    .sort((a, b) => b.total - a.total)

  const cardBreakdown = cards
    .map((card) => ({
      card,
      total: selectedTxns.filter((t) => t.type === 'expense' && t.credit_card_id === card.id).reduce((s, t) => s + t.amount, 0),
    }))
    .filter((cb) => cb.total > 0)
    .sort((a, b) => b.total - a.total)

  const yearTotal = {
    income: monthlySummaries.reduce((s, m) => s + m.income, 0),
    expense: monthlySummaries.reduce((s, m) => s + m.expense, 0),
  }

  const maxExpense = Math.max(...monthlySummaries.map((s) => s.expense), 1)
  const [year, mon] = selectedMonth ? selectedMonth.split('-') : ['', '']

  return (
    <div className="space-y-4">
      {/* ヘッダー + 年ナビゲーション */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">レポート</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg text-lg"
          >‹</button>
          <span className="text-sm font-medium min-w-[52px] text-center">{selectedYear}年</span>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            disabled={selectedYear >= currentYear}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg text-lg disabled:opacity-30"
          >›</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* 12ヶ月棒グラフ */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">支出推移（{selectedYear}年）</h2>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1" style={{ minWidth: `${months.length * 40}px` }}>
                {monthlySummaries.map((s) => {
                  const pct = (s.expense / maxExpense) * 100
                  const isSelected = s.month === selectedMonth
                  const [, m] = s.month.split('-')
                  return (
                    <button
                      key={s.month}
                      onClick={() => setSelectedMonth(s.month)}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div className="w-full flex flex-col justify-end" style={{ height: '88px' }}>
                        <div
                          className={`w-full rounded-t-md transition-all ${isSelected ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className={`text-xs whitespace-nowrap ${isSelected ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                        {m}月
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 年間集計 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">{selectedYear}年　年間集計</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-green-600">収入合計</p>
                <p className="text-sm font-bold text-green-700">{formatYen(yearTotal.income)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-red-600">支出合計</p>
                <p className="text-sm font-bold text-red-700">{formatYen(yearTotal.expense)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-indigo-600">年間収支</p>
                <p className={`text-sm font-bold ${yearTotal.income - yearTotal.expense >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>
                  {formatYen(yearTotal.income - yearTotal.expense)}
                </p>
              </div>
            </div>
          </div>

          {/* 月次収支一覧（銀行残高推移の代わり） */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">月次収支一覧</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {monthlySummaries.map((s) => {
                const net = s.income - s.expense
                const [, m] = s.month.split('-')
                const isSelected = s.month === selectedMonth
                return (
                  <button
                    key={s.month}
                    onClick={() => setSelectedMonth(s.month)}
                    className={`w-full flex items-center px-4 py-2.5 text-xs gap-2 transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`w-7 font-medium shrink-0 text-left ${isSelected ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}>{m}月</span>
                    <span className="text-green-600 w-24 text-right shrink-0">
                      {s.income > 0 ? `+${formatYen(s.income)}` : '—'}
                    </span>
                    <span className="text-red-500 w-24 text-right shrink-0">
                      {s.expense > 0 ? `-${formatYen(s.expense)}` : '—'}
                    </span>
                    <span className={`ml-auto font-bold shrink-0 ${net > 0 ? 'text-indigo-600' : net < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {net > 0 ? '+' : ''}{formatYen(net)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 選択月サマリー + カテゴリ/カード内訳 */}
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

            {/* カテゴリ別 / カード別 タブ */}
            <div className="flex gap-1 mb-3">
              {(['category', 'card'] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {t === 'category' ? 'カテゴリ別' : 'カード別'}
                </button>
              ))}
            </div>

            {detailTab === 'category' && (
              categoryBreakdown.length === 0 ? (
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
                          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: overBudget ? '#ef4444' : cb.category.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {detailTab === 'card' && (
              cardBreakdown.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">カード支出なし</p>
              ) : (
                <div className="space-y-2">
                  {cardBreakdown.map((cb) => {
                    const pct = selectedSummary.expense > 0 ? (cb.total / selectedSummary.expense) * 100 : 0
                    return (
                      <div key={cb.card.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cb.card.color }} />
                            {cb.card.name}
                          </span>
                          <span className="flex gap-2">
                            <span className="text-slate-400">{formatNumber(pct)}%</span>
                            <span className="text-red-600 font-medium">{formatYen(cb.total)}</span>
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cb.card.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>

          {/* カード別年間使用額 */}
          {cards.some((card) =>
            monthlySummaries.some((s) =>
              (allTxns[s.month] ?? []).some((t) => t.type === 'expense' && t.credit_card_id === card.id)
            )
          ) && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">カード別年間使用額（{selectedYear}年）</h2>
              <div className="space-y-3">
                {cards.map((card) => {
                  const annual = monthlySummaries.reduce((sum, s) => {
                    return sum + (allTxns[s.month] ?? [])
                      .filter((t) => t.type === 'expense' && t.credit_card_id === card.id)
                      .reduce((a, t) => a + t.amount, 0)
                  }, 0)
                  if (annual === 0) return null
                  const avg = Math.round(annual / monthlySummaries.length)
                  return (
                    <div key={card.id} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
                        <span className="text-sm font-medium">{card.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{formatYen(annual)}</p>
                        <p className="text-xs text-slate-400">月平均 {formatYen(avg)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
