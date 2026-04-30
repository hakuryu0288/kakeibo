'use client'

import { useEffect, useState } from 'react'
import { ResaleItem } from '@/lib/supabase'

function yen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

const STATUS_LABELS = { holding: '在庫中', listed: '出品中', sold: '売却済' }
const STATUS_COLORS = { holding: 'bg-blue-100 text-blue-700', listed: 'bg-yellow-100 text-yellow-700', sold: 'bg-green-100 text-green-700' }

type FormState = { name: string; quantity: string; purchase_price: string; sell_price: string; status: 'holding' | 'listed' | 'sold'; platform: string; note: string }
const defaultForm: FormState = { name: '', quantity: '1', purchase_price: '', sell_price: '', status: 'holding', platform: '', note: '' }

export default function ResalePage() {
  const [items, setItems] = useState<ResaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'holding' | 'listed' | 'sold'>('all')
  const [form, setForm] = useState<FormState>(defaultForm)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const fetchItems = () => {
    fetch('/api/resale-items').then((r) => r.json()).then((data) => {
      setItems(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchItems() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      quantity: parseInt(form.quantity),
      purchase_price: parseInt(form.purchase_price),
      sell_price: form.sell_price ? parseInt(form.sell_price) : null,
      status: form.status,
      platform: form.platform || null,
      note: form.note || null,
    }
    if (editId) {
      await fetch('/api/resale-items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...payload }) })
    } else {
      await fetch('/api/resale-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setForm(defaultForm)
    setShowForm(false)
    setEditId(null)
    fetchItems()
  }

  const handleEdit = (item: ResaleItem) => {
    setForm({
      name: item.name,
      quantity: String(item.quantity),
      purchase_price: String(item.purchase_price),
      sell_price: item.sell_price ? String(item.sell_price) : '',
      status: item.status,
      platform: item.platform ?? '',
      note: item.note ?? '',
    })
    setEditId(item.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch(`/api/resale-items?id=${id}`, { method: 'DELETE' })
    fetchItems()
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  // 集計
  const holdingItems = items.filter((i) => i.status !== 'sold')
  const totalInvestment = holdingItems.reduce((s, i) => s + i.purchase_price * i.quantity, 0)
  const soldItems = items.filter((i) => i.status === 'sold')
  const totalProfit = soldItems.reduce((s, i) => s + ((i.sell_price ?? 0) - i.purchase_price) * i.quantity, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">フリマ商材</h1>

      {/* 集計 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-600">在庫仕入れ額合計</p>
          <p className="text-lg font-bold text-blue-700">{yen(totalInvestment)}</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className={`text-xs ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>売却益合計</p>
          <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{yen(totalProfit)}</p>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {(['all', 'holding', 'listed', 'sold'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
            {f === 'all' ? 'すべて' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">{editId ? '商材を編集' : '商材を追加'}</h2>
          <input type="text" placeholder="商品名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="個数" value={form.quantity} min={1} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
            <input type="number" placeholder="仕入れ価格" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" required />
            <input type="number" placeholder="売値（任意）" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ResaleItem['status'] })} className="border border-slate-200 rounded-lg p-2 text-sm">
              <option value="holding">在庫中</option>
              <option value="listed">出品中</option>
              <option value="sold">売却済</option>
            </select>
            <input type="text" placeholder="プラットフォーム（メルカリ等）" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="border border-slate-200 rounded-lg p-2 text-sm" />
          </div>
          <input type="text" placeholder="メモ（任意）" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(defaultForm) }} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">キャンセル</button>
            <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">保存</button>
          </div>
        </form>
      )}

      {loading ? <div className="text-center py-8 text-slate-400">読み込み中...</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400">商材がありません</div>
          ) : (
            filtered.map((item) => {
              const profit = item.sell_price != null ? (item.sell_price - item.purchase_price) * item.quantity : null
              return (
                <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.quantity}個　仕入 {yen(item.purchase_price)}/個
                        {item.platform && `　${item.platform}`}
                      </p>
                      {item.note && <p className="text-xs text-slate-400">{item.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{yen(item.purchase_price * item.quantity)}</p>
                      {profit != null && (
                        <p className={`text-xs font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {profit >= 0 ? '+' : ''}{yen(profit)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleEdit(item)} className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded">編集</button>
                    <button onClick={() => handleDelete(item.id)} className="text-xs text-red-400 px-2 py-1 hover:bg-red-50 rounded">削除</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {!showForm && (
        <button onClick={() => { setForm(defaultForm); setEditId(null); setShowForm(true) }}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold">＋ 商材を追加</button>
      )}
    </div>
  )
}
