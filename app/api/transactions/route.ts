import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('transactions')
    .select('*, categories(*), credit_cards(name, color), bank_accounts(name), point_balances(name)')
    .order('date', { ascending: false })
    // 同じ日付の中では登録が新しい順に並べる（並び順を安定させるため）
    .order('created_at', { ascending: false })

  if (from || to) {
    // 期間指定（from/to はどちらも当日を含む）。month より優先する
    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)
  } else if (month) {
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
  const { date, amount, type, category_id, memo, credit_card_id, bank_account_id, point_balance_id, transfer_direction } = body

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      date, amount, type, category_id, memo,
      credit_card_id: credit_card_id || null,
      bank_account_id: bank_account_id || null,
      point_balance_id: point_balance_id || null,
      transfer_direction: transfer_direction || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 残高自動更新
  if (type === 'income') {
    if (bank_account_id) {
      const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', bank_account_id).single()
      if (acc) await supabase.from('bank_accounts').update({ balance: Number(acc.balance) + amount }).eq('id', bank_account_id)
    } else {
      const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
      if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + amount, updated_at: new Date().toISOString() }).eq('id', cash.id)
    }
  } else if (type === 'expense') {
    if (point_balance_id) {
      // ポイント払い → ポイント残高を減算
      const { data: pb } = await supabase.from('point_balances').select('balance').eq('id', point_balance_id).single()
      if (pb) await supabase.from('point_balances').update({ balance: Number(pb.balance) - amount }).eq('id', point_balance_id)
    } else if (!credit_card_id) {
      // 現金払い → 現金を減算
      const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
      if (cash) await supabase.from('cash_balance').update({ amount: cash.amount - amount, updated_at: new Date().toISOString() }).eq('id', cash.id)
    }
    // カード払いはcredit_card_idで紐付けのみ
  } else if (type === 'transfer' && bank_account_id) {
    // 銀行⇔現金の振替: withdraw=銀行→現金（引き出し） / deposit=現金→銀行（預け入れ）
    const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', bank_account_id).single()
    const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
    const bankDelta = transfer_direction === 'withdraw' ? -amount : amount
    const cashDelta = transfer_direction === 'withdraw' ? amount : -amount
    if (acc) await supabase.from('bank_accounts').update({ balance: Number(acc.balance) + bankDelta }).eq('id', bank_account_id)
    if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + cashDelta, updated_at: new Date().toISOString() }).eq('id', cash.id)
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { id, amount, date, category_id } = await req.json()
  const { data: txn } = await supabase.from('transactions').select('*').eq('id', id).single()
  if (!txn) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // 金額が変更される場合のみ残高を再計算する
  if (amount !== undefined && amount !== txn.amount) {
    const diff = amount - txn.amount
    if (txn.type === 'income') {
      if (txn.bank_account_id) {
        const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', txn.bank_account_id).single()
        if (acc) await supabase.from('bank_accounts').update({ balance: Number(acc.balance) + diff }).eq('id', txn.bank_account_id)
      } else {
        const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
        if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + diff }).eq('id', cash.id)
      }
    } else if (txn.type === 'expense') {
      if (txn.point_balance_id) {
        const { data: pb } = await supabase.from('point_balances').select('id, balance').eq('id', txn.point_balance_id).single()
        if (pb) await supabase.from('point_balances').update({ balance: Number(pb.balance) - diff }).eq('id', pb.id)
      } else if (!txn.credit_card_id) {
        const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
        if (cash) await supabase.from('cash_balance').update({ amount: cash.amount - diff }).eq('id', cash.id)
      }
    } else if (txn.type === 'transfer' && txn.bank_account_id) {
      const bankDelta = txn.transfer_direction === 'withdraw' ? -diff : diff
      const cashDelta = txn.transfer_direction === 'withdraw' ? diff : -diff
      const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', txn.bank_account_id).single()
      if (acc) await supabase.from('bank_accounts').update({ balance: Number(acc.balance) + bankDelta }).eq('id', txn.bank_account_id)
      const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
      if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + cashDelta }).eq('id', cash.id)
    }
  }

  const updates: Record<string, unknown> = {}
  if (amount !== undefined) updates.amount = amount
  if (date !== undefined) updates.date = date
  if (category_id !== undefined) updates.category_id = category_id
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select('*, categories(*), credit_cards(name, color), bank_accounts(name), point_balances(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')

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
    } else if (txn.type === 'expense') {
      if (txn.point_balance_id) {
        // ポイント払いを戻す
        const { data: pb } = await supabase.from('point_balances').select('balance').eq('id', txn.point_balance_id).single()
        if (pb) await supabase.from('point_balances').update({ balance: Number(pb.balance) + txn.amount }).eq('id', txn.point_balance_id)
      } else if (!txn.credit_card_id) {
        // 現金払いを戻す
        const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
        if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + txn.amount, updated_at: new Date().toISOString() }).eq('id', cash.id)
      }
    } else if (txn.type === 'transfer' && txn.bank_account_id) {
      // 振替を取り消す（反対方向に戻す）
      const bankDelta = txn.transfer_direction === 'withdraw' ? txn.amount : -txn.amount
      const cashDelta = txn.transfer_direction === 'withdraw' ? -txn.amount : txn.amount
      const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', txn.bank_account_id).single()
      if (acc) await supabase.from('bank_accounts').update({ balance: Number(acc.balance) + bankDelta }).eq('id', txn.bank_account_id)
      const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
      if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + cashDelta, updated_at: new Date().toISOString() }).eq('id', cash.id)
    }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
