'use client'

import { useEffect, useState } from 'react'
import { ResaleItem, NisaSettings, BankAccount, CreditCard, FixedCost, CardMonthlyOverride, Transaction, ExpectedIncome } from '@/lib/supabase'

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

type PointBalance = { id: string; name: string; balance: number; created_at: string }

// NISAゲージ（SVGドーナツ）
function NisaGauge({ balance, max = 10000000 }: { balance: number; max?: number }) {
  const pct = Math.min(balance / max, 1)
  const r = 60
  const circumference = 2 * Math.PI * r
  const dash = pct * circumference
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={160} height={160} viewBox="0 0 160 160">
        <circle cx={80} cy={80} r={r} fill="none" stroke="#e2e8f0" strokeWidth={16} />
        <circle cx={80} cy={80} r={r} fill="none" stroke="#6366f1" strokeWidth={16}
          strokeDasharray={`${dash} ${circumference}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform="rotate(-90 80 80)" />
        <text x={80} y={72} textAnchor="middle" fontSize={11} fill="#64748b">NISA残高</text>
        <text x={80} y={92} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#4f46e5">
          {(balance / 10000).toFixed(0)}万円
        </text>
        <text x={80} y={108} textAnchor="middle" fontSize={10} fill="#94a3b8">
          {(pct * 100).toFixed(1)}%
        </text>
      </svg>
      <p className="text-xs text-slate-400">参考目標: {yen(max)}</p>
    </div>
  )
}

type ResaleFormState = { name: string; quantity: string; purchase_price: string; sell_price: string }
const defaultResaleForm: ResaleFormState = { name: '', quantity: '1', purchase_price: '', sell_price: '' }

export default function AssetsPage() {
  const today = currentMonth()
  const [tab, setTab] = useState<'points' | 'nisa' | 'resale' | 'bank'>('points')

  // 商材
  const [resaleItems, setResaleItems] = useState<ResaleItem[]>([])
  const [resaleForm, setResaleForm] = useState<ResaleFormState>(defaultResaleForm)
  const [showResaleForm, setShowResaleForm] = useState(false)
  const [editResaleId, setEditResaleId] = useState<string | null>(null)

  // NISA
  const [nisa, setNisa] = useState<NisaSettings | null>(null)
  const [nisaInput, setNisaInput] = useState('')
  const [nisaContrib, setNisaContrib] = useState('')
  const [nisaMax, setNisaMax] = useState('10000000')

  // ポイント
  const [points, setPoints] = useState<PointBalance[]>([])
  const [pointForm, setPointForm] = useState({ name: '', balance: '' })
  const [editPointId, setEditPointId] = useState<string | null>(null)
  const [showPointForm, setShowPointForm] = useState(false)

  // 銀行口座
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [expectedIncomes, setExpectedIncomes] = useState<ExpectedIncome[]>([])
  const [prevMonthTxns, setPrevMonthTxns] = useState<Transaction[]>([])
  const [prevMonthOverrides, setPrevMonthOverrides] = useState<CardMonthlyOverride[]>([])
  const [isMonthlyProcessed, setIsMonthlyProcessed] = useState(false)
  const [bankForm, setBankForm] = useState({ id: '', name: '', balance: '', note: '' })
  const [showBankForm, setShowBankForm] = useState(false)

  const [loading, setLoading] = useState(true)

  const fetchAll = () => {
    const prevMonth = shiftMonth(today, -1)
    Promise.all([
      fetch('/api/resale-items').then((r) => r.json()),
      fetch('/api/nisa').then((r) => r.json()),
      fetch('/api/point-balances').then((r) => r.json()),
      fetch('/api/bank-accounts').then((r) => r.json()),
      fetch('/api/credit-cards').then((r) => r.json()),
      fetch('/api/fixed-costs').then((r) => r.json()),
      fetch(`/api/expected-income?month=${today}`).then((r) => r.json()),
      fetch(`/api/transactions?month=${prevMonth}`).then((r) => r.json()),
      fetch(`/api/card-monthly-overrides?month=${prevMonth}`).then((r) => r.json()),
      fetch(`/api/monthly-closings?month=${today}`).then((r) => r.json()),
    ]).then(([ri, ns, pb, ba, cr, fc, ei, prevTxns, prevOverrides, mc]) => {
      setResaleItems(Array.isArray(ri) ? ri : [])
      if (ns?.id) {
        setNisa(ns)
        setNisaInput(String(ns.current_balance))
        setNisaContrib(String(ns.monthly_contribution))
      }
      setPoints(Array.isArray(pb) ? pb : [])
      setBankAccounts(Array.isArray(ba) ? ba : [])
      setCards(Array.isArray(cr) ? cr : [])
      setFixedCosts(Array.isArray(fc) ? fc : [])
      setExpectedIncomes(Array.isArray(ei) ? ei : [])
      setPrevMonthTxns(Array.isArray(prevTxns) ? prevTxns.filter((t: Transaction) => t.type === 'expense') : [])
      setPrevMonthOverrides(Array.isArray(prevOverrides) ? prevOverrides : [])
      setIsMonthlyProcessed(!!(mc && mc.id))
      setLoading(false)
    })
  }

  useEffect(() => { fetchAll() }, [])

  // NISA保存
  const saveNisa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nisa) return
    await fetch('/api/nisa', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: nisa.id, current_balance: parseFloat(nisaInput), monthly_contribution: parseInt(nisaContrib) }) })
    fetchAll()
  }

  // ポイント保存
  const savePoint = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: pointForm.name, balance: parseInt(pointForm.balance) }
    if (editPointId) {
      await fetch('/api/point-balances', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editPointId, ...payload }) })
    } else {
      await fetch('/api/point-balances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setPointForm({ name: '', balance: '' })
    setEditPointId(null)
    setShowPointForm(false)
    fetchAll()
  }

  const deletePoint = async (id: string) => {
    await fetch(`/api/point-balances?id=${id}`, { method: 'DELETE' })
    fetchAll()
  }

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

  // 商材操作
  const saveResale = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: resaleForm.name, quantity: parseInt(resaleForm.quantity), purchase_price: parseInt(resaleForm.purchase_price), sell_price: resaleForm.sell_price ? parseInt(resaleForm.sell_price) : null, status: 'holding' }
    if (editResaleId) {
      await fetch('/api/resale-items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editResaleId, ...payload }) })
    } else {
      await fetch('/api/resale-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setResaleForm(defaultResaleForm)
    setShowResaleForm(false)
    setEditResaleId(null)
    fetchAll()
  }

  const deleteResale = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch(`/api/resale-items?id=${id}`, { method: 'DELETE' })
    fetchAll()
  }

  const totalPoints = points.reduce((s, p) => s + p.balance, 0)
  const totalResaleValue = resaleItems.reduce((s, i) => s + (i.sell_price ?? i.purchase_price) * i.quantity, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">資産管理</h1>

      <div className="grid grid-cols-4 gap-1 bg-slate-100 rounded-xl p-1">
        {([['points','ポイント'],['nisa','NISA'],['resale','商材'],['bank','銀行']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-slate-400">読み込み中...</div> : (
        <>
          {/* 商材タブ */}
          {tab === 'resale' && (
            <div className="space-y-3">
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-xs text-indigo-600">商材評価額合計（売価ベース）</p>
                <p className="text-2xl font-bold text-indigo-700">{yen(totalResaleValue)}</p>
              </div>
              {!(showResaleForm && !editResaleId) && (
                <button onClick={() => { setResaleForm(defaultResaleForm); setEditResaleId(null); setShowResaleForm(true) }} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 商材を追加</button>
              )}
              {showResaleForm && !editResaleId && (
                <form onSubmit={saveResale} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">商材を追加</h2>
                  <input type="text" placeholder="商品名" value={resaleForm.name} onChange={(e) => setResaleForm({ ...resaleForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="個数" value={resaleForm.quantity} min={1} onChange={(e) => setResaleForm({ ...resaleForm, quantity: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="number" placeholder="仕入れ額/個" value={resaleForm.purchase_price} onChange={(e) => setResaleForm({ ...resaleForm, purchase_price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="number" placeholder="売値/個" value={resaleForm.sell_price} onChange={(e) => setResaleForm({ ...resaleForm, sell_price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowResaleForm(false); setEditResaleId(null); setResaleForm(defaultResaleForm) }} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                  </div>
                </form>
              )}
              <div className="space-y-2">
                {resaleItems.map((item) => (
                  editResaleId === item.id && showResaleForm ? (
                    <form key={item.id} onSubmit={saveResale} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                      <h2 className="text-sm font-semibold">商材を編集</h2>
                      <input type="text" placeholder="商品名" value={resaleForm.name} onChange={(e) => setResaleForm({ ...resaleForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" placeholder="個数" value={resaleForm.quantity} min={1} onChange={(e) => setResaleForm({ ...resaleForm, quantity: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                        <input type="number" placeholder="仕入れ額/個" value={resaleForm.purchase_price} onChange={(e) => setResaleForm({ ...resaleForm, purchase_price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                        <input type="number" placeholder="売値/個" value={resaleForm.sell_price} onChange={(e) => setResaleForm({ ...resaleForm, sell_price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setShowResaleForm(false); setEditResaleId(null); setResaleForm(defaultResaleForm) }} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                        <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                      </div>
                    </form>
                  ) : (
                    <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-slate-400">
                            {item.quantity}個　仕入 {yen(item.purchase_price)}/個
                            {item.sell_price != null ? `　売値 ${yen(item.sell_price)}/個` : ''}
                          </p>
                        </div>
                        <p className="text-sm font-bold">{yen((item.sell_price ?? item.purchase_price) * item.quantity)}</p>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => { setResaleForm({ name: item.name, quantity: String(item.quantity), purchase_price: String(item.purchase_price), sell_price: item.sell_price ? String(item.sell_price) : '' }); setEditResaleId(item.id); setShowResaleForm(true) }} className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded">編集</button>
                        <button onClick={() => deleteResale(item.id)} className="text-xs text-red-400 px-2 py-1 hover:bg-red-50 rounded">削除</button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* NISAタブ */}
          {tab === 'nisa' && (
            <div className="space-y-4">
              {nisa && <NisaGauge balance={Number(nisa.current_balance)} max={parseInt(nisaMax)} />}
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                <h2 className="text-sm font-semibold">NISA残高を更新</h2>
                <form onSubmit={saveNisa} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500">現在の残高（円）</label>
                    <input type="number" value={nisaInput} onChange={(e) => setNisaInput(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" placeholder="3000000" required />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">月々の積立額（円）</label>
                    <input type="number" value={nisaContrib} onChange={(e) => setNisaContrib(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" placeholder="30000" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">グラフ目標額（円）</label>
                    <input type="number" value={nisaMax} onChange={(e) => setNisaMax(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1" placeholder="10000000" />
                  </div>
                  <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                </form>
              </div>
            </div>
          )}

          {/* ポイントタブ */}
          {tab === 'points' && (
            <div className="space-y-3">
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-xs text-yellow-600">ポイント合計</p>
                <p className="text-2xl font-bold text-yellow-700">{totalPoints.toLocaleString('ja-JP')} pt</p>
                <p className="text-xs text-yellow-500">≒ {yen(totalPoints)}</p>
              </div>
              {!(showPointForm && !editPointId) && (
                <button onClick={() => { setPointForm({ name: '', balance: '' }); setEditPointId(null); setShowPointForm(true) }} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ ポイントを追加</button>
              )}
              {showPointForm && !editPointId && (
                <form onSubmit={savePoint} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">ポイントを追加</h2>
                  <input type="text" placeholder="ポイント名（例：楽天ポイント）" value={pointForm.name} onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <input type="number" placeholder="残高（ポイント数）" value={pointForm.balance} onChange={(e) => setPointForm({ ...pointForm, balance: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowPointForm(false); setEditPointId(null); setPointForm({ name: '', balance: '' }) }} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                  </div>
                </form>
              )}
              {points.map((p) => (
                editPointId === p.id && showPointForm ? (
                  <form key={p.id} onSubmit={savePoint} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                    <h2 className="text-sm font-semibold">ポイントを編集</h2>
                    <input type="text" placeholder="ポイント名（例：楽天ポイント）" value={pointForm.name} onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="number" placeholder="残高（ポイント数）" value={pointForm.balance} onChange={(e) => setPointForm({ ...pointForm, balance: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setShowPointForm(false); setEditPointId(null); setPointForm({ name: '', balance: '' }) }} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                      <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                    </div>
                  </form>
                ) : (
                  <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-lg font-bold text-slate-700">{p.balance.toLocaleString('ja-JP')} pt</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setPointForm({ name: p.name, balance: String(p.balance) }); setEditPointId(p.id); setShowPointForm(true) }} className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded">編集</button>
                      <button onClick={() => deletePoint(p.id)} className="text-xs text-red-400 px-2 py-1 hover:bg-red-50 rounded">削除</button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* 銀行口座タブ */}
          {tab === 'bank' && (
            <div className="space-y-3">
              {expectedIncomes.filter((e) => !e.bank_account_id && !e.is_confirmed).reduce((s, e) => s + e.amount, 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-700 font-medium">
                    ⚠️ 口座未割り当ての給料: +{yen(expectedIncomes.filter((e) => !e.bank_account_id && !e.is_confirmed).reduce((s, e) => s + e.amount, 0))}
                  </p>
                  <p className="text-xs text-amber-500 mt-0.5">カード/現金→給料タブで入金口座を設定してください</p>
                </div>
              )}

              {!(showBankForm && !bankForm.id) && (
                <button onClick={() => { setBankForm({ id: '', name: '', balance: '', note: '' }); setShowBankForm(true) }}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 口座を追加</button>
              )}
              {showBankForm && !bankForm.id && (
                <form onSubmit={saveBankAccount} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">口座を追加</h2>
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
              )}

              {bankAccounts.map((acc) => {
                const cardsForAcc = cards.filter((c) => c.bank_account_id === acc.id)

                // 月次処理済みの場合、給料・カード・固定費はすでに残高に反映済み
                const incomeForAcc = isMonthlyProcessed ? 0 : expectedIncomes
                  .filter((e) => e.bank_account_id === acc.id && !e.is_confirmed)
                  .reduce((s, e) => s + e.amount, 0)

                const cardCharge = isMonthlyProcessed ? 0 : (() => {
                  let total = 0
                  for (const card of cardsForAcc) {
                    const override = prevMonthOverrides.find((o) => o.credit_card_id === card.id)
                    if (override) {
                      total += override.override_amount
                    } else {
                      total += prevMonthTxns
                        .filter((t) => t.credit_card_id === card.id)
                        .reduce((s, t) => s + t.amount, 0)
                    }
                  }
                  return total
                })()

                const fixedCharge = isMonthlyProcessed ? 0 : fixedCosts
                  .filter((f) => f.is_active && f.bank_account_id === acc.id)
                  .reduce((s, f) => s + f.amount, 0)

                const totalDeductions = cardCharge + fixedCharge
                const projectedBalance = Number(acc.balance) + incomeForAcc - totalDeductions
                const isNegative = projectedBalance < 0

                if (showBankForm && bankForm.id === acc.id) {
                  return (
                    <form key={acc.id} onSubmit={saveBankAccount} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                      <h2 className="text-sm font-semibold">残高を更新</h2>
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
                  )
                }

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
                          <span>💳 カード請求（先月実績）</span>
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
                        isMonthlyProcessed
                          ? <p className="text-xs text-green-600">✓ 今月の月次処理反映済み</p>
                          : <p className="text-xs text-slate-400">引き落とし予定なし</p>
                      )}
                      <div className={`flex justify-between text-sm font-bold pt-1.5 border-t border-slate-200 ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                        <span>{isMonthlyProcessed ? '現在の残高' : '月末残高見込み'}</span>
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
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
