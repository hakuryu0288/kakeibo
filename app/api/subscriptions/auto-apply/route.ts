import { NextResponse } from 'next/server'
import { applyDueSubscriptions } from '@/lib/subscriptions'

// アプリを開いたときに呼ばれる
export async function POST() {
  return NextResponse.json(await applyDueSubscriptions())
}

// Vercelの定時実行（vercel.json の crons）から毎朝呼ばれる。
// 呼び出し元の確認は proxy.ts で行う（CRON_SECRET）
export async function GET() {
  return NextResponse.json(await applyDueSubscriptions())
}
