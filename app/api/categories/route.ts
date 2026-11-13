import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// カテゴリの並び順は app_settings（id = 'category_order'）に、IDの並びとして保存している。
// ここで並べて返すので、どの画面のプルダウンも同じ順番になる
const CATEGORY_ORDER_ID = 'category_order'

export async function GET() {
  const [{ data, error }, { data: orderRow }] = await Promise.all([
    supabase.from('categories').select('*').order('type').order('name'),
    supabase.from('app_settings').select('value').eq('id', CATEGORY_ORDER_ID).maybeSingle(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids: string[] = Array.isArray(orderRow?.value?.ids) ? orderRow.value.ids : []
  const rank = new Map(ids.map((id, i) => [id, i]))
  // 種類（収入・支出）ごとに、保存した順番 → 順番に入っていないもの（新しく追加したもの）は名前順で後ろ
  const sorted = [...(data ?? [])].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type)
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return ra !== rb ? ra - rb : a.name.localeCompare(b.name, 'ja')
  })
  return NextResponse.json(sorted)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, type, budget_limit, color, icon } = body

  const { data, error } = await supabase
    .from('categories')
    .insert({ name, type, budget_limit, color, icon })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
