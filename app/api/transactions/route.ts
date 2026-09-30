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

type BalanceTarget = {
  type: string
  amount: number
  credit_card_id: string | null
  bank_account_id: string | null
  point_balance_id: string | null
  transfer_direction: string | null
}

// 取引が残高に与える影響を反映する（sign=1で反映、sign=-1で取り消し）
async function applyBalance(t: BalanceTarget, sign: 1 | -1) {
  const amt = t.amount * sign
  const addCash = async (delta: number) => {
    const { data: cash } = await supabase.from('cash_balance').select('*').limit(1).single()
    if (cash) await supabase.from('cash_balance').update({ amount: cash.amount + delta, updated_at: new Date().toISOString() }).eq('id', cash.id)
  }
  const addBank = async (bankId: string, delta: number) => {
    const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('id', bankId).single()
    if (acc) await supabase.from('bank_accounts').update({ balance: Number(acc.balance) + delta }).eq('id', bankId)
  }

  if (t.type === 'income') {
    if (t.bank_account_id) await addBank(t.bank_account_id, amt)
    else await addCash(amt)
  } else if (t.type === 'expense') {
    if (t.point_balance_id) {
      const { data: pb } = await supabase.from('point_balances').select('balance').eq('id', t.point_balance_id).single()
      if (pb) await supabase.from('point_balances').update({ balance: Number(pb.balance) - amt }).eq('id', t.point_balance_id)
    } else if (!t.credit_card_id) {
      await addCash(-amt)
    }
    // カード払いは残高に影響しない
  } else if (t.type === 'transfer' && t.bank_account_id) {
    // withdraw=銀行→現金 / deposit=現金→銀行
    const toCash = t.transfer_direction === 'withdraw' ? amt : -amt
    await addBank(t.bank_account_id, -toCash)
    await addCash(toCash)
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, amount, date, category_id, memo } = body
  const { data: txn } = await supabase.from('transactions').select('*').eq('id', id).single()
  if (!txn) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (amount !== undefined) updates.amount = amount
  if (date !== undefined) updates.date = date
  if (category_id !== undefined) updates.category_id = category_id || null
  // 備考は空文字なら削除扱い（null）にする
  if (memo !== undefined) updates.memo = typeof memo === 'string' && memo.trim() ? memo.trim() : null

  // 支払い方法（入金先）の変更。振替は対象外。種別に合わない紐付けは捨てる
  const paymentGiven = ['credit_card_id', 'bank_account_id', 'point_balance_id'].some((k) => k in body)
  if (paymentGiven && txn.type !== 'transfer') {
    if (txn.type === 'expense') {
      const pointId = body.point_balance_id || null
      updates.point_balance_id = pointId
      updates.credit_card_id = pointId ? null : body.credit_card_id || null
      updates.bank_account_id = null
    } else {
      updates.bank_account_id = body.bank_account_id || null
      updates.credit_card_id = null
      updates.point_balance_id = null
    }
  }

  const before: BalanceTarget = txn
  const after: BalanceTarget = { ...txn, ...updates }
  const balanceChanged =
    after.amount !== before.amount ||
    after.credit_card_id !== before.credit_card_id ||
    after.bank_account_id !== before.bank_account_id ||
    after.point_balance_id !== before.point_balance_id

  // 先に取引を更新し、成功した場合のみ残高を付け替える（失敗時に残高だけずれるのを防ぐ）
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select('*, categories(*), credit_cards(name, color), bank_accounts(name), point_balances(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (balanceChanged) {
    await applyBalance(before, -1)
    await applyBalance(after, 1)
  }
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
