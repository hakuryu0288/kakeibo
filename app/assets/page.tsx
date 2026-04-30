'use client'

import { useEffect, useState } from 'react'
import { ResaleItem, NisaSettings, ExpectedIncome, BankAccount } from '@/lib/supabase'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function currentMonth() {
  const d = new Date()
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

const STATUS_LABELS = { holding: '在庫中', listed: '出品中', sold: '売却済' }
const STATUS_COLORS = { holding: 'bg-blue-100 text-blue-700', listed: 'bg-yellow-100 text-yellow-700', sold: 'bg-green-100 text-green-700' }
type ResaleStatus = 'holding' | 'listed' | 'sold'
type ResaleFormState = { name: string; quantity: string; purchase_price: string; sell_price: string; status: ResaleStatus; platform: string; note: string }
const defaultResaleForm: ResaleFormState = { name: '', quantity: '1', purchase_price: '', sell_price: '', status: 'holding', platform: '', note: '' }

export default function AssetsPage() {
  const [tab, setTab] = useState<'points' | 'nisa' | 'resale' | 'income'>('points')

  // 商材
  const [resaleItems, setResaleItems] = useState<ResaleItem[]>([])
  const [resaleForm, setResaleForm] = useState<ResaleFormState>(defaultResaleForm)
  const [showResaleForm, setShowResaleForm] = useState(false)
  const [editResaleId, setEditResaleId] = useState<string | null>(null)
  const [resaleFilter, setResaleFilter] = useState<'all' | ResaleStatus>('all')

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

  // 見込み給料
  const [incomes, setIncomes] = useState<ExpectedIncome[]>([])
  const [incomeForm, setIncomeForm] = useState({ month: currentMonth(), amount: '', description: '', bank_account_id: '' })
  const [showIncomeForm, setShowIncomeForm] = useState(false)

  // 銀行口座（給料の入金先）
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  const [loading, setLoading] = useState(true)

  const fetchAll = () => {
    Promise.all([
      fetch('/api/resale-items').then((r) => r.json()),
      fetch('/api/nisa').then((r) => r.json()),
      fetch('/api/point-balances').then((r) => r.json()),
      fetch('/api/expected-income').then((r) => r.json()),
      fetch('/api/bank-accounts').then((r) => r.json()),
    ]).then(([ri, ns, pb, ei, ba]) => {
      setResaleItems(Array.isArray(ri) ? ri : [])
      if (ns?.id) {
        setNisa(ns)
        setNisaInput(String(ns.current_balance))
        setNisaContrib(String(ns.monthly_contribution))
      }
      setPoints(Array.isArray(pb) ? pb : [])
      setIncomes(Array.isArray(ei) ? ei : [])
      setBankAccounts(Array.isArray(ba) ? ba : [])
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

  // 見込み給料保存
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

  // 商材操作
  const saveResale = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: resaleForm.name, quantity: parseInt(resaleForm.quantity), purchase_price: parseInt(resaleForm.purchase_price), sell_price: resaleForm.sell_price ? parseInt(resaleForm.sell_price) : null, status: resaleForm.status, platform: resaleForm.platform || null, note: resaleForm.note || null }
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
  const holdingResale = resaleItems.filter((i) => i.status !== 'sold')
  const totalResaleInvestment = holdingResale.reduce((s, i) => s + i.purchase_price * i.quantity, 0)
  const soldResale = resaleItems.filter((i) => i.status === 'sold')
  const totalResaleProfit = soldResale.reduce((s, i) => s + ((i.sell_price ?? 0) - i.purchase_price) * i.quantity, 0)
  const filteredResale = resaleFilter === 'all' ? resaleItems : resaleItems.filter((i) => i.status === resaleFilter)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">資産管理</h1>

      <div className="grid grid-cols-4 gap-1 bg-slate-100 rounded-xl p-1">
        {([['points','ポイント'],['nisa','NISA'],['resale','商材'],['income','給料']] as const).map(([key, label]) => (
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
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-600">在庫仕入れ額</p>
                  <p className="text-lg font-bold text-blue-700">{yen(totalResaleInvestment)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${totalResaleProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-xs ${totalResaleProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>売却益合計</p>
                  <p className={`text-lg font-bold ${totalResaleProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{yen(totalResaleProfit)}</p>
                </div>
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {(['all','holding','listed','sold'] as const).map((f) => (
                  <button key={f} onClick={() => setResaleFilter(f)}
                    className={`flex-1 py-1 rounded-lg text-xs font-medium ${resaleFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                    {f === 'all' ? '全て' : STATUS_LABELS[f]}
                  </button>
                ))}
              </div>
              {showResaleForm && (
                <form onSubmit={saveResale} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">{editResaleId ? '編集' : '商材を追加'}</h2>
                  <input type="text" placeholder="商品名" value={resaleForm.name} onChange={(e) => setResaleForm({ ...resaleForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="個数" value={resaleForm.quantity} min={1} onChange={(e) => setResaleForm({ ...resaleForm, quantity: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="number" placeholder="仕入れ額" value={resaleForm.purchase_price} onChange={(e) => setResaleForm({ ...resaleForm, purchase_price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
                    <input type="number" placeholder="売値（任意）" value={resaleForm.sell_price} onChange={(e) => setResaleForm({ ...resaleForm, sell_price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={resaleForm.status} onChange={(e) => setResaleForm({ ...resaleForm, status: e.target.value as ResaleStatus })} className="border border-slate-200 rounded-lg p-2 text-sm">
                      <option value="holding">在庫中</option>
                      <option value="listed">出品中</option>
                      <option value="sold">売却済</option>
                    </select>
                    <input type="text" placeholder="プラットフォーム" value={resaleForm.platform} onChange={(e) => setResaleForm({ ...resaleForm, platform: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowResaleForm(false); setEditResaleId(null); setResaleForm(defaultResaleForm) }} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                  </div>
                </form>
              )}
              <div className="space-y-2">
                {filteredResale.map((item) => {
                  const profit = item.sell_price != null ? (item.sell_price - item.purchase_price) * item.quantity : null
                  return (
                    <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{item.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                          </div>
                          <p className="text-xs text-slate-400">{item.quantity}個　仕入 {yen(item.purchase_price)}/個{item.platform ? `　${item.platform}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{yen(item.purchase_price * item.quantity)}</p>
                          {profit != null && <p className={`text-xs font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profit >= 0 ? '+' : ''}{yen(profit)}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => { setResaleForm({ name: item.name, quantity: String(item.quantity), purchase_price: String(item.purchase_price), sell_price: item.sell_price ? String(item.sell_price) : '', status: item.status, platform: item.platform ?? '', note: item.note ?? '' }); setEditResaleId(item.id); setShowResaleForm(true) }} className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded">編集</button>
                        <button onClick={() => deleteResale(item.id)} className="text-xs text-red-400 px-2 py-1 hover:bg-red-50 rounded">削除</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {!showResaleForm && (
                <button onClick={() => { setResaleForm(defaultResaleForm); setEditResaleId(null); setShowResaleForm(true) }} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 商材を追加</button>
              )}
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
              {points.map((p) => (
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
              ))}
              {showPointForm && (
                <form onSubmit={savePoint} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">{editPointId ? 'ポイントを編集' : 'ポイントを追加'}</h2>
                  <input type="text" placeholder="ポイント名（例：楽天ポイント）" value={pointForm.name} onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <input type="number" placeholder="残高（ポイント数）" value={pointForm.balance} onChange={(e) => setPointForm({ ...pointForm, balance: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowPointForm(false); setEditPointId(null); setPointForm({ name: '', balance: '' }) }} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
                    <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
                  </div>
                </form>
              )}
              {!showPointForm && (
                <button onClick={() => { setPointForm({ name: '', balance: '' }); setEditPointId(null); setShowPointForm(true) }} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ ポイントを追加</button>
              )}
            </div>
          )}

          {/* 見込み給料タブ */}
          {tab === 'income' && (
            <div className="space-y-3">
              {incomes.map((inc) => (
                <div key={inc.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{inc.month.replace('-', '年')}月</p>
                    {inc.bank_accounts
                      ? <p className="text-xs text-indigo-500">🏦 {inc.bank_accounts.name}</p>
                      : <p className="text-xs text-amber-500">口座未設定</p>
                    }
                    {inc.description && <p className="text-xs text-slate-400">{inc.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-700">{yen(inc.amount)}</span>
                    <button onClick={() => deleteIncome(inc.id)} className="text-slate-300 hover:text-red-400">×</button>
                  </div>
                </div>
              ))}
              {showIncomeForm ? (
                <form onSubmit={saveIncome} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                  <h2 className="text-sm font-semibold">見込み給料を設定</h2>
                  <div className="grid grid-cols-2 gap-2">
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
                      {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
