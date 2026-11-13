'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Transaction, Category, CreditCard, ExpectedIncome } from '@/lib/supabase'
import { isNisaTxn, isNisaName } from '@/lib/report-rules'

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

// 「商材」「錬金」の収入と、その元手・立て替えを入れる「投資・商材・錬金」の支出。
// 名前で見分ける（「・」や空白の有無は問わない）
const normName = (name: string) => name.replace(/[\s・･/／、,]/g, '')
const SIDE_INCOME_NAMES = ['商材', '錬金']
const SIDE_EXPENSE_NAME = '投資商材錬金'
const isSideIncome = (c?: Category | null) => !!c && c.type === 'income' && SIDE_INCOME_NAMES.includes(normName(c.name))
const isSideExpense = (c?: Category | null) => !!c && c.type === 'expense' && normName(c.name) === SIDE_EXPENSE_NAME

type SideTotals = { income: number; expense: number }
function sideTotals(txns: Transaction[], catById: Map<string, Category>): SideTotals {
  let income = 0
  let expense = 0
  for (const t of txns) {
    const c = t.category_id ? catById.get(t.category_id) : undefined
    if (t.type === 'income' && isSideIncome(c)) income += t.amount
    if (t.type === 'expense' && isSideExpense(c)) expense += t.amount
  }
  return { income, expense }
}

type MonthSummary = { month: string; income: number; expense: number; txnIncome: number; salaryIncome: number; nisa: number }

export default function ReportsPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [categories, setCategories] = useState<Category[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<MonthSummary[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [allTxns, setAllTxns] = useState<Record<string, Transaction[]>>({})
  const [allExpectedIncomes, setAllExpectedIncomes] = useState<Record<string, ExpectedIncome[]>>({})
  const [loading, setLoading] = useState(true)
  const [detailTab, setDetailTab] = useState<'category' | 'card' | 'income'>('category')

  const months = useMemo(() => getYearMonths(selectedYear), [selectedYear])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      ...months.map((m) => fetch(`/api/transactions?month=${m}`).then((r) => r.json())),
      ...months.map((m) => fetch(`/api/expected-income?month=${m}`).then((r) => r.json())),
    ]).then((results) => {
      const cats = results[0]
      const cds = results[1]
      const txnsByMonth = results.slice(2, 2 + months.length)
      const expectedByMonth = results.slice(2 + months.length)

      setCategories(Array.isArray(cats) ? cats : [])
      setCards(Array.isArray(cds) ? cds : [])

      // NISA積立はレポートの支出から外して別枠で数える
      const txnMap: Record<string, Transaction[]> = {}
      const nisaByMonth: Record<string, number> = {}
      const expectedMap: Record<string, ExpectedIncome[]> = {}
      months.forEach((m, i) => {
        const all: Transaction[] = Array.isArray(txnsByMonth[i]) ? txnsByMonth[i] : []
        txnMap[m] = all.filter((t) => !isNisaTxn(t))
        nisaByMonth[m] = all.filter(isNisaTxn).reduce((s, t) => s + t.amount, 0)
        expectedMap[m] = Array.isArray(expectedByMonth[i]) ? expectedByMonth[i] : []
      })
      setAllTxns(txnMap)
      setAllExpectedIncomes(expectedMap)

      const summaries: MonthSummary[] = months.map((month, i) => {
        const txns: Transaction[] = txnMap[month]
        const expected: ExpectedIncome[] = Array.isArray(expectedByMonth[i]) ? expectedByMonth[i] : []
        const txnIncome = txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        const salaryIncome = expected.reduce((s, e) => s + e.amount, 0)
        return {
          month,
          txnIncome,
          salaryIncome,
          income: txnIncome + salaryIncome,
          expense: txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
          nisa: nisaByMonth[month],
        }
      })
      setMonthlySummaries(summaries)
      setSelectedMonth(months[months.length - 1])
      setLoading(false)
    })
  }, [months])

  const selectedTxns = allTxns[selectedMonth] ?? []
  const selectedExpectedIncomes = allExpectedIncomes[selectedMonth] ?? []

  const selectedSummary = monthlySummaries.find((s) => s.month === selectedMonth) ?? {
    income: 0, expense: 0, month: selectedMonth, txnIncome: 0, salaryIncome: 0, nisa: 0,
  }

  const uncategorizedCategory = (type: 'income' | 'expense'): Category => ({
    id: '', name: 'カテゴリなし', type, budget_limit: null, color: '#94a3b8', icon: '📦', created_at: '',
  })

  const categoryBreakdown = categories
    .filter((c) => c.type === 'expense')
    .map((cat) => ({
      category: cat,
      total: selectedTxns.filter((t) => t.type === 'expense' && t.category_id === cat.id).reduce((s, t) => s + t.amount, 0),
    }))
    .concat([{
      category: uncategorizedCategory('expense'),
      total: selectedTxns.filter((t) => t.type === 'expense' && !t.category_id).reduce((s, t) => s + t.amount, 0),
    }])
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
    salary: monthlySummaries.reduce((s, m) => s + m.salaryIncome, 0),
    nisa: monthlySummaries.reduce((s, m) => s + m.nisa, 0),
  }

  // 平均は「記録を始めた月」から数える（例：4月から使い始めた年は 4月〜今月）
  const firstActiveIdx = monthlySummaries.findIndex((s) => s.income > 0 || s.expense > 0 || s.nisa > 0)
  const activeSummaries = firstActiveIdx >= 0 ? monthlySummaries.slice(firstActiveIdx) : monthlySummaries
  const activeMonthCount = Math.max(activeSummaries.length, 1)
  const activeRangeLabel = activeSummaries.length > 0
    ? `${Number(activeSummaries[0].month.split('-')[1])}月〜${Number(activeSummaries[activeSummaries.length - 1].month.split('-')[1])}月の${activeSummaries.length}か月`
    : ''

  const catById = new Map(categories.map((c) => [c.id, c]))
  const hasSideCategories = categories.some((c) => isSideIncome(c) || isSideExpense(c))
  const yearSide = sideTotals(months.flatMap((m) => allTxns[m] ?? []), catById)
  const monthSide = sideTotals(selectedTxns, catById)

  // 年間のカテゴリ別支出（多い順）
  const yearExpenseByCategory = categories
    .filter((c) => c.type === 'expense' && !isNisaName(c.name))
    .map((cat) => ({
      category: cat,
      total: months.reduce((sum, m) => sum + (allTxns[m] ?? []).filter((t) => t.type === 'expense' && t.category_id === cat.id).reduce((s, t) => s + t.amount, 0), 0),
    }))
    .concat([{
      category: uncategorizedCategory('expense'),
      total: months.reduce((sum, m) => sum + (allTxns[m] ?? []).filter((t) => t.type === 'expense' && !t.category_id).reduce((s, t) => s + t.amount, 0), 0),
    }])
    .filter((cb) => cb.total > 0)
    .sort((a, b) => b.total - a.total)

  const maxExpense = Math.max(...activeSummaries.map((s) => s.expense), 1)
  const [year, mon] = selectedMonth ? selectedMonth.split('-') : ['', '']

  const incomeCatBreakdown = categories
    .filter((c) => c.type === 'income')
    .map((cat) => ({
      category: cat,
      total: selectedTxns.filter((t) => t.type === 'income' && t.category_id === cat.id).reduce((s, t) => s + t.amount, 0),
    }))
    .concat([{
      category: uncategorizedCategory('income'),
      total: selectedTxns.filter((t) => t.type === 'income' && !t.category_id).reduce((s, t) => s + t.amount, 0),
    }])
    .filter((cb) => cb.total > 0)
    .sort((a, b) => b.total - a.total)

  const yearIncomeByCategory = categories
    .filter((c) => c.type === 'income')
    .map((cat) => ({
      category: cat,
      total: months.reduce((sum, m) => {
        return sum + (allTxns[m] ?? []).filter((t) => t.type === 'income' && t.category_id === cat.id).reduce((s, t) => s + t.amount, 0)
      }, 0),
    }))
    .filter((cb) => cb.total > 0)
    .sort((a, b) => b.total - a.total)

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
              <div className="flex items-end gap-1" style={{ minWidth: `${activeSummaries.length * 40}px` }}>
                {activeSummaries.map((s) => {
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
            <div className="grid grid-cols-3 gap-3 mb-3">
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
            {yearTotal.salary > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 text-center">うち見込み給与：<span className="font-medium text-green-600">{formatYen(yearTotal.salary)}</span></p>
              </div>
            )}
            {hasSideCategories && (yearSide.income > 0 || yearSide.expense > 0) && (
              <SideBreakdown side={yearSide} income={yearTotal.income} expense={yearTotal.expense} />
            )}
            {yearTotal.nisa > 0 && (
              <NisaRow amount={yearTotal.nisa} avg={Math.round(yearTotal.nisa / activeMonthCount)} />
            )}
            {activeRangeLabel && (
              <p className="text-xs text-slate-400 text-center mt-2">月平均は{activeRangeLabel}で計算</p>
            )}
          </div>

          {/* 年間のカテゴリ別支出 */}
          {yearExpenseByCategory.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">カテゴリ別の支出（{selectedYear}年）</h2>
              <div className="space-y-2.5">
                {yearExpenseByCategory.map((cb) => {
                  const pct = yearTotal.expense > 0 ? (cb.total / yearTotal.expense) * 100 : 0
                  return (
                    <div key={cb.category.id || 'none'}>
                      <div className="flex justify-between items-baseline text-xs mb-1 gap-2">
                        <span className="truncate">{cb.category.icon} {cb.category.name}</span>
                        <span className="flex gap-2 shrink-0 items-baseline">
                          <span className="text-slate-400">{formatNumber(pct)}%</span>
                          <span className="font-medium">{formatYen(cb.total)}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cb.category.color }} />
                      </div>
                      <p className="text-[11px] text-slate-400 text-right mt-0.5">月平均 {formatYen(Math.round(cb.total / activeMonthCount))}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 月次収支一覧 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">月次収支一覧</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {activeSummaries.map((s) => {
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
            {selectedSummary.nisa > 0 && (
              <div className="mb-3 -mt-1">
                <NisaRow amount={selectedSummary.nisa} />
              </div>
            )}
            {hasSideCategories && (monthSide.income > 0 || monthSide.expense > 0) && (
              <div className="mb-4">
                <SideBreakdown side={monthSide} income={selectedSummary.income} expense={selectedSummary.expense} />
              </div>
            )}

            {/* カテゴリ別 / カード別 / 収入内訳 タブ */}
            <div className="flex gap-1 mb-3">
              {(['category', 'card', 'income'] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${detailTab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {t === 'category' ? 'カテゴリ別' : t === 'card' ? 'カード別' : '収入内訳'}
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

            {detailTab === 'income' && (
              <div className="space-y-3">
                {selectedExpectedIncomes.length === 0 && incomeCatBreakdown.length === 0 && selectedSummary.txnIncome === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">収入データなし</p>
                ) : (
                  <>
                    {selectedExpectedIncomes.length > 0 && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs font-semibold text-green-700 mb-2">給与・見込み収入</p>
                        <div className="space-y-1.5">
                          {selectedExpectedIncomes.map((e) => (
                            <div key={e.id} className="flex justify-between items-center text-xs">
                              <span className="text-slate-600">{e.description ?? '給与'}</span>
                              <span className="font-medium text-green-700">{formatYen(e.amount)}</span>
                            </div>
                          ))}
                          {selectedExpectedIncomes.length > 1 && (
                            <div className="flex justify-between text-xs font-bold pt-1 border-t border-green-200">
                              <span className="text-green-700">合計</span>
                              <span className="text-green-700">{formatYen(selectedSummary.salaryIncome)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {incomeCatBreakdown.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">収入取引（カテゴリ別）</p>
                        <div className="space-y-2">
                          {incomeCatBreakdown.map((cb) => {
                            const pct = selectedSummary.income > 0 ? (cb.total / selectedSummary.income) * 100 : 0
                            return (
                              <div key={cb.category.id}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span>{cb.category.icon} {cb.category.name}</span>
                                  <span className="flex gap-2">
                                    <span className="text-slate-400">{formatNumber(pct)}%</span>
                                    <span className="text-green-600 font-medium">{formatYen(cb.total)}</span>
                                  </span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cb.category.color }} />
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
                  const avg = Math.round(annual / activeMonthCount)
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

          {/* 年間収入内訳 */}
          {(yearTotal.salary > 0 || yearIncomeByCategory.length > 0) && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">収入内訳（{selectedYear}年）</h2>
              <div className="space-y-3">
                {yearTotal.salary > 0 && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm font-medium">給与・見込み収入</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{formatYen(yearTotal.salary)}</p>
                      <p className="text-xs text-slate-400">月平均 {formatYen(Math.round(yearTotal.salary / activeMonthCount))}</p>
                    </div>
                  </div>
                )}
                {yearIncomeByCategory.map((cb) => (
                  <div key={cb.category.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cb.category.color }} />
                      <span className="text-sm font-medium">{cb.category.icon} {cb.category.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{formatYen(cb.total)}</p>
                      <p className="text-xs text-slate-400">月平均 {formatYen(Math.round(cb.total / activeMonthCount))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// 商材・錬金の損益と、それを除いた収入・支出
function SideBreakdown({ side, income, expense }: { side: SideTotals; income: number; expense: number }) {
  const profit = side.income - side.expense
  return (
    <div className="pt-2 mt-2 border-t border-slate-100 space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-slate-500">商材・錬金の損益</span>
        <span className={`font-bold ${profit >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>{profit >= 0 ? '+' : ''}{formatYen(profit)}</span>
      </div>
      <p className="text-[11px] text-slate-400 text-right">
        （商材・錬金 {formatYen(side.income)} − 投資・商材・錬金 {formatYen(side.expense)}）
      </p>
      <div className="flex justify-between">
        <span className="text-slate-500">商材・錬金を除いた収入</span>
        <span className="font-medium text-green-700">{formatYen(income - side.income)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">投資・商材・錬金を除いた支出</span>
        <span className="font-medium text-red-700">{formatYen(expense - side.expense)}</span>
      </div>
    </div>
  )
}

// NISA積立（支出・収支には含めない別枠）
function NisaRow({ amount, avg }: { amount: number; avg?: number }) {
  return (
    <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-baseline text-xs">
      <span className="text-slate-500">NISA積立（別枠・収支に含めない）</span>
      <span className="text-right">
        <span className="font-bold text-indigo-700">{formatYen(amount)}</span>
        {avg !== undefined && <span className="block text-[11px] text-slate-400">月平均 {formatYen(avg)}</span>}
      </span>
    </div>
  )
}
