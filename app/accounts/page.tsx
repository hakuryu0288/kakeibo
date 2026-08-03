'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BankAccount, CreditCard, CashBalance, CashMemo, Transaction, ExpectedIncome, CardMonthlyOverride, MonthlyClosing, Category } from '@/lib/supabase'

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

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function AccountsPage() {
  const today = currentMonth()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cash, setCash] = useState<CashBalance | null>(null)
  const [cashMemos, setCashMemos] = useState<CashMemo[]>([])
  const [cardTabTxns, setCardTabTxns] = useState<Transaction[]>([])
  const [cardOverrides, setCardOverrides] = useState<CardMonthlyOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'card' | 'cash' | 'income'>('card')

  const [cardMonth, setCardMonth] = useState(today)
  const [cardMonthYear, cardMonthMon] = cardMonth.split('-')

  const [cashAmount, setCashAmount] = useState('')
  const [cashMemo, setCashMemo] = useState('')

  // 銀行⇔現金 振替
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [transferForm, setTransferForm] = useState({ direction: 'withdraw' as 'withdraw' | 'deposit', bank_account_id: '', amount: '', date: todayStr() })

  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [overrideInput, setOverrideInput] = useState('')

  const [editingTxnId, setEditingTxnId] = useState<string | null>(null)
  const [txnAmountInput, setTxnAmountInput] = useState('')

  // 現金タブ
  const [cashMonth, setCashMonth] = useState(today)
  const [cashTxns, setCashTxns] = useState<Transaction[]>([])
  const [cashMonthYear, cashMonthMon] = cashMonth.split('-')
  const [editingCashTxnId, setEditingCashTxnId] = useState<string | null>(null)
  const [editCashAmount, setEditCashAmount] = useState('')
  const [editCashDate, setEditCashDate] = useState('')

  // 給料タブ
  const [incomes, setIncomes] = useState<ExpectedIncome[]>([])
  const [incomeForm, setIncomeForm] = useState({ month: currentMonth(), amount: '', description: '', bank_account_id: '' })
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [editIncomeForm, setEditIncomeForm] = useState({ month: '', amount: '', description: '', bank_account_id: '' })
  // 月次処理
  const [monthlyClosings, setMonthlyClosings] = useState<MonthlyClosing[]>([])
  const [processingMonth, setProcessingMonth] = useState(currentMonth())
  const [preview, setPreview] = useState<MonthlyClosing['snapshot'] | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isRunningProcess, setIsRunningProcess] = useState(false)
  const [undoConfirm, setUndoConfirm] = useState(false)

  const fetchAll = () => {
    Promise.all([
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/cash').then((r) => r.json()),
      fetch('/api/cash-memos').then((r) => r.json()),
      fetch('/api/expected-income').then((r) => r.json()),
      fetch('/api/monthly-closings').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([b, c, ca, cm, ei, mc, cats]) => {
      setAccounts(Array.isArray(b) ? b : [])
      setCards(Array.isArray(c) ? c : [])
      setCash(ca?.id ? ca : null)
      setCashMemos(Array.isArray(cm) ? cm : [])
      setIncomes(Array.isArray(ei) ? ei : [])
      setMonthlyClosings(Array.isArray(mc) ? mc : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setLoading(false)
    })
  }

  const fetchCardTabData = () => {
    Promise.all([
      fetch(`/api/transactions?month=${cardMonth}`).then((r) => r.json()),
      fetch(`/api/card-monthly-overrides?month=${cardMonth}`).then((r) => r.json()),
    ]).then(([txns, overrides]) => {
      setCardTabTxns(Array.isArray(txns) ? txns.filter((t: Transaction) => t.type === 'expense') : [])
      setCardOverrides(Array.isArray(overrides) ? overrides : [])
    })
  }

  const fetchCashTabData = () => {
    fetch(`/api/transactions?month=${cashMonth}`).then((r) => r.json()).then((txns) => {
      const all: Transaction[] = Array.isArray(txns) ? txns : []
      setCashTxns(all.filter((t) =>
        t.type === 'transfer' || (t.credit_card_id === null && t.bank_account_id === null && t.point_balance_id === null)
      ))
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCardTabData() }, [cardMonth])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCashTabData() }, [cashMonth])

  const saveCash = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cash) return
    await fetch('/api/cash', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cash.id, amount: parseInt(cashAmount) }) })
    setCashAmount('')
    fetchAll()
  }

  const saveTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferForm.bank_account_id || !transferForm.amount) return
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: transferForm.date,
        amount: parseInt(transferForm.amount),
        type: 'transfer',
        transfer_direction: transferForm.direction,
        bank_account_id: transferForm.bank_account_id,
        category_id: null,
        memo: null,
      }),
    })
    setTransferForm({ direction: 'withdraw', bank_account_id: '', amount: '', date: todayStr() })
    setShowTransferForm(false)
    fetchAll()
    fetchCashTabData()
  }

  const addCashMemo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashMemo.trim()) return
    await fetch('/api/cash-memos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: cashMemo }) })
    setCashMemo('')
    fetchAll()
  }

  const deleteCashMemo = async (id: string) => {
    await fetch(`/api/cash-memos?id=${id}`, { method: 'DELETE' })
    fetchAll()
  }

  const updateTxnAmount = async (txnId: string) => {
    const amount = parseInt(txnAmountInput)
    if (isNaN(amount) || amount <= 0) return
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: txnId, amount }),
    })
    setEditingTxnId(null)
    setTxnAmountInput('')
    fetchCardTabData()
    fetchCashTabData()
  }

  const saveCashTxnEdit = async (txnId: string) => {
    const amount = parseInt(editCashAmount)
    if (isNaN(amount) || amount <= 0) return
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: txnId, amount, date: editCashDate }),
    })
    setEditingCashTxnId(null)
    fetchCashTabData()
  }

  const changeCashTxnCategory = async (txnId: string, categoryId: string) => {
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: txnId, category_id: categoryId || null }),
    })
    fetchCashTabData()
  }

  const deleteCashTxn = async (txnId: string) => {
    if (!confirm('この取引を削除しますか？')) return
    await fetch(`/api/transactions?id=${txnId}`, { method: 'DELETE' })
    fetchCashTabData()
  }

  const saveOverride = async (cardId: string) => {
    const amount = parseInt(overrideInput)
    if (isNaN(amount)) return
    await fetch('/api/card-monthly-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credit_card_id: cardId, month: cardMonth, override_amount: amount }),
    })
    setEditingCardId(null)
    setOverrideInput('')
    fetchCardTabData()
  }

  const deleteOverride = async (id: string) => {
    await fetch(`/api/card-monthly-overrides?id=${id}`, { method: 'DELETE' })
    fetchCardTabData()
  }

  // 給料操作
  const saveIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/expected-income', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: incomeForm.month, amount: parseInt(incomeForm.amount), description: incomeForm.description || null, bank_account_id: incomeForm.bank_account_id || null }) })
    setIncomeForm({ month: currentMonth(), amount: '', description: '', bank_account_id: '' })
    setShowIncomeForm(false)
    fetchAll()
  }

  const deleteIncome = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch(`/api/expected-income?id=${id}`, { method: 'DELETE' })
    fetchAll()
  }

  const startEditIncome = (inc: ExpectedIncome) => {
    setEditingIncomeId(inc.id)
    setEditIncomeForm({
      month: inc.month,
      amount: String(inc.amount),
      description: inc.description ?? '',
      bank_account_id: inc.bank_account_id ?? '',
    })
  }

  const saveEditIncome = async () => {
    if (!editingIncomeId) return
    const amount = parseInt(editIncomeForm.amount)
    if (isNaN(amount) || amount <= 0) return
    await fetch('/api/expected-income', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingIncomeId,
        amount,
        month: editIncomeForm.month,
        description: editIncomeForm.description || null,
        bank_account_id: editIncomeForm.bank_account_id || null,
      }),
    })
    setEditingIncomeId(null)
    fetchAll()
  }

  const loadPreview = async () => {
    setIsLoadingPreview(true)
    const data = await fetch(`/api/monthly-closings?month=${processingMonth}&preview=true`).then((r) => r.json())
    setPreview(data)
    setShowPreview(true)
    setIsLoadingPreview(false)
  }

  const runMonthlyProcess = async () => {
    setIsRunningProcess(true)
    await fetch('/api/monthly-closings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: processingMonth }),
    })
    setShowPreview(false)
    setPreview(null)
    setIsRunningProcess(false)
    fetchAll()
  }

  const undoMonthlyProcess = async () => {
    await fetch(`/api/monthly-closings?month=${processingMonth}`, { method: 'DELETE' })
    setUndoConfirm(false)
    fetchAll()
  }

  const [processingYear, processingMon] = processingMonth.split('-')
  const currentClosing = monthlyClosings.find((c) => c.month === processingMonth) ?? null

  const totalCardUsage = cards.reduce((sum, card) => {
    const txnTotal = cardTabTxns.filter((t) => t.credit_card_id === card.id).reduce((s, t) => s + t.amount, 0)
    const override = cardOverrides.find((o) => o.credit_card_id === card.id)
    return sum + (override ? override.override_amount : txnTotal)
  }, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">カード・現金・給料</h1>

      <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white">
        {(['card', 'cash', 'income'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
            {t === 'card' ? '💳 クレカ' : t === 'cash' ? '💴 現金' : '💰 給料'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-slate-400">読み込み中...</div> : (
        <>
          {/* クレカタブ */}
          {tab === 'card' && (
            <div className="space-y-4">
              {/* 月ナビゲーション */}
              <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
                <button
                  onClick={() => setCardMonth((m) => shiftMonth(m, -1))}
                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg text-lg"
                >‹</button>
                <span className="text-sm font-medium text-slate-600">{cardMonthYear}年{cardMonthMon}月</span>
                <button
                  onClick={() => { const next = shiftMonth(cardMonth, 1); if (next <= today) setCardMonth(next) }}
                  disabled={cardMonth >= today}
                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg text-lg disabled:opacity-30"
                >›</button>
              </div>

              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-xs text-indigo-600">
                  {cardMonth === today ? '今月' : `${cardMonthMon}月`}のクレカ合計使用額
                </p>
                <p className="text-xl font-bold text-red-600">{yen(totalCardUsage)}</p>
              </div>

              {cards.map((card) => {
                const txnsForCard = cardTabTxns.filter((t) => t.credit_card_id === card.id)
                const txnTotal = txnsForCard.reduce((s, t) => s + t.amount, 0)
                const override = cardOverrides.find((o) => o.credit_card_id === card.id)
                const displayAmount = override ? override.override_amount : txnTotal
                const diff = override ? override.override_amount - txnTotal : 0
                const isEditing = editingCardId === card.id

                return (
                  <div key={card.id} className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ borderLeft: `4px solid ${card.color}` }}>
                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">💳 {card.name}</p>
                          <p className="text-xs text-slate-400">締め日: {card.closing_day}日　引き落とし: {card.billing_day}日</p>
                          {card.bank_accounts && (
                            <p className="text-xs text-slate-400">引き落とし口座: {card.bank_accounts.name}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">使用額</p>
                          <p className={`text-lg font-bold ${displayAmount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{yen(displayAmount)}</p>
                          {override && (
                            <p className="text-xs text-slate-400">履歴: {yen(txnTotal)}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {txnsForCard.length > 0 ? (
                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {txnsForCard.map((t) => (
                          <div key={t.id} className="flex justify-between items-center px-4 py-2 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{t.categories?.icon ?? '📦'}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium">{t.categories?.name ?? 'その他'}</p>
                                <p className="text-xs text-slate-400 truncate">{t.date}{t.memo ? '　' + t.memo : ''}</p>
                              </div>
                            </div>
                            {editingTxnId === t.id ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  value={txnAmountInput}
                                  onChange={(e) => setTxnAmountInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') updateTxnAmount(t.id); if (e.key === 'Escape') { setEditingTxnId(null) } }}
                                  className="w-24 border border-indigo-300 rounded px-2 py-0.5 text-sm text-right bg-white"
                                  autoFocus
                                />
                                <button onClick={() => updateTxnAmount(t.id)} className="text-xs text-indigo-600 font-semibold">保存</button>
                                <button onClick={() => setEditingTxnId(null)} className="text-xs text-slate-400">×</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingTxnId(t.id); setTxnAmountInput(String(t.amount)) }}
                                className="text-sm font-bold text-red-600 shrink-0 hover:bg-red-50 rounded px-1"
                              >-{yen(t.amount)}</button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 px-4 py-2 border-t border-slate-100">この月の取引なし</p>
                    )}

                    {/* 手動上書きエリア */}
                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                      {isEditing ? (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-slate-500 whitespace-nowrap">上書き額:</span>
                          <input
                            type="number"
                            value={overrideInput}
                            onChange={(e) => setOverrideInput(e.target.value)}
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') saveOverride(card.id) }}
                          />
                          <button
                            onClick={() => saveOverride(card.id)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                          >保存</button>
                          <button
                            onClick={() => { setEditingCardId(null); setOverrideInput('') }}
                            className="px-2 py-1 text-slate-400 hover:text-slate-600 text-xs"
                          >×</button>
                        </div>
                      ) : override ? (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">手動上書き中</span>
                            <span className={`text-xs font-medium ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                              差異: {diff > 0 ? '+' : ''}{yen(diff)}
                            </span>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => { setEditingCardId(card.id); setOverrideInput(String(override.override_amount)) }}
                              className="text-xs text-indigo-500 hover:underline"
                            >変更</button>
                            <button
                              onClick={() => deleteOverride(override.id)}
                              className="text-xs text-red-400 hover:underline"
                            >解除</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingCardId(card.id); setOverrideInput(String(txnTotal)) }}
                          className="text-xs text-indigo-500 w-full py-0.5 text-center hover:bg-indigo-50 rounded"
                        >✎ 使用額を手動上書き</button>
                      )}
                    </div>
                  </div>
                )
              })}

              {cards.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">カードが登録されていません</p>
              )}

              <Link href="/settings" className="block text-center text-xs text-indigo-500 py-2">
                カードの追加・編集は マスタ設定 から →
              </Link>
            </div>
          )}

          {/* 現金タブ */}
          {tab === 'cash' && (
            <div className="space-y-3">
              <Link
                href="/transactions"
                className="block w-full bg-indigo-600 text-white text-center py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition-colors"
              >
                ＋ 収支を入力する
              </Link>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-slate-500">現在の現金残高</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{yen(cash?.amount ?? 0)}</p>
                <form onSubmit={saveCash} className="flex gap-2 mt-3">
                  <input type="number" placeholder="新しい残高を入力" value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg p-2 text-sm" required />
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">更新</button>
                </form>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">🔁 銀行⇔現金 振替</h2>
                  {!showTransferForm && (
                    <button onClick={() => setShowTransferForm(true)} className="text-xs text-indigo-500 hover:underline">
                      + 振替を入力
                    </button>
                  )}
                </div>
                {showTransferForm && (
                  <form onSubmit={saveTransfer} className="space-y-3 mt-3">
                    <div className="flex rounded-lg overflow-hidden border border-slate-200">
                      <button type="button" onClick={() => setTransferForm({ ...transferForm, direction: 'withdraw' })}
                        className={`flex-1 py-1.5 text-sm font-medium transition-colors ${transferForm.direction === 'withdraw' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                        🏦→💴 引き出し
                      </button>
                      <button type="button" onClick={() => setTransferForm({ ...transferForm, direction: 'deposit' })}
                        className={`flex-1 py-1.5 text-sm font-medium transition-colors ${transferForm.direction === 'deposit' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                        💴→🏦 預け入れ
                      </button>
                    </div>
                    <select value={transferForm.bank_account_id}
                      onChange={(e) => setTransferForm({ ...transferForm, bank_account_id: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-sm" required>
                      <option value="">口座を選択</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input type="date" value={transferForm.date}
                        onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                        className="border border-slate-200 rounded-lg p-2 text-sm" required />
                      <input type="number" placeholder="金額" value={transferForm.amount}
                        onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                        className="flex-1 border border-slate-200 rounded-lg p-2 text-sm" required min={1} />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowTransferForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                      <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">振替を登録</button>
                    </div>
                  </form>
                )}
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">現金メモ</h2>
                <form onSubmit={addCashMemo} className="flex gap-2 mb-3">
                  <input type="text" placeholder="メモを入力" value={cashMemo}
                    onChange={(e) => setCashMemo(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg p-2 text-sm" />
                  <button type="submit" className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm">追加</button>
                </form>
                {cashMemos.length === 0 ? (
                  <p className="text-xs text-slate-400">メモなし</p>
                ) : (
                  <div className="space-y-2">
                    {cashMemos.map((m) => (
                      <div key={m.id} className="flex justify-between items-start gap-2 text-sm">
                        <p className="text-slate-700 flex-1">{m.content}</p>
                        <button onClick={() => deleteCashMemo(m.id)} className="text-slate-300 hover:text-red-400">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 現金収支履歴 */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">現金 収支履歴</h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCashMonth((m) => shiftMonth(m, -1))}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded text-lg"
                    >‹</button>
                    <span className="text-xs text-slate-500 min-w-[60px] text-center">{cashMonthYear}年{cashMonthMon}月</span>
                    <button
                      onClick={() => { const next = shiftMonth(cashMonth, 1); if (next <= today) setCashMonth(next) }}
                      disabled={cashMonth >= today}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded text-lg disabled:opacity-30"
                    >›</button>
                  </div>
                </div>

                {(() => {
                  if (cashTxns.length === 0) {
                    return <p className="text-xs text-slate-400 text-center py-4">この月の現金取引なし</p>
                  }

                  return (
                    <>
                      <div className="divide-y divide-slate-100">
                        {cashTxns.map((t) => {
                          const isTransfer = t.type === 'transfer'
                          const cashIncreases = isTransfer ? t.transfer_direction === 'withdraw' : t.type === 'income'
                          return (
                          <div key={t.id} className="flex justify-between items-start px-4 py-2.5 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{isTransfer ? '🔁' : t.categories?.icon ?? (t.type === 'income' ? '💰' : '💴')}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium">
                                  {isTransfer ? (t.transfer_direction === 'withdraw' ? '引き出し' : '預け入れ') : (t.categories?.name ?? 'その他')}
                                </p>
                                {editingCashTxnId === t.id ? (
                                  <input
                                    type="date"
                                    value={editCashDate}
                                    onChange={(e) => setEditCashDate(e.target.value)}
                                    className="border border-indigo-300 rounded px-1 py-0.5 text-xs mt-0.5"
                                  />
                                ) : (
                                  <p className="text-xs text-slate-400 truncate">
                                    {t.date}
                                    {isTransfer && t.bank_accounts ? `　🏦 ${t.bank_accounts.name}` : ''}
                                    {t.memo ? '　' + t.memo : ''}
                                  </p>
                                )}
                                {!isTransfer && (
                                  <select
                                    value={t.category_id ?? ''}
                                    onChange={(e) => changeCashTxnCategory(t.id, e.target.value)}
                                    className="text-xs border border-slate-100 rounded px-1 py-0.5 bg-slate-50 text-slate-500 mt-1 max-w-full"
                                  >
                                    <option value="">カテゴリなし</option>
                                    {categories.filter((c) => c.type === t.type).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                  </select>
                                )}
                              </div>
                            </div>
                            {editingCashTxnId === t.id ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  value={editCashAmount}
                                  onChange={(e) => setEditCashAmount(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveCashTxnEdit(t.id); if (e.key === 'Escape') setEditingCashTxnId(null) }}
                                  className="w-20 border border-indigo-300 rounded px-2 py-0.5 text-sm text-right bg-white"
                                  autoFocus
                                  min={1}
                                />
                                <button onClick={() => saveCashTxnEdit(t.id)} className="text-xs text-indigo-600 font-semibold">保存</button>
                                <button onClick={() => setEditingCashTxnId(null)} className="text-xs text-slate-400">×</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => { setEditingCashTxnId(t.id); setEditCashAmount(String(t.amount)); setEditCashDate(t.date) }}
                                  className={`text-sm font-bold hover:bg-slate-50 rounded px-1 ${isTransfer ? 'text-indigo-600' : t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}
                                >
                                  {cashIncreases ? '+' : '-'}{yen(t.amount)}
                                </button>
                                <button onClick={() => deleteCashTxn(t.id)} className="text-slate-300 hover:text-red-400 text-lg leading-none px-0.5">×</button>
                              </div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* 給料タブ */}
          {tab === 'income' && (
            <div className="space-y-3">
              {/* 月次処理カード */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">月次処理</h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setProcessingMonth((m) => shiftMonth(m, -1)); setShowPreview(false); setPreview(null); setUndoConfirm(false) }}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded text-lg"
                    >‹</button>
                    <span className="text-xs text-slate-500 min-w-[72px] text-center">{processingYear}年{processingMon}月</span>
                    <button
                      onClick={() => { setProcessingMonth((m) => shiftMonth(m, 1)); setShowPreview(false); setPreview(null); setUndoConfirm(false) }}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded text-lg"
                    >›</button>
                  </div>
                </div>

                <div className="p-4">
                  {currentClosing ? (
                    undoConfirm ? (
                      <div className="space-y-3">
                        <p className="text-xs text-amber-600">⚠ 取り消すと銀行残高の変動が全て元に戻ります</p>
                        <div className="flex gap-2">
                          <button onClick={() => setUndoConfirm(false)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                          <button onClick={undoMonthlyProcess} className="flex-1 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold">取り消す</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-green-600 font-bold text-base">✓</span>
                          <span className="text-sm text-slate-700">{new Date(currentClosing.processed_at).toLocaleDateString('ja-JP')} 処理済み</span>
                        </div>
                        <div className="space-y-0.5 mb-3 text-xs text-slate-500">
                          {currentClosing.snapshot.details.salary.map((s) => (
                            <p key={s.income_id}>給料加算: +{yen(s.amount)}{s.bank_name ? ` → ${s.bank_name}` : ''}</p>
                          ))}
                          {currentClosing.snapshot.details.card_bills.map((c) => (
                            <p key={c.credit_card_id}>カード引き落とし: -{yen(c.amount)} ({c.card_name})</p>
                          ))}
                          {currentClosing.snapshot.details.fixed_costs.map((f) => (
                            <p key={f.fixed_cost_id}>固定費: -{yen(f.amount)} ({f.name})</p>
                          ))}
                        </div>
                        <button onClick={() => setUndoConfirm(true)} className="text-xs text-slate-400 hover:text-amber-500 w-full text-center py-0.5">
                          ↩ 月次処理を取り消す
                        </button>
                      </div>
                    )
                  ) : showPreview && preview ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-slate-600">{processingYear}年{processingMon}月 月次処理プレビュー</p>

                      {preview.details.salary.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">給料加算</p>
                          {preview.details.salary.map((s) => (
                            <div key={s.income_id} className="flex justify-between text-xs bg-green-50 rounded px-2 py-1 mb-1">
                              <span className="text-slate-600">{s.description ?? '給料'}{s.bank_name ? ` → ${s.bank_name}` : ''}</span>
                              <span className="font-medium text-green-700">+{yen(s.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {preview.details.card_bills.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">先月カード引き落とし</p>
                          {preview.details.card_bills.map((c) => (
                            <div key={c.credit_card_id} className="flex justify-between text-xs bg-red-50 rounded px-2 py-1 mb-1">
                              <span className="text-slate-600">{c.card_name}{c.bank_name ? ` → ${c.bank_name}` : ''}</span>
                              <span className="font-medium text-red-600">-{yen(c.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {preview.details.fixed_costs.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">今月固定費（口座引落）</p>
                          {preview.details.fixed_costs.map((f) => (
                            <div key={f.fixed_cost_id} className="flex justify-between text-xs bg-red-50 rounded px-2 py-1 mb-1">
                              <span className="text-slate-600">{f.name}{f.bank_name ? ` → ${f.bank_name}` : ''}</span>
                              <span className="font-medium text-red-600">-{yen(f.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {preview.bank_deltas.length > 0 ? (
                        <div className="border-t border-slate-100 pt-2">
                          <p className="text-xs text-slate-400 mb-1">口座変動まとめ</p>
                          {preview.bank_deltas.map((bd) => (
                            <div key={bd.bank_account_id} className="flex justify-between text-xs px-2 py-0.5">
                              <span className="text-slate-600">{bd.bank_name ?? '不明口座'}</span>
                              <span className={`font-bold ${bd.delta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {bd.delta >= 0 ? '+' : ''}{yen(bd.delta)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-1">この月に反映する内容がありません</p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setShowPreview(false); setPreview(null) }} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                        <button
                          onClick={runMonthlyProcess}
                          disabled={isRunningProcess || preview.bank_deltas.length === 0}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                          {isRunningProcess ? '処理中...' : '実行する'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={loadPreview}
                      disabled={isLoadingPreview}
                      className="w-full py-2.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      {isLoadingPreview ? '計算中...' : '📋 月次処理を確認する'}
                    </button>
                  )}
                </div>
              </div>

              {/* 見込み給料追加 */}
              {showIncomeForm ? (
                <form onSubmit={saveIncome} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">見込み給料を設定</h2>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-500">対象月</label>
                      <input type="month" value={incomeForm.month} onChange={(e) => setIncomeForm({ ...incomeForm, month: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" required />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">金額（円）</label>
                      <input type="number" placeholder="250000" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" required />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">入金口座</label>
                    <select value={incomeForm.bank_account_id} onChange={(e) => setIncomeForm({ ...incomeForm, bank_account_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1">
                      <option value="">口座を選択</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <input type="text" placeholder="メモ（任意）" value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowIncomeForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">追加</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowIncomeForm(true)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 見込み給料を追加</button>
              )}

              {/* 給料一覧 */}
              {incomes.map((inc) => {
                const accName = inc.bank_account_id
                  ? accounts.find((a) => a.id === inc.bank_account_id)?.name
                  : null
                const isEditing = editingIncomeId === inc.id
                const processed = !!inc.is_confirmed

                if (isEditing) {
                  return (
                    <div key={inc.id} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                      <h3 className="text-sm font-semibold text-slate-700">給料を編集</h3>
                      <div>
                        <label className="text-xs text-slate-500">対象月</label>
                        <input type="month" value={editIncomeForm.month}
                          onChange={(e) => setEditIncomeForm({ ...editIncomeForm, month: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">金額（円）</label>
                        <input type="number" value={editIncomeForm.amount}
                          onChange={(e) => setEditIncomeForm({ ...editIncomeForm, amount: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" autoFocus />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">入金口座</label>
                        <select value={editIncomeForm.bank_account_id}
                          onChange={(e) => setEditIncomeForm({ ...editIncomeForm, bank_account_id: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1">
                          <option value="">口座を選択</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                      <input type="text" placeholder="メモ（任意）" value={editIncomeForm.description}
                        onChange={(e) => setEditIncomeForm({ ...editIncomeForm, description: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingIncomeId(null)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                        <button onClick={saveEditIncome} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={inc.id} className={`bg-white rounded-xl p-3 shadow-sm ${processed ? 'border-l-4 border-green-300' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{inc.month.replace('-', '年')}月</p>
                          {processed && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">月次処理済み</span>
                          )}
                        </div>
                        {accName
                          ? <p className="text-xs text-indigo-500">🏦 {accName}</p>
                          : <p className="text-xs text-amber-500">口座未設定</p>
                        }
                        {inc.description && <p className="text-xs text-slate-400">{inc.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-green-700">{yen(inc.amount)}</span>
                        {!processed && (
                          <>
                            <button onClick={() => startEditIncome(inc)} className="text-slate-400 hover:text-indigo-500 text-base leading-none px-0.5" title="編集">✎</button>
                            <button onClick={() => deleteIncome(inc.id)} className="text-slate-300 hover:text-red-400" title="削除">×</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
