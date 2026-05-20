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

function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}-01`)
  d.setMonth(d.getMonth() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function evalCalc(expr: string): number {
  const tokens = expr.match(/\d+(\.\d+)?|[+\-×÷]/g) ?? []
  const nums: number[] = []
  const ops: string[] = []
  for (const t of tokens) {
    if (/\d/.test(t)) nums.push(parseFloat(t))
    else ops.push(t)
  }
  if (nums.length === 0 || nums.length !== ops.length + 1) return NaN
  let i = 0
  while (i < ops.length) {
    if (ops[i] === '×' || ops[i] === '÷') {
      const r = ops[i] === '×' ? nums[i] * nums[i + 1] : nums[i] / nums[i + 1]
      nums.splice(i, 2, r)
      ops.splice(i, 1)
    } else i++
  }
  let r = nums[0]
  for (let j = 0; j < ops.length; j++) r = ops[j] === '+' ? r + nums[j + 1] : r - nums[j + 1]
  return r
}

type Summary = {
  totalBankBalance: number
  prevMonthProjectedBalance: number
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
  const today = currentMonth()
  const [month, setMonth] = useState(today)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [recentTxns, setRecentTxns] = useState<RecentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [year, mon] = month.split('-')

  const [calcExpr, setCalcExpr] = useState('')
  const [calcResult, setCalcResult] = useState<number | null>(null)
  const [calcJustEval, setCalcJustEval] = useState(false)
  const [scratchMemo, setScratchMemo] = useState('')

  useEffect(() => {
    setScratchMemo(localStorage.getItem('kakeibo-scratchpad') ?? '')
  }, [])

  const goToPrevMonth = () => setMonth((m) => shiftMonth(m, -1))
  const goToNextMonth = () => {
    const next = shiftMonth(month, 1)
    if (next <= today) setMonth(next)
  }

  function handleCalc(btn: string) {
    if (btn === 'C') {
      setCalcExpr(''); setCalcResult(null); setCalcJustEval(false)
    } else if (btn === '←') {
      if (calcJustEval) { setCalcExpr(''); setCalcResult(null); setCalcJustEval(false) }
      else setCalcExpr((p) => p.slice(0, -1))
    } else if (btn === '=') {
      if (!calcExpr) return
      setCalcResult(evalCalc(calcExpr))
      setCalcJustEval(true)
    } else if (/\d/.test(btn)) {
      if (calcJustEval) { setCalcExpr(btn); setCalcResult(null); setCalcJustEval(false) }
      else setCalcExpr((p) => p + btn)
    } else {
      if (calcJustEval && calcResult !== null) {
        setCalcExpr(String(calcResult) + btn); setCalcResult(null); setCalcJustEval(false)
      } else {
        setCalcExpr((p) => {
          if (!p) return p
          const ops = ['+', '-', '×', '÷']
          if (ops.includes(p.slice(-1))) return p.slice(0, -1) + btn
          return p + btn
        })
      }
    }
  }

  useEffect(() => {
    setLoading(true)
    setSummary(null)
    Promise.all([
      fetch(`/api/summary?month=${month}`).then((r) => r.json()),
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
    ]).then(([sum, txns]) => {
      setSummary(sum)
      setRecentTxns(Array.isArray(txns) ? txns.slice(0, 5) : [])
      setLoading(false)
    })
  }, [month])

  if (loading) return <div className="text-center py-16 text-slate-400">読み込み中...</div>
  if (!summary) return null

  const balanceColor = summary.projectedBalance >= 0 ? 'text-indigo-700' : 'text-red-600'
  const isPastMonth = month < today

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Kakeibo</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevMonth}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg text-lg"
          >‹</button>
          <span className="text-sm text-slate-500 min-w-[72px] text-center">{year}年{mon}月</span>
          <button
            onClick={goToNextMonth}
            disabled={month >= today}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg text-lg disabled:opacity-30"
          >›</button>
          <Link href="/calendar" className="bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 transition-colors ml-1">📅 カレンダー</Link>
        </div>
      </div>

      {/* 総資産カード */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-xs opacity-70">総資産</p>
        <p className="text-3xl font-bold mt-1">{yen(summary.totalAssets)}</p>
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          <div className="bg-white/10 rounded-lg p-2">
            <p className="opacity-70">次月末残高</p>
            <p className="font-semibold">{yen(summary.projectedBalance)}</p>
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
      {!isPastMonth && (
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
      )}

      {/* 見込み残高カード */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          {isPastMonth ? `${year}年${mon}月の見込み計算` : '今月の見込み計算'}
        </h2>
        <div className="space-y-2 text-sm">
          <Row label="先月次月末残高予測" value={summary.prevMonthProjectedBalance} />
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
          <h2 className="text-sm font-semibold text-slate-700">
            {isPastMonth ? `${mon}月の取引` : '最近の取引'}
          </h2>
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

      {!isPastMonth && (
        <Link
          href="/transactions"
          className="block w-full bg-indigo-600 text-white text-center py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition-colors"
        >
          ＋ 収支を入力する
        </Link>
      )}

      {/* 電卓 */}
      <div className="bg-white rounded-xl p-3 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 mb-2">電卓</p>
        <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2 text-right min-h-[52px]">
          <p className="text-base font-mono text-slate-700 truncate">{calcExpr || '0'}</p>
          {calcResult !== null && (
            <p className="text-sm font-mono text-indigo-600">
              = {Number.isFinite(calcResult)
                ? calcResult.toLocaleString('ja-JP', { maximumFractionDigits: 8 })
                : 'エラー'}
            </p>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {(['7','8','9','÷','4','5','6','×','1','2','3','-','C','0','←','+'] as const).map((btn) => (
            <button
              key={btn}
              onClick={() => handleCalc(btn)}
              className={`py-3 rounded-lg text-sm font-medium active:scale-95 transition-transform select-none ${
                /\d/.test(btn)
                  ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  : btn === 'C'
                  ? 'bg-red-50 text-red-500 hover:bg-red-100'
                  : btn === '←'
                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >{btn}</button>
          ))}
          <button
            onClick={() => handleCalc('=')}
            className="col-span-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-transform select-none"
          >=</button>
        </div>
      </div>

      {/* メモ欄 */}
      <div className="bg-white rounded-xl p-3 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 mb-2">メモ</p>
        <textarea
          value={scratchMemo}
          onChange={(e) => {
            setScratchMemo(e.target.value)
            localStorage.setItem('kakeibo-scratchpad', e.target.value)
          }}
          placeholder="自由にメモを入力..."
          rows={4}
          className="w-full text-sm border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 text-slate-700 placeholder-slate-300"
        />
      </div>
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
