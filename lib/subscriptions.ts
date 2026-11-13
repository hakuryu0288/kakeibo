// サブスクの自動登録（請求日が来たら、カード払いの支出として収支に登録する）
// サーバーは日本時間ではないので、日付はすべて日本時間で計算する。
import { supabase } from '@/lib/supabase'

function tokyoToday(): { year: number; month: number; day: number } {
  // en-CA は YYYY-MM-DD 形式で返る
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).split('-').map(Number)
  return { year: y, month: m, day: d }
}

const pad = (n: number) => String(n).padStart(2, '0')

// その月の請求日（月末を超える日は月末に寄せる。例：2月31日→2月28日）
function billingDate(year: number, month: number, billingDay: number): string {
  const last = new Date(year, month, 0).getDate()
  return `${year}-${pad(month)}-${pad(Math.min(billingDay, last))}`
}

type Sub = { id: string; name: string; amount: number; credit_card_id: string; category_id: string | null; billing_day: number; created_at: string }

export async function applyDueSubscriptions(): Promise<{ created: unknown[]; skipped?: string }> {
  const today = tokyoToday()
  const thisMonth = { year: today.year, month: today.month }
  const prev = today.month === 1 ? { year: today.year - 1, month: 12 } : { year: today.year, month: today.month - 1 }

  // カード紐付きの有効なサブスク
  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('is_active', true)
    .not('credit_card_id', 'is', null)
  if (subErr || !subs || subs.length === 0) return { created: [] }

  // 先月分も確認する（アプリをしばらく開かなかった月の取りこぼしを防ぐ）
  const rangeStart = `${prev.year}-${pad(prev.month)}-01`
  const next = today.month === 12 ? { year: today.year + 1, month: 1 } : { year: today.year, month: today.month + 1 }
  const rangeEnd = `${next.year}-${pad(next.month)}-01`
  const { data: existing, error: txnErr } = await supabase
    .from('transactions')
    .select('subscription_id, date')
    .gte('date', rangeStart)
    .lt('date', rangeEnd)
    .in('subscription_id', (subs as Sub[]).map((s) => s.id))
  // subscription_id カラムがない場合（SQL未実行）は何もしない
  if (txnErr) return { created: [], skipped: 'column not found' }

  const done = new Set((existing ?? []).map((t: { subscription_id: string; date: string }) => `${t.subscription_id}@${t.date.slice(0, 7)}`))
  const todayStr = `${today.year}-${pad(today.month)}-${pad(today.day)}`

  const due: { sub: Sub; date: string }[] = []
  for (const sub of subs as Sub[]) {
    // 先月分：サブスクを登録した日より後の請求日だけ（新しく登録したサブスクを過去にさかのぼって計上しない）
    const prevDate = billingDate(prev.year, prev.month, sub.billing_day)
    if (!done.has(`${sub.id}@${prevDate.slice(0, 7)}`) && sub.created_at.slice(0, 10) <= prevDate) {
      due.push({ sub, date: prevDate })
    }
    // 今月分：請求日が今日以前なら
    const curDate = billingDate(thisMonth.year, thisMonth.month, sub.billing_day)
    if (!done.has(`${sub.id}@${curDate.slice(0, 7)}`) && curDate <= todayStr) {
      due.push({ sub, date: curDate })
    }
  }

  const created: unknown[] = []
  for (const { sub, date } of due) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        date,
        amount: sub.amount,
        type: 'expense',
        credit_card_id: sub.credit_card_id,
        subscription_id: sub.id,
        category_id: sub.category_id ?? null,
        memo: sub.name,
      })
      .select()
      .single()
    // 同時に2か所から実行されて重複した場合（一意制約があるとき）はエラーになるので、そのまま飛ばす
    if (!error && data) created.push(data)
  }
  return { created }
}
