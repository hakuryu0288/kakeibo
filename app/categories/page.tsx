'use client'

import { useEffect, useState } from 'react'
import type { Category } from '@/lib/supabase'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6b7280',
]

const ICONS = ['💼','💻','🎁','🍽️','🏠','⚡','📱','🚃','🎮','🏥','👕','📈','📦','☕','🛒','🐾','✈️','🎓','💊','🏋️']

function formatYen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

type FormState = {
  id?: string
  name: string
  type: 'income' | 'expense'
  budget_limit: string
  color: string
  icon: string
}

const defaultForm: FormState = {
  name: '',
  type: 'expense',
  budget_limit: '',
  color: '#6366f1',
  icon: '📦',
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchCategories = () => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        setCategories(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }

  useEffect(() => { fetchCategories() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      ...form,
      budget_limit: form.budget_limit ? parseInt(form.budget_limit) : null,
    }
    if (form.id) {
      await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: form.id, ...payload }),
      })
    } else {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setForm(defaultForm)
    setShowForm(false)
    setSubmitting(false)
    fetchCategories()
  }

  const handleEdit = (cat: Category) => {
    setForm({
      id: cat.id,
      name: cat.name,
      type: cat.type,
      budget_limit: cat.budget_limit ? String(cat.budget_limit) : '',
      color: cat.color,
      icon: cat.icon,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このカテゴリを削除しますか？（紐付く取引のカテゴリはなしになります）')) return
    if (form.id === id) { setForm(defaultForm); setShowForm(false) }
    await fetch(`/api/categories?id=${id}`, { method: 'DELETE' })
    fetchCategories()
  }

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  // 並び順を1つ上・下に動かす（収支入力などのプルダウンもこの順番になる）
  const [orderError, setOrderError] = useState(false)
  const handleMove = async (cat: Category, dir: -1 | 1) => {
    const same = categories.filter((c) => c.type === cat.type)
    const i = same.findIndex((c) => c.id === cat.id)
    const j = i + dir
    if (j < 0 || j >= same.length) return
    const moved = [...same]
    ;[moved[i], moved[j]] = [moved[j], moved[i]]
    // APIと同じく「支出 → 収入」の順で全体を組み直して保存する
    const others = categories.filter((c) => c.type !== cat.type)
    const merged = cat.type === 'expense' ? [...moved, ...others] : [...others, ...moved]
    setCategories(merged)
    const res = await fetch('/api/categories/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: merged.map((c) => c.id) }),
    }).catch(() => null)
    setOrderError(!res || !res.ok)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">カテゴリ設定</h1>
        <button
          onClick={() => { setForm(defaultForm); setShowForm(true) }}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
        >＋ 追加</button>
      </div>

      {/* 編集フォーム */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">{form.id ? 'カテゴリ編集' : '新しいカテゴリ'}</h2>

          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'expense' })}
              className={`flex-1 py-2 text-sm font-medium ${form.type === 'expense' ? 'bg-red-500 text-white' : 'text-slate-500'}`}
            >支出</button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'income' })}
              className={`flex-1 py-2 text-sm font-medium ${form.type === 'income' ? 'bg-green-500 text-white' : 'text-slate-500'}`}
            >収入</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">カテゴリ名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
                required
                placeholder="例：食費"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">予算上限（円・任意）</label>
              <input
                type="number"
                value={form.budget_limit}
                onChange={(e) => setForm({ ...form, budget_limit: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
                placeholder="50000"
                min={0}
              />
            </div>
          </div>

          {/* アイコン選択 */}
          <div>
            <label className="text-xs text-slate-500">アイコン</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm({ ...form, icon })}
                  className={`text-xl p-1 rounded-lg transition-colors ${form.icon === icon ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-slate-100'}`}
                >{icon}</button>
              ))}
            </div>
          </div>

          {/* カラー選択 */}
          <div>
            <label className="text-xs text-slate-500">カラー</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
            <span className="text-xl">{form.icon}</span>
            <span className="text-sm font-medium">{form.name || 'カテゴリ名'}</span>
            <span className="w-3 h-3 rounded-full ml-auto" style={{ backgroundColor: form.color }} />
            {form.budget_limit && (
              <span className="text-xs text-slate-400">上限 {formatYen(parseInt(form.budget_limit))}</span>
            )}
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
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400">読み込み中...</div>
      ) : (
        <>
          {orderError && (
            <p className="text-xs text-red-500 text-center">並び順を保存できませんでした。もう一度試してください</p>
          )}
          <p className="text-xs text-slate-400">▲▼ で並び順を変えられます。収支入力などの選択肢もこの順番になります。</p>
          {/* 支出カテゴリ */}
          <Section title="支出カテゴリ" categories={expenseCategories} onEdit={handleEdit} onDelete={handleDelete} onMove={handleMove} />
          {/* 収入カテゴリ */}
          <Section title="収入カテゴリ" categories={incomeCategories} onEdit={handleEdit} onDelete={handleDelete} onMove={handleMove} />
        </>
      )}
    </div>
  )
}

function Section({
  title,
  categories,
  onEdit,
  onDelete,
  onMove,
}: {
  title: string
  categories: Category[]
  onEdit: (cat: Category) => void
  onDelete: (id: string) => void
  onMove: (cat: Category, dir: -1 | 1) => void
}) {
  if (categories.length === 0) return null
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {categories.map((cat, i) => (
          <div key={cat.id} className="flex items-center pl-2 pr-4 py-3 gap-3">
            {/* 並び替え */}
            <div className="flex flex-col shrink-0">
              <button
                onClick={() => onMove(cat, -1)}
                disabled={i === 0}
                className="w-7 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-600 disabled:opacity-20 text-xs"
                aria-label={`${cat.name}を上へ`}
              >▲</button>
              <button
                onClick={() => onMove(cat, 1)}
                disabled={i === categories.length - 1}
                className="w-7 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-600 disabled:opacity-20 text-xs"
                aria-label={`${cat.name}を下へ`}
              >▼</button>
            </div>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
            <span className="text-lg">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{cat.name}</p>
              {cat.budget_limit && (
                <p className="text-xs text-slate-400">
                  予算上限: {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(cat.budget_limit)}
                </p>
              )}
            </div>
            <button onClick={() => onEdit(cat)} className="text-indigo-500 text-sm px-2 py-1 hover:bg-indigo-50 rounded">編集</button>
            <button onClick={() => onDelete(cat.id)} className="text-red-400 text-sm px-2 py-1 hover:bg-red-50 rounded">削除</button>
          </div>
        ))}
      </div>
    </div>
  )
}
