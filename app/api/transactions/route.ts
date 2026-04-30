import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM形式

  let query = supabase
    .from('transactions')
    .select('*, categories(*)')
    .order('date', { ascending: false })

  if (month) {
    const start = `${month}-01`
    // 翌月1日を算出して「その前日まで」を範囲にする（月末日が何日かを気にしなくて済む）
    const nextMonth = new Date(`${month}-01`)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`
    query = query.gte('date', start).lt('date', end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, amount, type, category_id, memo } = body

  const { data, error } = await supabase
    .from('transactions')
    .insert({ date, amount, type, category_id, memo })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
