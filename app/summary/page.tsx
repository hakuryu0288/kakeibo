'use client'

import { useEffect, useState } from 'react'
import { Transaction, Category, CreditCard } from '@/lib/supabase'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

// "2026-09-19" → "9/19(土)"
function labelDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

// "2026-09-19" → "2026/09/19"
function labelFull(iso: string) {
  return iso.replace(/-/g, '/')
}

// 期間の日数（両端を含む）
function dayCount(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const diff = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)
  return Math.floor(diff / 86400000) + 1
}

type Range = { from: string; to: string }

function thisMonthRange(): Range {
  const now = new Date()
  return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) }
}

// クイック選択のプリセット
function presetRange(key: string): Range {
  const now = new Date()
  switch (key) {
    case 'today':
      return { from: toISO(now), to: toISO(now) }
    case 'week7':
      return { from: toISO(addDays(now, -6)), to: toISO(now) }
    case 'day30':
      return { from: toISO(addDays(now, -29)), to: toISO(now) }
    case 'lastMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: toISO(first), to: toISO(last) }
    }
    case 'thisYear':
      return { from: toISO(new Date(now.getFullYear(), 0, 1)), to: toISO(now) }
    default:
      return thisMonthRange()
  }
}

const PRESETS = [
  { key: 'today', label: '今日' },
  { key: 'week7', label: '過去7日' },
  { key: 'thisMonth', label: '今月' },
  { key: 'lastMonth', label: '先月' },
  { key: 'day30', label: '過去30日' },
  { key: 'thisYear', label: '今年' },
]

export default function SummaryPage() {
  const [range, setRange] = useState<Range>(thisMonthRange)
  const [applied, setApplied] = useState<Range>(thisMonthRange)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showList, setShowList] = useState(true)

  const invalidRange = range.from > range.to

  useEffect(() => {
    let canceled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      fetch(`/api/transactions?from=${applied.from}&to=${applied.to}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
    ]).then(([txns, cats, cds]) => {
      if (canceled) return
      setTransactions(Array.isArray(txns) ? txns : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setCards(Array.isArray(cds) ? cds : [])
      setLoading(false)
    })
    return () => { canceled = true }
  }, [applied])

  const applyPreset = (key: string) => {
    const r = presetRange(key)
    setRange(r)
    setApplied(r)
  }

  const search = () => {
    if (invalidRange) return
    setApplied(range)
  }

  const incomeTxns = transactions.filter((t) => t.type === 'income')
  const expenseTxns = transactions.filter((t) => t.type === 'expense')
  const transferTxns = transactions.filter((t) => t.type === 'transfer')

  const income = incomeTxns.reduce((s, t) => s + t.amount, 0)
  const expense = expenseTxns.reduce((s, t) => s + t.amount, 0)
  const net = income - expense
  const days = dayCount(applied.from, applied.to)

  // 支払い方法別の支出内訳
  const byCard = expenseTxns.filter((t) => t.credit_card_id).reduce((s, t) => s + t.amount, 0)
  const byPoints = expenseTxns.filter((t) => t.point_balance_id).reduce((s, t) => s + t.amount, 0)
  const byCash = expense - byCard - byPoints

  // カテゴリ別の支出内訳（多い順）
  const categoryBreakdown = categories
    .filter((c) => c.type === 'expense')
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      total: expenseTxns.filter((t) => t.category_id === cat.id).reduce((s, t) => s + t.amount, 0),
    }))
    .concat([{
      id: '',
      name: 'カテゴリなし',
      icon: '📦',
      color: '#94a3b8',
      total: expenseTxns.filter((t) => !t.category_id).reduce((s, t) => s + t.amount, 0),
    }])
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)

  // カード別の支出内訳（多い順）
  const cardBreakdown = cards
    .map((card) => ({
      card,
      total: expenseTxns.filter((t) => t.credit_card_id === card.id).reduce((s, t) => s + t.amount, 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)

  // 日付ごとにまとめる（APIが日付の降順で返す前提）
  const groups: { date: string; items: Transaction[]; income: number; expense: number }[] = []
  for (const t of transactions) {
    let g = groups.find((x) => x.date === t.date)
    if (!g) {
      g = { date: t.date, items: [], income: 0, expense: 0 }
      groups.push(g)
    }
    g.items.push(t)
    if (t.type === 'income') g.income += t.amount
    if (t.type === 'expense') g.expense += t.amount
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">集計</h1>

      {/* 期間指定 */}
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500">開始日</label>
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">終了日</label>
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className="py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {invalidRange && (
          <p className="text-xs text-red-500">開始日は終了日より前の日付にしてください</p>
        )}

        <button
          onClick={search}
          disabled={invalidRange}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          🔍 この期間で集計する
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">集計中...</div>
      ) : (
        <>
          {/* 収支サマリー */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-400">
              {labelFull(applied.from)} 〜 {labelFull(applied.to)}（{days}日間・{transactions.length}件）
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-700">収入</p>
                <p className="text-base font-bold text-green-700 mt-0.5 break-all">{yen(income)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-600">支出</p>
                <p className="text-base font-bold text-red-600 mt-0.5 break-all">{yen(expense)}</p>
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
              <span className="text-sm font-semibold text-slate-700">差引収支</span>
              <span className={`text-lg font-bold ${net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {net >= 0 ? '+' : '-'}{yen(Math.abs(net))}
              </span>
            </div>
            {expense > 0 && (
              <p className="text-xs text-slate-400 mt-1 text-right">
                1日あたりの支出 {yen(Math.round(expense / days))}
              </p>
            )}
            {transferTxns.length > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                ※ 振替 {transferTxns.length}件は収支に含めていません
              </p>
            )}
          </div>

          {/* 支払い方法別 */}
          {expense > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">支払い方法別の支出</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">💳 カード</span>
                  <span className="font-medium">{yen(byCard)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">💴 現金</span>
                  <span className="font-medium">{yen(byCash)}</span>
                </div>
                {byPoints > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">⭐ ポイント</span>
                    <span className="font-medium">{yen(byPoints)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* カテゴリ別 */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">カテゴリ別の支出</h2>
              <div className="space-y-2.5">
                {categoryBreakdown.map((c) => (
                  <div key={c.id || 'none'}>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 truncate">{c.icon} {c.name}</span>
                      <span className="font-medium shrink-0 ml-2">
                        {yen(c.total)}
                        <span className="text-xs text-slate-400 ml-1">
                          {Math.round((c.total / expense) * 100)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(c.total / categoryBreakdown[0].total) * 100}%`, backgroundColor: c.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* カード別 */}
          {cardBreakdown.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">カード別の支出</h2>
              <div className="space-y-1.5">
                {cardBreakdown.map(({ card, total }) => (
                  <div key={card.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
                      <span className="text-sm text-slate-600 truncate">{card.name}</span>
                    </div>
                    <span className="text-sm font-medium shrink-0 ml-2">{yen(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 取引一覧（日付ごと） */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-700">取引一覧（{transactions.length}件）</h2>
              <button onClick={() => setShowList((v) => !v)} className="text-xs text-indigo-600">
                {showList ? '隠す' : '表示'}
              </button>
            </div>

            {showList && (
              transactions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">この期間の取引はありません</p>
              ) : (
                <div className="mt-3 space-y-4">
                  {groups.map((g) => (
                    <div key={g.date}>
                      <div className="flex justify-between items-center bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs font-semibold text-slate-600">{labelDate(g.date)}</span>
                        <span className="text-xs text-slate-500">
                          {g.income > 0 && <span className="text-green-600 mr-2">+{yen(g.income)}</span>}
                          {g.expense > 0 && <span className="text-red-600">-{yen(g.expense)}</span>}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {g.items.map((t) => {
                          const isTransfer = t.type === 'transfer'
                          const cashIncreases = isTransfer ? t.transfer_direction === 'withdraw' : t.type === 'income'
                          // 支払い方法（カード・口座・ポイントの紐付けがなければ現金）
                          const payLabel = t.credit_cards ? `💳 ${t.credit_cards.name}`
                            : t.bank_accounts ? `🏦 ${t.bank_accounts.name}`
                            : t.point_balances ? `⭐ ${t.point_balances.name}`
                            : '💴 現金'
                          return (
                            <div key={t.id} className="flex items-start justify-between py-2 gap-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <span className="text-lg leading-none mt-0.5">{isTransfer ? '🔁' : t.categories?.icon ?? '📦'}</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {isTransfer
                                      ? (t.transfer_direction === 'withdraw' ? '引き出し（銀行→現金）' : '預け入れ（現金→銀行）')
                                      : (t.categories?.name ?? 'その他')}
                                  </p>
                                  <p className="text-xs text-slate-400 truncate">{payLabel}</p>
                                  {t.memo && (
                                    <p className="text-xs text-slate-500 break-words">📝 {t.memo}</p>
                                  )}
                                </div>
                              </div>
                              <span className={`text-sm font-bold shrink-0 ${isTransfer ? 'text-indigo-600' : t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {cashIncreases ? '+' : '-'}{yen(t.amount)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
