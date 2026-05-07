import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const month = new URL(req.url).searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })
  const { data, error } = await supabase
    .from('card_monthly_overrides')
    .select('*')
    .eq('month', month)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { credit_card_id, month, override_amount } = await req.json()
  const { data, error } = await supabase
    .from('card_monthly_overrides')
    .upsert({ credit_card_id, month, override_amount }, { onConflict: 'credit_card_id,month' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  const { error } = await supabase.from('card_monthly_overrides').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
