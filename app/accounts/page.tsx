'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BankAccount, CreditCard, CashBalance, CashMemo, Transaction, Subscription, FixedCost, ExpectedIncome, CardMonthlyOverride } from '@/lib/supabase'

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
  const [currentMonthTxns, setCurrentMonthTxns] = useState<Transaction[]>([])
  const [cardTabTxns, setCardTabTxns] = useState<Transaction[]>([])
  const [cardOverrides, setCardOverrides] = useState<CardMonthlyOverride[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [expectedIncomes, setExpectedIncomes] = useState<ExpectedIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'card' | 'cash' | 'bank'>('card')

  const [cardMonth, setCardMonth] = useState(today)
  const [cardMonthYear, cardMonthMon] = cardMonth.split('-')

  const [bankForm, setBankForm] = useState({ id: '', name: '', balance: '', note: '' })
  const [showBankForm, setShowBankForm] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [cashMemo, setCashMemo] = useState('')

  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [overrideInput, setOverrideInput] = useState('')

  const fetchAll = () => {
    Promise.all([
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/cash').then((r) => r.json()),
      fetch('/api/cash-memos').then((r) => r.json()),
      fetch(`/api/transactions?month=${today}`).then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/fixed-costs').then((r) => r.json()),
      fetch(`/api/expected-income?month=${today}`).then((r) => r.json()),
    ]).then(([b, c, ca, cm, txns, subs, fc, ei]) => {
      setAccounts(Array.isArray(b) ? b : [])
      setCards(Array.isArray(c) ? c : [])
      setCash(ca?.id ? ca : null)
      setCashMemos(Array.isArray(cm) ? cm : [])
      setCurrentMonthTxns(Array.isArray(txns) ? txns.filter((t: Transaction) => t.type === 'expense') : [])
      setSubscriptions(Array.isArray(subs) ? subs : [])
      setFixedCosts(Array.isArray(fc) ? fc : [])
      setExpectedIncomes(Array.isArray(ei) ? ei : [])
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

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { fetchCardTabData() }, [cardMonth])

  const saveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: bankForm.name, balance: parseFloat(bankForm.balance), note: bankForm.note || null }
    if (bankForm.id) {
      await fetch('/api/bank-accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bankForm.id, ...payload }) })
    } else {
      await fetch('/api/bank-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setBankForm({ id: '', name: '', balance: '', note: '' })
    setShowBankForm(false)
    fetchAll()
  }

  const deleteAccount = async (id: string) => {
    if (!confirm('この口座を削除しますか？')) return
    await fetch(`/api/bank-accounts?id=${id}`, { method: 'DELETE' })
    fetchAll()
  }

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

  const totalCardUsage = cards.reduce((sum, card) => {
    const txnTotal = cardTabTxns.filter((t) => t.credit_card_id === card.id).reduce((s, t) => s + t.amount, 0)
    const override = cardOverrides.find((o) => o.credit_card_id === card.id)
    return sum + (override ? override.override_amount : txnTotal)
  }, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">口座・カード・現金</h1>

      <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white">
        {(['card', 'cash', 'bank'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
            {t === 'card' ? '💳 クレカ' : t === 'cash' ? '💴 現金' : '🏦 銀行'}
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
                          <div key={t.id} className="flex justify-between items-center px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{t.categories?.icon ?? '📦'}</span>
                              <div>
                                <p className="text-xs font-medium">{t.categories?.name ?? 'その他'}</p>
                                <p className="text-xs text-slate-400">{t.date}{t.memo ? '　' + t.memo : ''}</p>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-red-600">-{yen(t.amount)}</span>
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
            </div>
          )}

          {/* 銀行口座タブ */}
          {tab === 'bank' && (
            <div className="space-y-3">
              {/* 口座未割り当ての給料バナー */}
              {expectedIncomes.filter((e) => !e.bank_account_id).reduce((s, e) => s + e.amount, 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-700 font-medium">
                    ⚠️ 口座未割り当ての給料: +{yen(expectedIncomes.filter((e) => !e.bank_account_id).reduce((s, e) => s + e.amount, 0))}
                  </p>
                  <p className="text-xs text-amber-500 mt-0.5">資産→給料タブで入金口座を設定してください</p>
                </div>
              )}

              {(() => {
                const todayDay = new Date().getDate()
                return accounts.map((acc) => {
                  const cardsForAcc = cards.filter((c) => c.bank_account_id === acc.id)
                  const cardIdsForAcc = new Set(cardsForAcc.map((c) => c.id))

                  const incomeForAcc = expectedIncomes
                    .filter((e) => e.bank_account_id === acc.id)
                    .reduce((s, e) => s + e.amount, 0)

                  const cardCharge = currentMonthTxns
                    .filter((t) => t.credit_card_id && cardIdsForAcc.has(t.credit_card_id))
                    .reduce((s, t) => s + t.amount, 0)

                  const fixedCharge = fixedCosts
                    .filter((f) => f.is_active && f.bank_account_id === acc.id && f.billing_day > todayDay)
                    .reduce((s, f) => s + f.amount, 0)

                  const totalDeductions = cardCharge + fixedCharge
                  const projectedBalance = Number(acc.balance) + incomeForAcc - totalDeductions
                  const isNegative = projectedBalance < 0

                  return (
                    <div key={acc.id} className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">🏦 {acc.name}</p>
                          {acc.note && <p className="text-xs text-slate-400 mt-0.5">{acc.note}</p>}
                        </div>
                        <p className="text-lg font-bold text-indigo-700">{yen(Number(acc.balance))}</p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                        {incomeForAcc > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>💰 見込み給料</span>
                            <span className="text-green-600 font-medium">+{yen(incomeForAcc)}</span>
                          </div>
                        )}
                        {cardCharge > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>💳 カード請求（今月実績）</span>
                            <span className="text-red-500 font-medium">-{yen(cardCharge)}</span>
                          </div>
                        )}
                        {fixedCharge > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>🏠 固定費（未引き落とし）</span>
                            <span className="text-red-500 font-medium">-{yen(fixedCharge)}</span>
                          </div>
                        )}
                        {incomeForAcc === 0 && cardCharge === 0 && fixedCharge === 0 && (
                          <p className="text-xs text-slate-400">引き落とし予定なし</p>
                        )}
                        <div className={`flex justify-between text-sm font-bold pt-1.5 border-t border-slate-200 ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                          <span>月末残高見込み</span>
                          <span>{isNegative ? '⚠️ ' : ''}{yen(projectedBalance)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button onClick={() => { setBankForm({ id: acc.id, name: acc.name, balance: String(acc.balance), note: acc.note ?? '' }); setShowBankForm(true) }}
                          className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded">残高更新</button>
                        <button onClick={() => deleteAccount(acc.id)} className="text-xs text-red-400 px-2 py-1 hover:bg-red-50 rounded">削除</button>
                      </div>
                    </div>
                  )
                })
              })()}

              {showBankForm ? (
                <form onSubmit={saveBankAccount} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">{bankForm.id ? '口座を更新' : '口座を追加'}</h2>
                  <input type="text" placeholder="口座名（例：楽天銀行）" value={bankForm.name}
                    onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <input type="number" placeholder="現在の残高" value={bankForm.balance}
                    onChange={(e) => setBankForm({ ...bankForm, balance: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <input type="text" placeholder="メモ（任意）" value={bankForm.note}
                    onChange={(e) => setBankForm({ ...bankForm, note: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowBankForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => { setBankForm({ id: '', name: '', balance: '', note: '' }); setShowBankForm(true) }}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 口座を追加</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
