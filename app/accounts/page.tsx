'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BankAccount, CreditCard, CashBalance, CashMemo, Transaction, Subscription, FixedCost, ExpectedIncome } from '@/lib/supabase'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [cash, setCash] = useState<CashBalance | null>(null)
  const [cashMemos, setCashMemos] = useState<CashMemo[]>([])
  const [cardTxns, setCardTxns] = useState<Transaction[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [expectedIncomes, setExpectedIncomes] = useState<ExpectedIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'card' | 'cash' | 'bank'>('card')
  const month = currentMonth()

  const [bankForm, setBankForm] = useState({ id: '', name: '', balance: '', note: '' })
  const [showBankForm, setShowBankForm] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [cashMemo, setCashMemo] = useState('')

  const fetchAll = () => {
    Promise.all([
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/cash').then((r) => r.json()),
      fetch('/api/cash-memos').then((r) => r.json()),
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/fixed-costs').then((r) => r.json()),
      fetch(`/api/expected-income?month=${month}`).then((r) => r.json()),
    ]).then(([b, c, ca, cm, txns, subs, fc, ei]) => {
      setAccounts(Array.isArray(b) ? b : [])
      setCards(Array.isArray(c) ? c : [])
      setCash(ca?.id ? ca : null)
      setCashMemos(Array.isArray(cm) ? cm : [])
      setCardTxns(Array.isArray(txns) ? txns.filter((t: Transaction) => t.type === 'expense') : [])
      setSubscriptions(Array.isArray(subs) ? subs : [])
      setFixedCosts(Array.isArray(fc) ? fc : [])
      setExpectedIncomes(Array.isArray(ei) ? ei : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchAll() }, [])

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

  const totalCardUsage = cardTxns.reduce((s, t) => t.credit_card_id ? s + t.amount : s, 0)

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
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-xs text-indigo-600">今月のクレカ合計使用額</p>
                <p className="text-xl font-bold text-red-600">{yen(totalCardUsage)}</p>
              </div>

              {cards.map((card) => {
                const txnsForCard = cardTxns.filter((t) => t.credit_card_id === card.id)
                const usage = txnsForCard.reduce((s, t) => s + t.amount, 0)
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
                          <p className="text-xs text-slate-400">今月使用</p>
                          <p className={`text-lg font-bold ${usage > 0 ? 'text-red-600' : 'text-slate-400'}`}>{yen(usage)}</p>
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
                      <p className="text-xs text-slate-400 px-4 py-2 border-t border-slate-100">今月の取引なし</p>
                    )}
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

                  // 今月の見込み給料（この口座に入金予定）
                  const incomeForAcc = expectedIncomes
                    .filter((e) => e.bank_account_id === acc.id)
                    .reduce((s, e) => s + e.amount, 0)

                  // 今月のカード決済合計
                  const cardCharge = cardTxns
                    .filter((t) => t.credit_card_id && cardIdsForAcc.has(t.credit_card_id))
                    .reduce((s, t) => s + t.amount, 0)

                  // 月額サブスク（カードが紐づくもの）
                  const subCharge = subscriptions
                    .filter((s) => s.is_active && s.credit_card_id && cardIdsForAcc.has(s.credit_card_id))
                    .reduce((s, sub) => s + sub.amount, 0)

                  // 固定費 — billing_day が今日より先のもののみ（済みは口座残高に反映済み）
                  const fixedCharge = fixedCosts
                    .filter((f) => f.is_active && f.bank_account_id === acc.id && f.billing_day > todayDay)
                    .reduce((s, f) => s + f.amount, 0)

                  const totalDeductions = cardCharge + subCharge + fixedCharge
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
                        {subCharge > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>🔄 サブスク（月額）</span>
                            <span className="text-red-500 font-medium">-{yen(subCharge)}</span>
                          </div>
                        )}
                        {fixedCharge > 0 && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>🏠 固定費（未引き落とし）</span>
                            <span className="text-red-500 font-medium">-{yen(fixedCharge)}</span>
                          </div>
                        )}
                        {incomeForAcc === 0 && totalDeductions === 0 && (
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
