import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, isValidSession } from '@/lib/auth'

// すべてのAPIで、ログイン用のCookieを確認する。
// ログインしていなければデータを返さない（URLを直接開かれても見られないようにする）
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/auth')) return NextResponse.next()

  if (!isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
