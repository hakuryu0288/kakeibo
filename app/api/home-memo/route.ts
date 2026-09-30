import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ホーム画面のメモは1件だけなので固定IDで扱う
const MEMO_ID = 'home'

export async function GET() {
  const { data, error } = await supabase.from('home_memo').select('content, updated_at').eq('id', MEMO_ID).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { content: '', updated_at: null })
}

export async function PUT(req: NextRequest) {
  const { content, base_updated_at, force } = await req.json()
  if (typeof content !== 'string') return NextResponse.json({ error: 'content is required' }, { status: 400 })

  // 別の端末が先に保存していた場合は上書きせずに知らせる（force=true なら上書き）
  if (!force) {
    const { data: current } = await supabase.from('home_memo').select('content, updated_at').eq('id', MEMO_ID).maybeSingle()
    if (current && current.updated_at !== base_updated_at) {
      return NextResponse.json({ error: 'conflict', current }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('home_memo')
    .upsert({ id: MEMO_ID, content, updated_at: new Date().toISOString() })
    .select('content, updated_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
