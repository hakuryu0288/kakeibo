import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, isValidSession } from '@/lib/auth'

// すべてのAPIで、ログイン用のCookieを確認する。
// ログインしていなければデータを返さない（URLを直接開かれても見られないようにする）
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/auth')) return NextResponse.next()

  // Vercelの定時実行（毎日のサブスク自動登録）。環境変数 CRON_SECRET と一致するときだけ通す
  const cronSecret = process.env.CRON_SECRET
  if (
    cronSecret &&
    request.method === 'GET' &&
    request.nextUrl.pathname === '/api/subscriptions/auto-apply' &&
    request.headers.get('authorization') === `Bearer ${cronSecret}`
  ) {
    return NextResponse.next()
  }

  if (!isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
