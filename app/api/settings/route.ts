import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { EMPTY_DEFAULTS, normalizeDefaults } from '@/lib/input-defaults'

// アプリの設定（今は「収支入力の初期値」だけ）。1行だけのテーブルに保存する
const SETTINGS_ID = 'input_defaults'

export async function GET() {
  const { data, error } = await supabase.from('app_settings').select('value').eq('id', SETTINGS_ID).maybeSingle()
  // テーブルがまだない（SQL未実行）ときも、初期値なしとして動くようにする
  if (error) return NextResponse.json({ ...EMPTY_DEFAULTS, _missing: true })
  return NextResponse.json(normalizeDefaults(data?.value))
}

export async function PUT(req: NextRequest) {
  const value = normalizeDefaults(await req.json().catch(() => null))
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, value, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(value)
}
