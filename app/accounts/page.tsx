'use client'

import { useEffect, useState } from 'react'
import { BankAccount, CreditCard, CashBalance, CashMemo } from '@/lib/supabase'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

const CARD_COLORS = ['#6366f1','#ef4444','#f97316','#22c55e','#06b6d4','#8b5cf6','#ec4899','#eab308']

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [cash, setCash] = useState<CashBalance | null>(null)
  const [cashMemos, setCashMemos] = useState<CashMemo[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'bank' | 'card' | 'cash'>('bank')

  // フォーム状態
  const [bankForm, setBankForm] = useState({ id: '', name: '', balance: '', note: '' })
  const [showBankForm, setShowBankForm] = useState(false)
  const [cardForm, setCardForm] = useState({ id: '', name: '', bank_account_id: '', closing_day: '15', billing_day: '27', color: '#6366f1' })
  const [showCardForm, setShowCardForm] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [cashMemo, setCashMemo] = useState('')

  const fetchAll = () => {
    Promise.all([
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/cash').then((r) => r.json()),
      fetch('/api/cash-memos').then((r) => r.json()),
    ]).then(([b, c, ca, cm]) => {
      setAccounts(Array.isArray(b) ? b : [])
      setCards(Array.isArray(c) ? c : [])
      setCash(ca?.id ? ca : null)
      setCashMemos(Array.isArray(cm) ? cm : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchAll() }, [])

  // 銀行口座保存
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

  // クレカ保存
  const saveCard = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: cardForm.name,
      bank_account_id: cardForm.bank_account_id || null,
      closing_day: parseInt(cardForm.closing_day),
      billing_day: parseInt(cardForm.billing_day),
      color: cardForm.color,
    }
    if (cardForm.id) {
      await fetch('/api/credit-cards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cardForm.id, ...payload }) })
    } else {
      await fetch('/api/credit-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setCardForm({ id: '', name: '', bank_account_id: '', closing_day: '15', billing_day: '27', color: '#6366f1' })
    setShowCardForm(false)
    fetchAll()
  }

  const deleteCard = async (id: string) => {
    if (!confirm('このカードを削除しますか？')) return
    await fetch(`/api/credit-cards?id=${id}`, { method: 'DELETE' })
    fetchAll()
  }

  // 現金残高更新
  const saveCash = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cash) return
    await fetch('/api/cash', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cash.id, amount: parseInt(cashAmount) }) })
    setCashAmount('')
    fetchAll()
  }

  // 現金メモ追加
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">口座・カード・現金</h1>

      {/* タブ */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white">
        {(['bank', 'card', 'cash'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
            {t === 'bank' ? '🏦 銀行' : t === 'card' ? '💳 クレカ' : '💴 現金'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-slate-400">読み込み中...</div> : (
        <>
          {/* 銀行口座タブ */}
          {tab === 'bank' && (
            <div className="space-y-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">🏦 {acc.name}</p>
                      {acc.note && <p className="text-xs text-slate-400 mt-0.5">{acc.note}</p>}
                    </div>
                    <p className="text-lg font-bold text-indigo-700">{yen(acc.balance)}</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setBankForm({ id: acc.id, name: acc.name, balance: String(acc.balance), note: acc.note ?? '' }); setShowBankForm(true) }}
                      className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded">残高更新</button>
                    <button onClick={() => deleteAccount(acc.id)} className="text-xs text-red-400 px-2 py-1 hover:bg-red-50 rounded">削除</button>
                  </div>
                </div>
              ))}
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

          {/* クレカタブ */}
          {tab === 'card' && (
            <div className="space-y-3">
              {cards.map((card) => (
                <div key={card.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4" style={{ borderColor: card.color }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">💳 {card.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        締め日: {card.closing_day}日　引き落とし: {card.billing_day}日
                      </p>
                      {card.bank_accounts && (
                        <p className="text-xs text-slate-400">引き落とし口座: {card.bank_accounts.name}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setCardForm({ id: card.id, name: card.name, bank_account_id: card.bank_account_id ?? '', closing_day: String(card.closing_day), billing_day: String(card.billing_day), color: card.color }); setShowCardForm(true) }}
                        className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded">編集</button>
                      <button onClick={() => deleteCard(card.id)} className="text-xs text-red-400 px-2 py-1 hover:bg-red-50 rounded">削除</button>
                    </div>
                  </div>
                </div>
              ))}
              {showCardForm ? (
                <form onSubmit={saveCard} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">{cardForm.id ? 'カードを編集' : 'カードを追加'}</h2>
                  <input type="text" placeholder="カード名（例：楽天カード）" value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500">締め日</label>
                      <input type="number" value={cardForm.closing_day} min={1} max={31}
                        onChange={(e) => setCardForm({ ...cardForm, closing_day: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">引き落とし日</label>
                      <input type="number" value={cardForm.billing_day} min={1} max={31}
                        onChange={(e) => setCardForm({ ...cardForm, billing_day: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">引き落とし口座</label>
                    <select value={cardForm.bank_account_id} onChange={(e) => setCardForm({ ...cardForm, bank_account_id: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1">
                      <option value="">なし</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">カラー</label>
                    <div className="flex gap-2 mt-1">
                      {CARD_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setCardForm({ ...cardForm, color: c })}
                          className={`w-7 h-7 rounded-full ${cardForm.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowCardForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => { setCardForm({ id: '', name: '', bank_account_id: '', closing_day: '15', billing_day: '27', color: '#6366f1' }); setShowCardForm(true) }}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ カードを追加</button>
              )}
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
        </>
      )}
    </div>
  )
}
