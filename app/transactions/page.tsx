'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Transaction, Category, CreditCard, BankAccount, PointBalance } from '@/lib/supabase'
import AmountSteps, { addAmount } from '@/components/AmountSteps'
import { EMPTY_DEFAULTS, normalizeDefaults, type InputDefaults } from '@/lib/input-defaults'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// "2026-09-23" → "9/23(水)"
function labelDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

// 支払い方法を1つの文字列で表す（"cash" / "card:<id>" / "points:<id>" / "bank:<id>"）
function paymentKey(t: Transaction) {
  if (t.credit_card_id) return `card:${t.credit_card_id}`
  if (t.point_balance_id) return `points:${t.point_balance_id}`
  if (t.bank_account_id) return `bank:${t.bank_account_id}`
  return 'cash'
}

function paymentPayload(key: string) {
  const [kind, id] = key.split(':')
  return {
    credit_card_id: kind === 'card' ? id : null,
    point_balance_id: kind === 'points' ? id : null,
    bank_account_id: kind === 'bank' ? id : null,
  }
}

type EntryForm = {
  date: string
  amount: string
  type: 'income' | 'expense'
  category_id: string
  credit_card_id: string
  bank_account_id: string
  point_balance_id: string
  payment: 'cash' | 'card' | 'bank'
  memo: string
}

// 入力欄の初期状態（マスタ設定の「入力の初期値」を使う。削除済みのカード・口座・カテゴリは使わない）
function blankForm(
  type: 'income' | 'expense',
  d: InputDefaults,
  lists: { cards: CreditCard[]; accounts: BankAccount[]; categories: Category[] },
): EntryForm {
  const has = <T extends { id: string }>(arr: T[], id: string | null) => (id && arr.some((x) => x.id === id) ? id : '')
  if (type === 'expense') {
    return {
      date: today(), amount: '', type, memo: '', point_balance_id: '',
      payment: d.expense_payment,
      credit_card_id: d.expense_payment === 'card' ? has(lists.cards, d.card_id) : '',
      bank_account_id: d.expense_payment === 'bank' ? has(lists.accounts, d.bank_account_id) : '',
      category_id: has(lists.categories.filter((c) => c.type === 'expense'), d.expense_category_id),
    }
  }
  return {
    date: today(), amount: '', type, memo: '', point_balance_id: '', credit_card_id: '',
    payment: d.income_destination,
    bank_account_id: d.income_destination === 'bank' ? has(lists.accounts, d.income_bank_account_id) : '',
    category_id: has(lists.categories.filter((c) => c.type === 'income'), d.income_category_id),
  }
}

// 日付内の並び順（registered = 登録した順（新しい登録が上） / amount = 金額が大きい順）
type SortMode = 'registered' | 'amount'
const SORT_KEY = 'kakeibo-txn-sort'

export default function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [points, setPoints] = useState<PointBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const [editPayment, setEditPayment] = useState('cash')
  const [editCategory, setEditCategory] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>(() =>
    typeof window !== 'undefined' && localStorage.getItem(SORT_KEY) === 'amount' ? 'amount' : 'registered'
  )

  const [defaults, setDefaults] = useState<InputDefaults>(EMPTY_DEFAULTS)
  const [form, setForm] = useState<EntryForm>(() => blankForm('expense', EMPTY_DEFAULTS, { cards: [], accounts: [], categories: [] }))
  const lists = { cards, accounts, categories }

  // silent=true のときは「読み込み中」を出さずに裏で取り直す（スクロール位置を保つ）
  const fetchData = (silent = false) => {
    if (!silent) setLoading(true)
    Promise.all([
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/point-balances').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()).catch(() => null),
    ]).then(([txns, cats, cds, accs, pts, st]) => {
      const nextLists = {
        categories: Array.isArray(cats) ? cats : [],
        cards: Array.isArray(cds) ? cds : [],
        accounts: Array.isArray(accs) ? accs : [],
      }
      const d = normalizeDefaults(st)
      setTransactions(Array.isArray(txns) ? txns : [])
      setCategories(nextLists.categories)
      setCards(nextLists.cards)
      setAccounts(nextLists.accounts)
      setPoints(Array.isArray(pts) ? pts : [])
      setDefaults(d)
      // まだ何も入力していなければ、初期値を入れる
      setForm((f) => (f.amount === '' && f.memo === '' ? { ...blankForm(f.type, d, nextLists), date: f.date } : f))
      setLoading(false)
    })
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [month])

  // ホームの「収支を入力する」から来たとき（?new=1）は入力欄を最初から開く。
  // ?new=1 はURLに残さない（再読み込みで入力欄が開き直さないように）
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowForm(true)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const filteredCategories = categories.filter((c) => c.type === form.type)

  const handleTypeChange = (type: 'income' | 'expense') => {
    // 金額・日付・メモはそのまま、支払い方法とカテゴリだけ初期値に切り替える
    setForm({ ...blankForm(type, defaults, lists), date: form.date, amount: form.amount, memo: form.memo })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || !form.date) return
    setSubmitting(true)

    const payload = {
      date: form.date,
      amount: parseInt(form.amount),
      type: form.type,
      category_id: form.category_id || null,
      memo: form.memo || null,
      credit_card_id: form.type === 'expense' && form.payment === 'card' ? form.credit_card_id || null : null,
      // 銀行は収入の入金先にも、支出の支払い元にも使える
      bank_account_id: form.payment === 'bank' ? form.bank_account_id || null : null,
      point_balance_id: null,
    }

    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setForm(blankForm('expense', defaults, lists))
    setShowForm(false)
    setSubmitting(false)
    fetchData(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この取引を削除しますか？')) return
    const res = await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })
    if (res.ok) setTransactions((prev) => prev.filter((t) => t.id !== id))
    else fetchData(true)
  }

  // 1件の更新結果を画面に反映する（一覧全体は読み直さない）
  const applyUpdated = async (id: string, res: Response, fallback: Partial<Transaction>) => {
    if (!res.ok) { fetchData(true); return }
    const body = await res.json().catch(() => null)
    // サーバーが更新後の取引を返したらそれを使う（デモモードでは返らないので手元の値で更新）
    const updated: Transaction | null = body && body.id === id && body.date ? body : null
    setTransactions((prev) => prev
      .map((t) => (t.id === id ? (updated ?? { ...t, ...fallback }) : t))
      // 日付を別の月に変えたら、この月の一覧からは外す
      .filter((t) => t.date.slice(0, 7) === month))
  }

  const handleEditSave = async (id: string) => {
    const amount = parseInt(editAmount)
    if (isNaN(amount) || amount <= 0) return
    const txn = transactions.find((t) => t.id === id)
    // 振替は支払い方法・カテゴリを持たないので送らない
    const extra = txn && txn.type !== 'transfer'
      ? { category_id: editCategory || null, ...paymentPayload(editPayment) }
      : {}
    setEditingId(null)
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, amount, date: editDate, memo: editMemo, ...extra }),
    })
    await applyUpdated(id, res, { amount, date: editDate, memo: editMemo.trim() || null })
  }

  // 取引のカテゴリを後から変更する
  const handleCategoryChange = async (id: string, categoryId: string) => {
    // 先に画面だけ変えておく（保存を待たずに次の操作ができるように）
    const cat = categories.find((c) => c.id === categoryId)
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, category_id: categoryId || null, categories: cat } : t)))
    const res = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, category_id: categoryId || null }),
    })
    await applyUpdated(id, res, {})
  }

  const cardUsage = cards.map((card) => ({
    card,
    total: transactions
      .filter((t) => t.type === 'expense' && t.credit_card_id === card.id)
      .reduce((s, t) => s + t.amount, 0),
  })).filter((c) => c.total > 0)

  const changeSort = (mode: SortMode) => {
    setSortMode(mode)
    localStorage.setItem(SORT_KEY, mode)
  }

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
  // 並び替えは日付の中だけで行う（日付の区切りはそのまま）
  for (const g of groups) {
    g.items.sort((a, b) =>
      sortMode === 'amount'
        ? b.amount - a.amount
        : b.created_at.localeCompare(a.created_at)
    )
  }

  const [year, mon] = month.split('-')

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">収支一覧</h1>
        <div className="flex gap-2 items-center">
          <button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() - 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }} className="p-1 rounded hover:bg-slate-200">◀</button>
          <span className="text-sm font-medium">{year}年{mon}月</span>
          <button onClick={() => { const d = new Date(`${month}-01`); d.setMonth(d.getMonth() + 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }} className="p-1 rounded hover:bg-slate-200">▶</button>
        </div>
      </div>

      {/* カード使用額 */}
      {cardUsage.length > 0 && (
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2">カード今月使用額</p>
          <div className="space-y-1">
            {cardUsage.map(({ card, total }) => (
              <div key={card.id} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                  <span className="text-xs text-slate-600">{card.name}</span>
                </div>
                <span className="text-xs font-bold text-red-600">{yen(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 入力フォーム */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">収支入力</h2>
            <Link href="/settings?tab=defaults" className="text-xs text-slate-400 hover:text-indigo-600">初期値を変える</Link>
          </div>

          {/* 収入/支出切り替え */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button type="button" onClick={() => handleTypeChange('expense')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-red-500 text-white' : 'text-slate-500'}`}>
              支出
            </button>
            <button type="button" onClick={() => handleTypeChange('income')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-green-500 text-white' : 'text-slate-500'}`}>
              収入
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">日付</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" required />
            </div>
            <div>
              <label className="text-xs text-slate-500">金額（円）</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" required min={1} inputMode="numeric" />
            </div>
          </div>

          {/* 金額をタップで足していくボタン（キーボードを出さずに入力できる） */}
          <div className="-mt-1">
            <AmountSteps
              onAdd={(n) => setForm((f) => ({ ...f, amount: addAmount(f.amount, n) }))}
              onClear={() => setForm((f) => ({ ...f, amount: '' }))}
            />
          </div>

          {/* 支払い方法 */}
          {form.type === 'expense' ? (
            <div>
              <label className="text-xs text-slate-500">支払い方法</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <button type="button" onClick={() => setForm({ ...form, payment: 'cash', credit_card_id: '', bank_account_id: '' })}
                  className={`py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'cash' ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500'}`}>
                  💴 現金
                </button>
                <button type="button" onClick={() => setForm({ ...form, payment: 'card', bank_account_id: '' })}
                  className={`py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'card' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-500'}`}>
                  💳 カード
                </button>
                <button type="button" onClick={() => setForm({ ...form, payment: 'bank', credit_card_id: '', bank_account_id: form.bank_account_id || (accounts.length === 1 ? accounts[0].id : '') })}
                  className={`py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'bank' ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-500'}`}>
                  🏦 銀行
                </button>
              </div>
              {form.payment === 'card' && (
                <select value={form.credit_card_id} onChange={(e) => setForm({ ...form, credit_card_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-2">
                  <option value="">カードを選択</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {form.payment === 'bank' && (
                <select value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-2" required>
                  <option value="">口座を選択</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}（残高 {yen(Number(a.balance))}）</option>)}
                </select>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-500">入金先</label>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setForm({ ...form, payment: 'cash', bank_account_id: '' })}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'cash' ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500'}`}>
                  💴 現金
                </button>
                <button type="button" onClick={() => setForm({ ...form, payment: 'bank' })}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${form.payment === 'bank' ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-500'}`}>
                  🏦 銀行口座
                </button>
              </div>
              {form.payment === 'bank' && (
                <select value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-2">
                  <option value="">口座を選択</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500">カテゴリ</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1">
              <option value="">カテゴリなし</option>
              {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">メモ（任意）</label>
            <input type="text" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="メモを入力" className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">キャンセル</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition-colors">
          ＋ 収支を入力する
        </button>
      )}

      {/* 取引一覧 */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">読み込み中...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-slate-400">この月の取引はありません</div>
      ) : (
        <div className="space-y-3">
          {/* 日付内の並び替え */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">全{transactions.length}件</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-white">
              <button
                onClick={() => changeSort('registered')}
                className={`px-3 py-1 text-xs transition-colors ${sortMode === 'registered' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-500'}`}
              >
                登録した順
              </button>
              <button
                onClick={() => changeSort('amount')}
                className={`px-3 py-1 text-xs transition-colors ${sortMode === 'amount' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-500'}`}
              >
                金額が大きい順
              </button>
            </div>
          </div>

          {groups.map((g) => (
          <div key={g.date} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* 日付の見出し（日別の小計つき） */}
            <div className="flex justify-between items-center bg-slate-50 px-4 py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-600">{labelDate(g.date)}</span>
              <span className="text-xs">
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
              <div key={t.id}>
              <div className="flex items-center justify-between px-4 py-3 gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl">{isTransfer ? '🔁' : t.categories?.icon ?? '📦'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{isTransfer ? (t.transfer_direction === 'withdraw' ? '引き出し（銀行→現金）' : '預け入れ（現金→銀行）') : (t.categories?.name ?? 'その他')}</p>
                    {/* 支払い先とメモは行を分ける（スマホでメモが見切れるため）。日付は見出しに出している */}
                    <p className="text-xs text-slate-400 truncate">{payLabel}</p>
                    {editingId === t.id ? (
                      <div className="space-y-1 mt-1">
                      {!isTransfer && (
                        <>
                          <select
                            value={editPayment}
                            onChange={(e) => setEditPayment(e.target.value)}
                            className="w-full border border-indigo-300 rounded-lg px-1 py-0.5 text-xs bg-white"
                          >
                            <option value="cash">💴 現金</option>
                            {t.type === 'expense' ? (
                              <>
                                {cards.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.name}</option>)}
                                {accounts.map((a) => <option key={a.id} value={`bank:${a.id}`}>🏦 {a.name}</option>)}
                                {/* ポイント払いは新規には選べない。過去にポイントで払った取引だけ、そのまま残せるようにする */}
                                {points.filter((p) => p.id === t.point_balance_id).map((p) => <option key={p.id} value={`points:${p.id}`}>⭐ {p.name}</option>)}
                              </>
                            ) : (
                              accounts.map((a) => <option key={a.id} value={`bank:${a.id}`}>🏦 {a.name}</option>)
                            )}
                          </select>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full border border-indigo-300 rounded-lg px-1 py-0.5 text-xs bg-white"
                          >
                            <option value="">カテゴリなし</option>
                            {categories.filter((c) => c.type === t.type).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                          </select>
                        </>
                      )}
                      <input
                        type="text"
                        value={editMemo}
                        onChange={(e) => setEditMemo(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(t.id); if (e.key === 'Escape') setEditingId(null) }}
                        placeholder="備考を入力"
                        className="w-full border border-indigo-300 rounded-lg px-2 py-0.5 text-xs"
                      />
                      </div>
                    ) : t.memo && (
                      <p className="text-xs text-slate-500 break-words">📝 {t.memo}</p>
                    )}
                    {!isTransfer && editingId !== t.id && (
                      <select
                        value={t.category_id ?? ''}
                        onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                        className="text-xs border border-slate-100 rounded px-1 py-0.5 bg-slate-50 text-slate-500 mt-1 max-w-full"
                      >
                        <option value="">カテゴリなし</option>
                        {categories.filter((c) => c.type === t.type).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === t.id ? (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-36 border border-indigo-300 rounded-lg px-2 py-0.5 text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(t.id); if (e.key === 'Escape') setEditingId(null) }}
                          className="w-24 border border-indigo-300 rounded-lg px-2 py-0.5 text-sm text-right"
                          inputMode="numeric"
                          min={1}
                        />
                        <button onClick={() => handleEditSave(t.id)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-1">保存</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-300 hover:text-slate-500 text-lg leading-none">×</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={`text-sm font-bold ${isTransfer ? 'text-indigo-600' : t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {cashIncreases ? '+' : '-'}{yen(t.amount)}
                      </span>
                      <button onClick={() => { setEditingId(t.id); setEditAmount(String(t.amount)); setEditDate(t.date); setEditMemo(t.memo ?? ''); setEditPayment(paymentKey(t)); setEditCategory(t.category_id ?? '') }} className="text-slate-300 hover:text-indigo-400 text-sm leading-none px-0.5">✏</button>
                      <button onClick={() => handleDelete(t.id)} className="text-slate-300 hover:text-red-400 text-lg leading-none">×</button>
                    </>
                  )}
                </div>
              </div>
              {/* 修正中は金額の「足す」ボタンを行の下に横いっぱいで出す */}
              {editingId === t.id && (
                <div className="px-4 pb-3 -mt-1">
                  <AmountSteps compact onAdd={(n) => setEditAmount((a) => addAmount(a, n))} onClear={() => setEditAmount('')} />
                </div>
              )}
              </div>
              )
            })}
          </div>
          </div>
          ))}
        </div>
      )}
    </div>
  )
}
