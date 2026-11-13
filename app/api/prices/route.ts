import { NextRequest, NextResponse } from 'next/server'

// グラフ用の期間。期間が長いほど点を間引く（1日ごと → 1週ごと）
const RANGES: Record<string, string> = {
  '1mo': '1d',
  '6mo': '1d',
  '1y': '1d',
  '5y': '1wk',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')
  const range = searchParams.get('range')

  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 })

  const useRange = range && RANGES[range] ? range : null
  const interval = useRange ? RANGES[useRange] : '1d'

  try {
    // Yahoo Finance非公式APIで株価取得（同じURLは1時間キャッシュするので、何度開いても通信は増えない）
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${useRange ?? '1d'}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 3600 },
      }
    )

    if (!res.ok) throw new Error('Price fetch failed')

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) throw new Error('No data')

    const price = result.meta?.regularMarketPrice
    const currency = result.meta?.currency
    const name = result.meta?.shortName || ticker

    if (!useRange) return NextResponse.json({ ticker, price, currency, name })

    // 推移（日時と終値）。値がない日は飛ばす
    const times: number[] = result.timestamp ?? []
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
    const points = times
      .map((t, i) => ({ t, c: closes[i] }))
      .filter((p): p is { t: number; c: number } => typeof p.c === 'number')
      .map((p) => ({ t: p.t, c: Math.round(p.c * 100) / 100 }))

    return NextResponse.json({ ticker, price, currency, name, range: useRange, points })
  } catch {
    return NextResponse.json({ error: '価格取得失敗。手動入力を使用してください。' }, { status: 404 })
  }
}
