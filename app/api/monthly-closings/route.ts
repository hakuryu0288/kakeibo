import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function prevMonth(month: string): string {
  const d = new Date(`${month}-01`)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildProcess(month: string): Promise<any> {
  const last = prevMonth(month)

  const [
    { data: incomes },
    { data: cards },
    { data: overrides },
    { data: lastTxns },
    { data: fixedCosts },
    { data: bankAccounts },
  ] = await Promise.all([
    supabase.from('expected_income').select('*').eq('month', month).eq('is_confirmed', false),
    supabase.from('credit_cards').select('*').not('bank_account_id', 'is', null),
    supabase.from('card_monthly_overrides').select('*').eq('month', last),
    supabase.from('transactions').select('credit_card_id, amount').eq('type', 'expense')
      .gte('date', `${last}-01`).lt('date', `${month}-01`).not('credit_card_id', 'is', null),
    supabase.from('fixed_costs').select('*').eq('is_active', true).not('bank_account_id', 'is', null),
    supabase.from('bank_accounts').select('*'),
  ])

  const bankName: Record<string, string> = {}
  for (const acc of (bankAccounts ?? [])) bankName[acc.id] = acc.name

  const bankDeltas: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const salary: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const card_bills: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fixed_costs_detail: any[] = []

  // 給料加算
  for (const inc of (incomes ?? [])) {
    if (!inc.bank_account_id) continue
    bankDeltas[inc.bank_account_id] = (bankDeltas[inc.bank_account_id] ?? 0) + inc.amount
    salary.push({
      income_id: inc.id,
      description: inc.description,
      amount: inc.amount,
      bank_account_id: inc.bank_account_id,
      bank_name: bankName[inc.bank_account_id] ?? null,
    })
  }

  // 先月カード引き落とし
  for (const card of (cards ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ov = (overrides ?? []).find((o: any) => o.credit_card_id === card.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txnSum = (lastTxns ?? []).filter((t: any) => t.credit_card_id === card.id).reduce((s: number, t: any) => s + t.amount, 0)
    const amount = ov ? ov.override_amount : txnSum
    if (amount === 0) continue
    bankDeltas[card.bank_account_id] = (bankDeltas[card.bank_account_id] ?? 0) - amount
    card_bills.push({
      credit_card_id: card.id,
      card_name: card.name,
      amount,
      bank_account_id: card.bank_account_id,
      bank_name: bankName[card.bank_account_id] ?? null,
    })
  }

  // 今月固定費（口座引落）
  for (const fc of (fixedCosts ?? [])) {
    bankDeltas[fc.bank_account_id] = (bankDeltas[fc.bank_account_id] ?? 0) - fc.amount
    fixed_costs_detail.push({
      fixed_cost_id: fc.id,
      name: fc.name,
      amount: fc.amount,
      bank_account_id: fc.bank_account_id,
      bank_name: bankName[fc.bank_account_id] ?? null,
    })
  }

  const bank_deltas = Object.entries(bankDeltas).map(([bank_account_id, delta]) => ({
    bank_account_id,
    delta,
    bank_name: bankName[bank_account_id] ?? null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const income_ids = (incomes ?? []).map((i: any) => i.id)

  return {
    bank_deltas,
    income_ids,
    details: { salary, card_bills, fixed_costs: fixed_costs_detail },
    bankAccounts: bankAccounts ?? [],
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  const isPreview = url.searchParams.get('preview') === 'true'

  if (!month) {
    const { data, error } = await supabase.from('monthly_closings').select('*').order('month', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (isPreview) {
    const { bank_deltas, details } = await buildProcess(month)
    return NextResponse.json({ bank_deltas, details })
  }

  const { data } = await supabase.from('monthly_closings').select('*').eq('month', month).maybeSingle()
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { month } = await req.json()

  const { data: existing } = await supabase.from('monthly_closings').select('id').eq('month', month).maybeSingle()
  if (existing) return NextResponse.json({ error: 'この月はすでに月次処理済みです' }, { status: 400 })

  const { bank_deltas, income_ids, details, bankAccounts } = await buildProcess(month)

  // 銀行残高を更新
  for (const { bank_account_id, delta } of bank_deltas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acc = (bankAccounts as any[]).find((a: any) => a.id === bank_account_id)
    if (!acc) continue
    await supabase.from('bank_accounts').update({ balance: acc.balance + delta }).eq('id', bank_account_id)
  }

  // 見込み給料を処理済みにマーク
  if (income_ids.length > 0) {
    await supabase.from('expected_income')
      .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
      .in('id', income_ids)
  }

  const snapshot = { bank_deltas, income_ids, details }
  const { data, error } = await supabase.from('monthly_closings').insert({ month, snapshot }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const month = new URL(req.url).searchParams.get('month')

  const { data: closing } = await supabase.from('monthly_closings').select('*').eq('month', month).maybeSingle()
  if (!closing) return NextResponse.json({ error: '処理記録が見つかりません' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot = closing.snapshot as any
  const { data: bankAccounts } = await supabase.from('bank_accounts').select('*')

  // 銀行残高を元に戻す
  for (const { bank_account_id, delta } of (snapshot.bank_deltas ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acc = (bankAccounts ?? []).find((a: any) => a.id === bank_account_id)
    if (!acc) continue
    await supabase.from('bank_accounts').update({ balance: acc.balance - delta }).eq('id', bank_account_id)
  }

  // 見込み給料を未処理に戻す
  if ((snapshot.income_ids ?? []).length > 0) {
    await supabase.from('expected_income')
      .update({ is_confirmed: false, confirmed_at: null })
      .in('id', snapshot.income_ids)
  }

  await supabase.from('monthly_closings').delete().eq('id', closing.id)
  return NextResponse.json({ success: true })
}
