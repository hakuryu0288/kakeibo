'use client'

import { useEffect, useState } from 'react'
import { Transaction, CalendarMemo } from '@/lib/supabase'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getDaysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function getFirstDayOfWeek(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).getDay()
}

export default function CalendarPage() {
  const [month, setMonth] = useState(currentMonth())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [memos, setMemos] = useState<CalendarMemo[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [memoInput, setMemoInput] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
      fetch(`/api/calendar-memos?month=${month}`).then((r) => r.json()),
    ]).then(([txns, mms]) => {
      setTransactions(Array.isArray(txns) ? txns : [])
      setMemos(Array.isArray(mms) ? mms : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchData() }, [month])

  const days = getDaysInMonth(month)
  const firstDay = getFirstDayOfWeek(month)
  const [year, mon] = month.split('-')

  // 日付ごとの収支集計
  const byDate: Record<string, { income: number; expense: number }> = {}
  transactions.forEach((t) => {
    if (!byDate[t.date]) byDate[t.date] = { income: 0, expense: 0 }
    if (t.type === 'income') byDate[t.date].income += t.amount
    else byDate[t.date].expense += t.amount
  })

  // 日付ごとのメモ
  const memoByDate: Record<string, CalendarMemo> = {}
  memos.forEach((m) => { memoByDate[m.date] = m })

  const selectedTxns = selectedDate ? transactions.filter((t) => t.date === selectedDate) : []
  const selectedMemo = selectedDate ? memoByDate[selectedDate] : null

  const saveMemo = async () => {
    if (!selectedDate) return
    await fetch('/api/calendar-memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, memo: memoInput }),
    })
    setMemoInput('')
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">カレンダー</h1>
        <div className="flex gap-2 items-center">
          <button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() - 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setSelectedDate(null) }} className="p-1 rounded hover:bg-slate-200">◀</button>
          <span className="text-sm font-medium">{year}年{mon}月</span>
          <button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setSelectedDate(null) }} className="p-1 rounded hover:bg-slate-200">▶</button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="bg-white rounded-xl p-3 shadow-sm">
        <div className="grid grid-cols-7 mb-1">
          {['日','月','火','水','木','金','土'].map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1
            const dateStr = `${month}-${String(day).padStart(2, '0')}`
            const data = byDate[dateStr]
            const hasMemo = !!memoByDate[dateStr]
            const isSelected = selectedDate === dateStr
            const dow = (firstDay + i) % 7
            return (
              <button key={day} onClick={() => { setSelectedDate(isSelected ? null : dateStr); setMemoInput(memoByDate[dateStr]?.memo ?? '') }}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-slate-50'}`}>
                <span className={`font-medium ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700'}`}>{day}</span>
                {data?.expense ? <span className="text-red-400 text-[9px] leading-tight">-{Math.floor(data.expense / 1000)}k</span> : null}
                {data?.income ? <span className="text-green-400 text-[9px] leading-tight">+{Math.floor(data.income / 1000)}k</span> : null}
                {hasMemo && <span className="w-1 h-1 bg-indigo-400 rounded-full mt-0.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* 選択日の詳細 */}
      {selectedDate && (
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">{selectedDate.replace('-', '年').replace('-', '月')}日</h2>

          {/* メモ */}
          <div>
            <label className="text-xs text-slate-500">メモ</label>
            <div className="flex gap-2 mt-1">
              <input type="text" value={memoInput} onChange={(e) => setMemoInput(e.target.value)}
                placeholder="メモを入力" className="flex-1 border border-slate-200 rounded-lg p-2 text-sm" />
              <button onClick={saveMemo} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">保存</button>
            </div>
            {selectedMemo?.memo && <p className="text-xs text-slate-400 mt-1">現在: {selectedMemo.memo}</p>}
          </div>

          {/* 当日の取引 */}
          {selectedTxns.length === 0 ? (
            <p className="text-xs text-slate-400">この日の取引なし</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {selectedTxns.map((t) => (
                <div key={t.id} className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-2">
                    <span>{t.categories?.icon ?? '📦'}</span>
                    <span className="text-sm">{t.categories?.name ?? 'その他'}</span>
                    {t.memo && <span className="text-xs text-slate-400">{t.memo}</span>}
                  </div>
                  <span className={`text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{yen(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
