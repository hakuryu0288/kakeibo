import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE, isCorrectPin, isValidSession, sessionToken } from '@/lib/auth'

// PINの総当たり対策：同じ接続元から10分間に5回間違えたら、しばらく受け付けない。
// （サーバーのインスタンスごとの簡易的な制限。あわせて失敗時は少し待たせる）
const WINDOW_MS = 10 * 60 * 1000
const MAX_FAILURES = 5
const failures = new Map<string, { count: number; first: number }>()

function clientKey(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

function isLocked(key: string): boolean {
  const f = failures.get(key)
  if (!f) return false
  if (Date.now() - f.first > WINDOW_MS) {
    failures.delete(key)
    return false
  }
  return f.count >= MAX_FAILURES
}

function recordFailure(key: string) {
  const f = failures.get(key)
  if (!f || Date.now() - f.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() })
  else f.count++
}

// ログインしているか
export async function GET(req: NextRequest) {
  return NextResponse.json({ authed: isValidSession(req.cookies.get(SESSION_COOKIE)?.value) })
}

// ログイン
export async function POST(req: NextRequest) {
  const key = clientKey(req)
  if (isLocked(key)) {
    return NextResponse.json({ error: '間違いが続いたため、10分ほど待ってからもう一度試してください' }, { status: 429 })
  }

  const { pin } = await req.json().catch(() => ({ pin: '' }))
  if (typeof pin !== 'string' || !isCorrectPin(pin)) {
    recordFailure(key)
    await new Promise((r) => setTimeout(r, 800))
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  failures.delete(key)
  const res = NextResponse.json({ authed: true })
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}

// ログアウト
export async function DELETE() {
  const res = NextResponse.json({ authed: false })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
