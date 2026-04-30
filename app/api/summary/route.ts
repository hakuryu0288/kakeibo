import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function nextMonthStr(month: string) {
  const d = new Date(`${month}-01`)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function GET(req: NextRequest) {
  const month = new URL(req.url).searchParams.get('month') ?? currentMonth()

  const today = new Date()
  const todayDay = today.getDate()

  const [
    { data: bankAccounts },
    { data: creditCards },
    { data: subscriptions },
    { data: fixedCosts },
    { data: expectedIncomes },
    { data: plannedExpenses },
    { data: transactions },
    { data: pointRedemptions },
    { data: resaleItems },
    { data: nisaData },
    { data: cashData },
  ] = await Promise.all([
    supabase.from('bank_accounts').select('*'),
    supabase.from('credit_cards').select('*'),
    supabase.from('subscriptions').select('*').eq('is_active', true),
    supabase.from('fixed_costs').select('*').eq('is_active', true),
    supabase.from('expected_income').select('*').eq('month', month),
    supabase.from('planned_expenses').select('*').eq('month', month).eq('is_done', false),
    supabase.from('transactions').select('*').gte('date', `${month}-01`).lt('date', nextMonthStr(month)),
    supabase.from('point_redemptions').select('*').eq('apply_month', month),
    supabase.from('resale_items').select('*'),
    supabase.from('nisa_settings').select('*').limit(1).single(),
    supabase.from('cash_balance').select('*').limit(1).single(),
  ])

  // 銀行残高合計
  const totalBankBalance = (bankAccounts ?? []).reduce((s: number, a: { balance: number }) => s + Number(a.balance), 0)

  // 固定費合計（口座引き落とし）- billing_day が今日より先のもののみ（済みは口座残高に反映済み）
  const totalFixedCosts = (fixedCosts ?? [])
    .filter((f: { billing_day: number }) => f.billing_day > todayDay)
    .reduce((s: number, f: { amount: number }) => s + f.amount, 0)

  // 見込み給料
  const totalExpectedIncome = (expectedIncomes ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)

  // 今月カード請求（カードごと） - サブスクは手動入力済みのため除外
  const cardCharges: Record<string, number> = {}
  for (const card of (creditCards ?? [])) {
    const txnTotal = (transactions ?? [])
      .filter((t: { type: string; credit_card_id: string }) => t.type === 'expense' && t.credit_card_id === card.id)
      .reduce((s: number, t: { amount: number }) => s + t.amount, 0)

    const pointTotal = (pointRedemptions ?? [])
      .filter((p: { credit_card_id: string }) => p.credit_card_id === card.id)
      .reduce((s: number, p: { amount: number }) => s + p.amount, 0)

    cardCharges[card.id] = txnTotal - pointTotal
  }
  const totalCardCharges = Object.values(cardCharges).reduce((s, v) => s + v, 0)

  // 未請求サブスク（billing_day が今日より先 = まだ手動入力していない）
  const pendingSubTotal = (subscriptions ?? [])
    .filter((s: { billing_day: number }) => s.billing_day > todayDay)
    .reduce((s: number, sub: { amount: number }) => s + sub.amount, 0)

  // 確定出費合計
  const totalPlannedExpenses = (plannedExpenses ?? []).reduce((s: number, p: { amount: number }) => s + p.amount, 0)

  // 見込み支出 = 今月カード請求 + 未請求サブスク + 確定出費
  const totalExpectedExpense = totalCardCharges + pendingSubTotal + totalPlannedExpenses

  // 次月末残高予測
  const projectedBalance = totalBankBalance - totalFixedCosts + totalExpectedIncome - totalExpectedExpense

  // 商材評価額（売価ベース、売価未設定は仕入れ額）
  const resaleValue = (resaleItems ?? []).reduce(
    (s: number, item: { purchase_price: number; sell_price: number | null; quantity: number }) =>
      s + (item.sell_price ?? item.purchase_price) * item.quantity,
    0
  )

  // 総資産
  const nisaBalance = nisaData ? Number(nisaData.current_balance) : 0
  const cashAmount = cashData ? Number(cashData.amount) : 0
  const totalAssets = projectedBalance + nisaBalance + cashAmount + resaleValue

  return NextResponse.json({
    month,
    totalBankBalance,
    totalFixedCosts,
    totalExpectedIncome,
    totalCardCharges,
    pendingSubTotal,
    totalPlannedExpenses,
    totalExpectedExpense,
    projectedBalance,
    resaleValue,
    nisaBalance,
    cashAmount,
    totalAssets,
    cardCharges,
    bankAccounts: bankAccounts ?? [],
  })
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
