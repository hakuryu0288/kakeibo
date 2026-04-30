import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  let query = supabase
    .from('transactions')
    .select('*, categories(*), credit_cards(name, color), bank_accounts(name)')
    .order('date', { ascending: false })

  if (month) {
    const start = `${month}-01`
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
  const { date, amount, type, category_id, memo, credit_card_id, bank_account_id } = body

  const { data, error } = await supabase
    .from('transactions')
    .insert({ date, amount, type, category_id, memo, credit_card_id: credit_card_id || null, bank_account_id: bank_account_id || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 残高自動更新
  if (type === 'income') {
    if (bank_account_id) {
      // 指定口座に入金
      const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', bank_account_id).single()
      if (acc) await supabase.from('bank_accounts').update({ balance: Number(acc.balance) + amount }).eq('id', bank_account_id)
    } else {
      // 現金に入金
      const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
      if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + amount, updated_at: new Date().toISOString() }).eq('id', cash.id)
    }
  } else if (type === 'expense' && !credit_card_id) {
    // 現金支払い → 現金を減算
    const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
    if (cash) await supabase.from('cash_balance').update({ amount: cash.amount - amount, updated_at: new Date().toISOString() }).eq('id', cash.id)
  }
  // カード支払いは credit_card_id で紐付けるだけ（残高はtransactionsから集計）

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')

  // 削除前に取引内容を取得して残高を戻す
  const { data: txn } = await supabase.from('transactions').select('*').eq('id', id).single()

  if (txn) {
    if (txn.type === 'income') {
      if (txn.bank_account_id) {
        const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', txn.bank_account_id).single()
        if (acc) await supabase.from('bank_accounts').update({ balance: Number(acc.balance) - txn.amount }).eq('id', txn.bank_account_id)
      } else {
        const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
        if (cash) await supabase.from('cash_balance').update({ amount: cash.amount - txn.amount, updated_at: new Date().toISOString() }).eq('id', cash.id)
      }
    } else if (txn.type === 'expense' && !txn.credit_card_id) {
      const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
      if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + txn.amount, updated_at: new Date().toISOString() }).eq('id', cash.id)
    }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
