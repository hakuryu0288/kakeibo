'use client'

import { useEffect, useState } from 'react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'

// 初心者向けの相場グラフ。それぞれ「何の値か」を一言添える
const MARKETS = [
  { ticker: '^GSPC', label: 'S&P500', unit: 'pt', desc: 'アメリカの代表的な大企業500社の株価をまとめた数字。アメリカ株全体の調子の目安です。' },
  { ticker: 'ACWI', label: '全世界株', unit: 'ドル', desc: '世界中の株にまとめて投資するファンド（ACWI）。「オルカン」とほぼ同じ動きをします。' },
  { ticker: '^N225', label: '日経平均', unit: '円', desc: '日本の代表的な225社の株価の平均。日本株全体の調子の目安です。' },
  { ticker: '^NYFANG', label: 'FANG+', unit: 'pt', desc: 'アメリカの大手IT企業10社ほどの株価指数。上がるときも下がるときも動きが大きめです。' },
  { ticker: 'GC=F', label: '金（ゴールド）', unit: 'ドル', desc: '金1オンス（約31g）の値段。株が不安なときに買われやすい資産です。' },
  { ticker: 'USDJPY=X', label: 'ドル円', unit: '円', desc: '1ドルが何円か。上がる＝円安。円安だと、外国の株や投資信託は円にしたとき増えて見えます。' },
] as const

const PERIODS = [
  { key: '1mo', label: '1か月' },
  { key: '6mo', label: '半年' },
  { key: '1y', label: '1年' },
  { key: '5y', label: '5年' },
] as const
type PeriodKey = (typeof PERIODS)[number]['key']

type Point = { t: number; c: number }
type Series = { price: number | null; points: Point[] } | 'error' | undefined

const UP = '#16a34a'
const DOWN = '#dc2626'

function fmt(n: number) {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: n < 1000 ? 2 : 0 })
}

function fmtDate(t: number, period: PeriodKey) {
  const d = new Date(t * 1000)
  return period === '5y' || period === '1y'
    ? `${d.getFullYear() % 100}/${d.getMonth() + 1}`
    : `${d.getMonth() + 1}/${d.getDate()}`
}

export default function MarketCharts() {
  const [period, setPeriod] = useState<PeriodKey>('1y')
  // 期間ごとに一度読んだ結果は覚えておく（切り替えても同じ通信をしない）
  const [data, setData] = useState<Record<string, Series>>({})
  const [openTicker, setOpenTicker] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    MARKETS.forEach(async (m) => {
      const key = `${m.ticker}@${period}`
      if (data[key] !== undefined) return
      try {
        const json = await fetch(`/api/prices?ticker=${encodeURIComponent(m.ticker)}&range=${period}`).then((r) => r.json())
        const points: Point[] = Array.isArray(json.points) ? json.points : []
        setData((prev) => ({ ...prev, [key]: points.length > 1 ? { price: json.price ?? null, points } : 'error' }))
      } catch {
        setData((prev) => ({ ...prev, [key]: 'error' }))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? ''

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">相場の動き</h2>
        <button onClick={() => setShowHelp((v) => !v)} className="text-xs text-indigo-600">
          {showHelp ? '閉じる' : 'グラフの見方'}
        </button>
      </div>

      {showHelp && (
        <div className="text-xs text-slate-600 bg-indigo-50 rounded-lg p-3 space-y-1.5 leading-relaxed">
          <p>・線が<span className="text-green-700 font-semibold">右肩上がり（緑）</span>なら、選んだ期間の最初より値上がりしています。<span className="text-red-600 font-semibold">赤</span>は値下がりです。</p>
          <p>・％は「期間の最初と比べて何％増えたか・減ったか」です。例：+10% なら、10万円分持っていたら約11万円になった計算です。</p>
          <p>・短い期間は上下にガタガタ動きます。長く持つ投資なら「1年」「5年」の向きを見るのがおすすめです。</p>
          <p>・カードをタップすると、日付と値が入った大きいグラフになります。値は15〜20分遅れの参考値です。</p>
        </div>
      )}

      <div className="flex rounded-lg overflow-hidden border border-slate-200">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-1.5 text-xs transition-colors ${period === p.key ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-500'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {MARKETS.map((m) => {
          const s = data[`${m.ticker}@${period}`]
          const isOpen = openTicker === m.ticker
          const ok = s && s !== 'error'
          const first = ok ? s.points[0].c : 0
          const last = ok ? (s.price ?? s.points[s.points.length - 1].c) : 0
          const changePct = ok && first ? ((last - first) / first) * 100 : 0
          const up = changePct >= 0
          const color = up ? UP : DOWN
          return (
            <div
              key={m.ticker}
              role="button"
              tabIndex={0}
              onClick={() => setOpenTicker(isOpen ? null : m.ticker)}
              onKeyDown={(e) => { if (e.key === 'Enter') setOpenTicker(isOpen ? null : m.ticker) }}
              className={`w-full text-left cursor-pointer [&_*:focus]:outline-none rounded-lg border p-3 transition-colors ${isOpen ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-100 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{m.label}</p>
                  <p className="text-xs text-slate-500">
                    {ok ? `${fmt(last)} ${m.unit}` : s === 'error' ? '取得できませんでした' : '読み込み中…'}
                  </p>
                </div>
                {/* 小さいグラフ */}
                <div className="w-24 h-10 shrink-0">
                  {ok && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={s.points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Area type="monotone" dataKey="c" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="w-16 text-right shrink-0">
                  {ok && (
                    <>
                      <p className="text-sm font-bold" style={{ color }}>{up ? '+' : ''}{changePct.toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-400">{periodLabel}</p>
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs text-slate-600 leading-relaxed">{m.desc}</p>
                  {ok && (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={s.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                          <XAxis dataKey="t" tickFormatter={(t) => fmtDate(t, period)} tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={28} axisLine={false} tickLine={false} />
                          <YAxis domain={['auto', 'auto']} tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={48} axisLine={false} tickLine={false} />
                          <ReferenceLine y={first} stroke="#cbd5e1" strokeDasharray="3 3" />
                          <Tooltip
                            labelFormatter={(t) => new Date(Number(t) * 1000).toLocaleDateString('ja-JP')}
                            formatter={(v) => [`${fmt(Number(v))} ${m.unit}`, m.label]}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Area type="monotone" dataKey="c" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {ok && <p className="text-[11px] text-slate-400">点線は{periodLabel}前の値です。点線より上なら値上がり、下なら値下がり。</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
