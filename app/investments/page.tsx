'use client'

import { useEffect, useState } from 'react'
import { Investment } from '@/lib/supabase'

const MARKET_ITEMS = [
  { label: 'S&P500', ticker: '^GSPC', unit: 'pt' },
  { label: '日経225', ticker: '^N225', unit: 'pt' },
  { label: '金', ticker: 'GC=F', unit: 'USD' },
  { label: 'FANG+', ticker: '^NYFANG', unit: 'pt' },
  { label: 'オルカン参考(ACWI)', ticker: 'ACWI', unit: 'USD' },
]

type MarketPrice = {
  label: string
  ticker: string
  unit: string
  price: number | null
  loading: boolean
}

function formatYen(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n)
}

function formatNumber(n: number, digits = 2) {
  return n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

type PriceCache = Record<string, { price: number; currency: string; fetchedAt: number }>

type InvestmentWithPrice = Investment & {
  currentPrice: number | null
  currency: string
  marketValue: number | null
  gainLoss: number | null
  gainLossPct: number | null
}

const defaultForm = {
  name: '',
  ticker: '',
  shares: '',
  purchase_price: '',
  purchase_date: '',
  currency: 'JPY',
  manual_price: '',
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<InvestmentWithPrice[]>([])
  const [priceCache, setPriceCache] = useState<PriceCache>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [usdJpy, setUsdJpy] = useState<number | null>(null)
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>(
    MARKET_ITEMS.map((m) => ({ ...m, price: null, loading: true }))
  )

  useEffect(() => {
    MARKET_ITEMS.forEach(async (item, i) => {
      try {
        const res = await fetch(`/api/prices?ticker=${encodeURIComponent(item.ticker)}`)
        const json = await res.json()
        setMarketPrices((prev) =>
          prev.map((m, idx) => idx === i ? { ...m, price: json.price ?? null, loading: false } : m)
        )
      } catch {
        setMarketPrices((prev) =>
          prev.map((m, idx) => idx === i ? { ...m, loading: false } : m)
        )
      }
    })
  }, [])

  const fetchInvestments = async () => {
    setLoading(true)
    const data: Investment[] = await fetch('/api/investments').then((r) => r.json())

    // USD/JPYレートを取得
    let rate = usdJpy
    if (!rate) {
      try {
        const res = await fetch('/api/prices?ticker=USDJPY%3DX')
        const json = await res.json()
        if (json.price) { rate = json.price; setUsdJpy(json.price) }
      } catch { /* fallback */ }
    }

    // 各銘柄の時価を取得
    const enriched: InvestmentWithPrice[] = await Promise.all(
      (Array.isArray(data) ? data : []).map(async (inv) => {
        let currentPrice: number | null = inv.manual_price

        if (!currentPrice) {
          const cached = priceCache[inv.ticker]
          if (cached && Date.now() - cached.fetchedAt < 3600000) {
            currentPrice = cached.price
          } else {
            try {
              const res = await fetch(`/api/prices?ticker=${encodeURIComponent(inv.ticker)}`)
              const json = await res.json()
              if (json.price) {
                currentPrice = json.price
                setPriceCache((prev) => ({
                  ...prev,
                  [inv.ticker]: { price: json.price, currency: json.currency, fetchedAt: Date.now() },
                }))
              }
            } catch { /* 取得失敗 */ }
          }
        }

        // USD建て銘柄をJPY換算
        let priceInJpy = currentPrice
        if (currentPrice && inv.currency === 'USD' && rate) {
          priceInJpy = currentPrice * rate
        }

        const purchasePriceJpy = inv.currency === 'USD' && rate
          ? inv.purchase_price * rate
          : inv.purchase_price

        const marketValue = priceInJpy != null ? priceInJpy * inv.shares : null
        const costBasis = purchasePriceJpy * inv.shares
        const gainLoss = marketValue != null ? marketValue - costBasis : null
        const gainLossPct = gainLoss != null && costBasis > 0 ? (gainLoss / costBasis) * 100 : null

        return { ...inv, currentPrice, currency: inv.currency, marketValue, gainLoss, gainLossPct }
      })
    )

    setInvestments(enriched)
    setLoading(false)
  }

  useEffect(() => { fetchInvestments() }, [])

  const totalMarketValue = investments.reduce((s, i) => s + (i.marketValue ?? 0), 0)
  const totalCost = investments.reduce((s, i) => {
    const rate = usdJpy ?? 150
    const priceJpy = i.currency === 'USD' ? i.purchase_price * rate : i.purchase_price
    return s + priceJpy * i.shares
  }, 0)
  const totalGainLoss = totalMarketValue - totalCost
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0

  const handleFetchPrice = async () => {
    if (!form.ticker) return
    setFetchingPrice(true)
    try {
      const res = await fetch(`/api/prices?ticker=${encodeURIComponent(form.ticker)}`)
      const json = await res.json()
      if (json.price) {
        setForm((f) => ({
          ...f,
          name: f.name || json.name || f.ticker,
          currency: json.currency === 'JPY' ? 'JPY' : 'USD',
        }))
        alert(`現在価格: ${json.price} ${json.currency}`)
      } else {
        alert('価格取得失敗。手動で入力してください。')
      }
    } finally {
      setFetchingPrice(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        shares: parseFloat(form.shares),
        purchase_price: parseFloat(form.purchase_price),
        manual_price: form.manual_price ? parseFloat(form.manual_price) : null,
        purchase_date: form.purchase_date || null,
      }),
    })
    setForm(defaultForm)
    setShowForm(false)
    setSubmitting(false)
    fetchInvestments()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この銘柄を削除しますか？')) return
    await fetch(`/api/investments?id=${id}`, { method: 'DELETE' })
    fetchInvestments()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">投資ポートフォリオ</h1>
        <button
          onClick={() => { setForm(defaultForm); setShowForm(true) }}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
        >＋ 追加</button>
      </div>

      {/* 相場モニター */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">相場モニター</h2>
        <div className="space-y-2">
          {marketPrices.map((m) => (
            <div key={m.ticker} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
              <span className="text-sm text-slate-600">{m.label}</span>
              <span className="text-sm font-medium">
                {m.loading ? (
                  <span className="text-slate-300">取得中...</span>
                ) : m.price != null ? (
                  `${m.price.toLocaleString('ja-JP', { maximumFractionDigits: 2 })} ${m.unit}`
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">※ 15〜20分遅延。オルカンはACWI（ETF）の参考値</p>
      </div>

      {/* 追加フォーム */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">銘柄追加</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">銘柄名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
                placeholder="eMAXIS Slim 全世界株式"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">ティッカー</label>
              <div className="flex gap-1 mt-1">
                <input
                  type="text"
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                  className="flex-1 border border-slate-200 rounded-lg p-2 text-sm"
                  placeholder="VOO / 1306"
                  required
                />
                <button
                  type="button"
                  onClick={handleFetchPrice}
                  disabled={fetchingPrice || !form.ticker}
                  className="px-2 py-1 bg-slate-100 rounded-lg text-xs disabled:opacity-50"
                >確認</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">保有口数/株数</label>
              <input
                type="number"
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
                placeholder="10"
                step="0.001"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">取得単価</label>
              <input
                type="number"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
                placeholder="50000"
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">通貨</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="JPY">JPY（円）</option>
                <option value="USD">USD（ドル）</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">取得日（任意）</label>
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">手動価格（自動取得できない場合）</label>
            <input
              type="number"
              value={form.manual_price}
              onChange={(e) => setForm({ ...form, manual_price: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-1"
              placeholder="空欄で自動取得を試みます"
              step="0.01"
            />
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

      {/* ポートフォリオ合計 */}
      {investments.length > 0 && (
        <div className="bg-indigo-600 rounded-xl p-4 text-white">
          <p className="text-xs opacity-80">ポートフォリオ合計（円換算）</p>
          <p className="text-2xl font-bold mt-1">{formatYen(totalMarketValue)}</p>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="opacity-80">取得額 {formatYen(totalCost)}</span>
            <span className={totalGainLoss >= 0 ? 'text-green-300' : 'text-red-300'}>
              {totalGainLoss >= 0 ? '+' : ''}{formatYen(totalGainLoss)}
              （{totalGainLoss >= 0 ? '+' : ''}{formatNumber(totalGainLossPct)}%）
            </span>
          </div>
          {usdJpy && (
            <p className="text-xs opacity-60 mt-1">USD/JPY: {formatNumber(usdJpy, 2)}</p>
          )}
        </div>
      )}

      {/* 銘柄一覧 */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">読み込み中...</div>
      ) : investments.length === 0 ? (
        <div className="text-center py-8 text-slate-400">銘柄を追加してください</div>
      ) : (
        <div className="space-y-3">
          {investments.map((inv) => (
            <div key={inv.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm">{inv.name}</p>
                  <p className="text-xs text-slate-400">{inv.ticker} · {inv.currency} · {inv.shares}口/株</p>
                </div>
                <button
                  onClick={() => handleDelete(inv.id)}
                  className="text-slate-300 hover:text-red-400 text-lg"
                >×</button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <p className="text-xs text-slate-400">現在価格</p>
                  <p className="text-sm font-medium">
                    {inv.currentPrice != null ? formatNumber(inv.currentPrice, 2) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">評価額（円）</p>
                  <p className="text-sm font-medium">
                    {inv.marketValue != null ? formatYen(inv.marketValue) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">損益</p>
                  <p className={`text-sm font-bold ${inv.gainLoss == null ? 'text-slate-400' : inv.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {inv.gainLoss != null
                      ? `${inv.gainLoss >= 0 ? '+' : ''}${formatNumber(inv.gainLossPct ?? 0)}%`
                      : '—'}
                  </p>
                </div>
              </div>
              {inv.manual_price && (
                <p className="text-xs text-amber-500 mt-2">※ 手動価格を使用中</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
