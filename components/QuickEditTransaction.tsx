'use client'

import { useState } from 'react'
import type { Category } from '@/lib/supabase'
import AmountSteps, { addAmount } from '@/components/AmountSteps'

export type QuickEditable = {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  category_id?: string | null
  memo: string | null
}

// ホームの「最近登録した取引」をその場で直すための小さな編集欄
export default function QuickEditTransaction({
  txn,
  categories,
  onSaved,
  onCancel,
}: {
  txn: QuickEditable
  categories: Category[]
  onSaved: (updated: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(txn.date)
  const [amount, setAmount] = useState(String(txn.amount))
  const [categoryId, setCategoryId] = useState(txn.category_id ?? '')
  const [memo, setMemo] = useState(txn.memo ?? '')
  const [saving, setSaving] = useState(false)
  const isTransfer = txn.type === 'transfer'

  const save = async () => {
    const n = parseInt(amount)
    if (isNaN(n) || n <= 0 || !date) return
    setSaving(true)
    const body: Record<string, unknown> = { id: txn.id, date, amount: n, memo }
    if (!isTransfer) body.category_id = categoryId || null
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    setSaving(false)
    if (!res || !res.ok) {
      alert('保存できませんでした')
      return
    }
    const updated = await res.json().catch(() => null)
    // デモモードでは更新後の取引が返らないので、手元の値で反映する
    const cat = categories.find((c) => c.id === categoryId)
    onSaved(updated && updated.id === txn.id && updated.date
      ? updated
      : { ...body, memo: memo.trim() || null, categories: isTransfer ? undefined : cat })
  }

  return (
    <div className="space-y-2 py-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-indigo-300 rounded-lg px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
          className="border border-indigo-300 rounded-lg px-2 py-1.5 text-sm text-right"
          min={1}
        />
      </div>
      <AmountSteps compact onAdd={(n) => setAmount((a) => addAmount(a, n))} onClear={() => setAmount('')} />
      {!isTransfer && (
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-sm bg-white"
        >
          <option value="">カテゴリなし</option>
          {categories.filter((c) => c.type === txn.type).map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      )}
      <input
        type="text"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
        placeholder="メモ"
        className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600">キャンセル</button>
        <button onClick={save} disabled={saving} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
