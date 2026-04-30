'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Summary = {
  totalBankBalance: number
  totalFixedCosts: number
  totalExpectedIncome: number
  totalCardCharges: number
  pendingSubTotal: number
  totalPlannedExpenses: number
  totalExpectedExpense: number
  projectedBalance: number
  resaleValue: number
  nisaBalance: number
  cashAmount: number
  totalAssets: number
  bankAccounts: { id: string; name: string; balance: number }[]
}

type RecentTransaction = {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense'
  memo: string | null
  categories?: { name: string; icon: string }
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [recentTxns, setRecentTxns] = useState<RecentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const month = currentMonth()
  const [year, mon] = month.split('-')

  useEffect(() => {
    Promise.all([
      fetch(`/api/summary?month=${month}`).then((r) => r.json()),
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
    ]).then(([sum, txns]) => {
      setSummary(sum)
      setRecentTxns(Array.isArray(txns) ? txns.slice(0, 5) : [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-16 text-slate-400">読み込み中...</div>
  if (!summary) return null

  const balanceColor = summary.projectedBalance >= 0 ? 'text-indigo-700' : 'text-red-600'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">家計簿</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{year}年{mon}月</span>
          <Link href="/calendar" className="bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 transition-colors">📅 カレンダー</Link>
        </div>
      </div>

      {/* 総資産カード */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-xs opacity-70">総資産</p>
        <p className="text-3xl font-bold mt-1">{yen(summary.totalAssets)}</p>
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          <div className="bg-white/10 rounded-lg p-2">
            <p className="opacity-70">口座合計</p>
            <p className="font-semibold">{yen(summary.totalBankBalance)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="opacity-70">NISA</p>
            <p className="font-semibold">{yen(summary.nisaBalance)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="opacity-70">現金</p>
            <p className="font-semibold">{yen(summary.cashAmount)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2">
            <p className="opacity-70">商材</p>
            <p className="font-semibold">{yen(summary.resaleValue)}</p>
          </div>
        </div>
      </div>

      {/* 銀行口座 + 現金 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-slate-700">口座・現金</h2>
          <Link href="/accounts" className="text-xs text-indigo-600">管理</Link>
        </div>
        {summary.bankAccounts.map((acc) => (
          <div key={acc.id} className="flex justify-between items-center py-2 border-b border-slate-50">
            <span className="text-sm">🏦 {acc.name}</span>
            <span className="text-sm font-semibold">{yen(acc.balance)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center py-2">
          <span className="text-sm">💴 現金</span>
          <span className="text-sm font-semibold">{yen(summary.cashAmount)}</span>
        </div>
      </div>

      {/* 見込み残高カード */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">今月の見込み計算</h2>
        <div className="space-y-2 text-sm">
          <Row label="口座残高合計" value={summary.totalBankBalance} />
          <Row label="固定費（口座引き落とし）" value={-summary.totalFixedCosts} minus />
          <Row label="見込み給料" value={summary.totalExpectedIncome} plus />
          <Row label="カード請求済み" value={-summary.totalCardCharges} minus />
          <Row label="未請求サブスク" value={-summary.pendingSubTotal} minus />
          <Row label="確定出費" value={-summary.totalPlannedExpenses} minus />
          <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
            <span>次月末残高予測</span>
            <span className={balanceColor}>{yen(summary.projectedBalance)}</span>
          </div>
        </div>
      </div>

      {/* 最近の取引 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-slate-700">最近の取引</h2>
          <Link href="/transactions" className="text-xs text-indigo-600">すべて見る</Link>
        </div>
        {recentTxns.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">取引がありません</p>
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
                  {t.type === 'income' ? '+' : '-'}{yen(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/transactions"
        className="block w-full bg-indigo-600 text-white text-center py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition-colors"
      >
        ＋ 収支を入力する
      </Link>
    </div>
  )
}

function Row({ label, value, plus, minus }: { label: string; value: number; plus?: boolean; minus?: boolean }) {
  const color = plus ? 'text-green-600' : minus ? 'text-red-600' : 'text-slate-800'
  const prefix = plus ? '+' : minus ? '-' : ''
  return (
    <div className="flex justify-between text-slate-600">
      <span className="text-xs">{label}</span>
      <span className={`text-xs font-medium ${color}`}>{prefix}{yen(Math.abs(value))}</span>
    </div>
  )
}
