import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const todayDay = now.getDate()
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const start = `${monthStr}-01`
  const nextMonthDate = new Date(year, month, 1)
  const end = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`

  // 請求日が今日以前のアクティブサブスク（カード紐付きのみ）
  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('is_active', true)
    .not('credit_card_id', 'is', null)
    .lte('billing_day', todayDay)

  if (subErr || !subs || subs.length === 0) return NextResponse.json({ created: [] })

  // 今月すでに登録済みのサブスク取引を取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subIds = subs.map((s: any) => s.id as string)
  const { data: existingTxns, error: txnErr } = await supabase
    .from('transactions')
    .select('subscription_id')
    .gte('date', start)
    .lt('date', end)
    .in('subscription_id', subIds)

  // subscription_id カラムが存在しない場合はスキップ（SQLが未実行）
  if (txnErr) return NextResponse.json({ created: [], skipped: 'column not found' })

  const appliedIds = new Set((existingTxns ?? []).map((t: { subscription_id: string }) => t.subscription_id))
  const toCreate = subs.filter((s: { id: string }) => !appliedIds.has(s.id))

  const created: unknown[] = []
  for (const sub of toCreate) {
    // 月末を超える日付を補正（例：2月31日→2月28日）
    const d = new Date(year, month - 1, sub.billing_day)
    if (d.getMonth() !== month - 1) d.setDate(0)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        date: dateStr,
        amount: sub.amount,
        type: 'expense',
        credit_card_id: sub.credit_card_id,
        subscription_id: sub.id,
        category_id: sub.category_id ?? null,
        memo: sub.name,
      })
      .select()
      .single()

    if (!error && data) created.push(data)
  }

  return NextResponse.json({ created })
}
