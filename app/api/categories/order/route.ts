import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// カテゴリの並び順を保存する（カテゴリIDを表示したい順に並べた配列）
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string') : null
  if (!ids) return NextResponse.json({ error: 'ids is required' }, { status: 400 })

  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 'category_order', value: { ids }, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ids })
}
