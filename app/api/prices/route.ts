import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')

  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 })

  try {
    // Yahoo Finance非公式APIで株価取得
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 3600 }, // 1時間キャッシュ
      }
    )

    if (!res.ok) throw new Error('Price fetch failed')

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) throw new Error('No data')

    const price = result.meta?.regularMarketPrice
    const currency = result.meta?.currency
    const name = result.meta?.shortName || ticker

    return NextResponse.json({ ticker, price, currency, name })
  } catch {
    return NextResponse.json({ error: '価格取得失敗。手動入力を使用してください。' }, { status: 404 })
  }
}
