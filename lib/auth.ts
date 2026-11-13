// サーバー側だけで使うログイン（PIN）の仕組み。
// PINはブラウザに送らず、サーバーで照合する。正しければログイン用のCookieを渡し、
// API（/api/*）は proxy.ts でそのCookieを確認する。
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'kakeibo_session'
// どの端末からでも使えるよう、一度ログインしたら長く保つ（1年）
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365

// PINはサーバー専用の APP_PASSWORD を優先する。
// 以前の NEXT_PUBLIC_APP_PASSWORD もサーバー側で読むだけならブラウザには出ないので、移行中の予備として読む。
function appPin(): string {
  return process.env.APP_PASSWORD || process.env.NEXT_PUBLIC_APP_PASSWORD || '0000'
}

// Cookieの値は「PINから作った署名」。PINを変えると、すべての端末のログインが切れる
export function sessionToken(): string {
  const secret = process.env.SESSION_SECRET || appPin()
  return createHmac('sha256', secret).update(`kakeibo-session-v1:${appPin()}`).digest('base64url')
}

function sameText(a: string, b: string): boolean {
  // 長さの違いや比較時間からPINが推測されないよう、ハッシュ同士を一定時間で比べる
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function isValidSession(value: string | undefined): boolean {
  return !!value && sameText(value, sessionToken())
}

export function isCorrectPin(input: string): boolean {
  return sameText(input, appPin())
}
