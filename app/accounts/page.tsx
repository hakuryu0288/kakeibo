'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BankAccount, CreditCard, CashBalance, CashMemo, Transaction, ExpectedIncome, CardMonthlyOverride } from '@/lib/supabase'

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

export default function AccountsPage() {
  const today = currentMonth()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
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

  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [overrideInput, setOverrideInput] = useState('')

  const [editingTxnId, setEditingTxnId] = useState<string | null>(null)
  const [txnAmountInput, setTxnAmountInput] = useState('')

  // 現金タブ
  const [cashMonth, setCashMonth] = useState(today)
  const [cashTxns, setCashTxns] = useState<Transaction[]>([])
  const [cashMonthYear, cashMonthMon] = cashMonth.split('-')

  // 給料タブ
  const [incomes, setIncomes] = useState<ExpectedIncome[]>([])
  const [incomeForm, setIncomeForm] = useState({ month: currentMonth(), amount: '', description: '', bank_account_id: '' })
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [editIncomeForm, setEditIncomeForm] = useState({ month: '', amount: '', description: '', bank_account_id: '' })
  const [confirmingIncomeId, setConfirmingIncomeId] = useState<string | null>(null)
  const [undoingIncomeId, setUndoingIncomeId] = useState<string | null>(null)

  const fetchAll = () => {
    Promise.all([
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/cash').then((r) => r.json()),
      fetch('/api/cash-memos').then((r) => r.json()),
      fetch('/api/expected-income').then((r) => r.json()),
    ]).then(([b, c, ca, cm, ei]) => {
      setAccounts(Array.isArray(b) ? b : [])
      setCards(Array.isArray(c) ? c : [])
      setCash(ca?.id ? ca : null)
      setCashMemos(Array.isArray(cm) ? cm : [])
      setIncomes(Array.isArray(ei) ? ei : [])
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
        t.credit_card_id === null && t.bank_account_id === null && t.point_balance_id === null
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

  const confirmIncome = async (inc: ExpectedIncome) => {
    await fetch('/api/expected-income', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inc.id, is_confirmed: true, confirmed_at: new Date().toISOString() }),
    })
    if (inc.bank_account_id) {
      const acc = accounts.find((a) => a.id === inc.bank_account_id)
      if (acc) {
        await fetch('/api/bank-accounts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: inc.bank_account_id, balance: acc.balance + inc.amount }),
        })
      }
    }
    setConfirmingIncomeId(null)
    fetchAll()
  }

  const undoConfirmIncome = async (inc: ExpectedIncome) => {
    await fetch('/api/expected-income', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inc.id, is_confirmed: false, confirmed_at: null }),
    })
    if (inc.bank_account_id) {
      const acc = accounts.find((a) => a.id === inc.bank_account_id)
      if (acc) {
        await fetch('/api/bank-accounts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: inc.bank_account_id, balance: acc.balance - inc.amount }),
        })
      }
    }
    setUndoingIncomeId(null)
    fetchAll()
  }

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
                        {cashTxns.map((t) => (
                          <div key={t.id} className="flex justify-between items-center px-4 py-2.5 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{t.categories?.icon ?? (t.type === 'income' ? '💰' : '💴')}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium">{t.categories?.name ?? 'その他'}</p>
                                <p className="text-xs text-slate-400 truncate">{t.date}{t.memo ? '　' + t.memo : ''}</p>
                              </div>
                            </div>
                            <span className={`text-sm font-bold shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                              {t.type === 'income' ? '+' : '-'}{yen(t.amount)}
                            </span>
                          </div>
                        ))}
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
              {incomes.map((inc) => {
                const accName = inc.bank_account_id
                  ? accounts.find((a) => a.id === inc.bank_account_id)?.name
                  : null
                const isEditing = editingIncomeId === inc.id
                const isConfirming = confirmingIncomeId === inc.id
                const isUndoing = undoingIncomeId === inc.id
                const confirmed = !!inc.is_confirmed

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
                  <div key={inc.id} className={`bg-white rounded-xl shadow-sm overflow-hidden ${confirmed ? 'border-l-4 border-green-400' : ''}`}>
                    <div className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{inc.month.replace('-', '年')}月</p>
                            {confirmed && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">入金済み ✓</span>
                            )}
                          </div>
                          {accName
                            ? <p className="text-xs text-indigo-500">🏦 {accName}</p>
                            : <p className="text-xs text-amber-500">口座未設定</p>
                          }
                          {inc.description && <p className="text-xs text-slate-400">{inc.description}</p>}
                          {inc.confirmed_at && (
                            <p className="text-xs text-slate-400">{new Date(inc.confirmed_at).toLocaleDateString('ja-JP')} 反映</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-green-700">{yen(inc.amount)}</span>
                          {!confirmed && (
                            <>
                              <button
                                onClick={() => startEditIncome(inc)}
                                className="text-slate-400 hover:text-indigo-500 text-base leading-none px-0.5"
                                title="編集"
                              >✎</button>
                              <button
                                onClick={() => deleteIncome(inc.id)}
                                className="text-slate-300 hover:text-red-400"
                                title="削除"
                              >×</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-3 pb-3 border-t border-slate-100 pt-2">
                      {confirmed ? (
                        isUndoing ? (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-600">⚠ 取り消すと銀行残高から {yen(inc.amount)} が差し引かれます</p>
                            <div className="flex gap-2">
                              <button onClick={() => setUndoingIncomeId(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                              <button onClick={() => undoConfirmIncome(inc)} className="flex-1 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold">取り消す</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setUndoingIncomeId(inc.id)} className="text-xs text-slate-400 hover:text-amber-500 w-full text-center py-0.5">
                            ↩ 入金確定を取り消す
                          </button>
                        )
                      ) : (
                        isConfirming ? (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-600">
                              {accName
                                ? `🏦 ${accName} に ${yen(inc.amount)} を加算します`
                                : '⚠ 口座が未設定のため残高は変わりません（確定記録のみ）'
                              }
                            </p>
                            <div className="flex gap-2">
                              <button onClick={() => setConfirmingIncomeId(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">キャンセル</button>
                              <button onClick={() => confirmIncome(inc)} className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold">確定する</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingIncomeId(inc.id)}
                            className="w-full py-2 bg-green-50 text-green-700 rounded-lg text-sm font-semibold border border-green-200 hover:bg-green-100 transition-colors"
                          >
                            ✅ 入金を確定する
                          </button>
                        )
                      )}
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
