'use client'

import { useEffect, useState } from 'react'

const AUTH_KEY = 'kakeibo_auth'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  // null = 確認中。デモモードはサーバーに問い合わせずに表示する
  const [authed, setAuthed] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(AUTH_KEY) === 'demo' ? true : null
  })
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ログイン状態はサーバー（Cookie）で確認する。PINはブラウザに置かない
  useEffect(() => {
    if (authed !== null) return
    fetch('/api/auth')
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.authed))
      .catch(() => setAuthed(false))
  }, [authed])

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const target = e.target as HTMLInputElement
      if (target.tagName === 'INPUT' && target.type === 'number') {
        target.blur()
      }
    }
    window.addEventListener('wheel', handler)
    return () => window.removeEventListener('wheel', handler)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: input }),
      })
      if (res.ok) {
        // 以前のログイン記録（ブラウザ内）は使わなくなったので消しておく
        if (localStorage.getItem(AUTH_KEY) === '1') localStorage.removeItem(AUTH_KEY)
        setAuthed(true)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'パスワードが違います')
        setInput('')
      }
    } catch {
      setError('通信に失敗しました')
    }
    setSubmitting(false)
  }

  if (authed === null) return null

  if (!authed) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 w-72 shadow-2xl text-center space-y-5">
          <div className="text-4xl">🔒</div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">家計簿</h1>
            <p className="text-sm text-slate-500 mt-1">パスワードを入力してください</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError('') }}
              placeholder="----"
              className={`w-full border rounded-xl p-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:ring-red-300' : 'border-slate-200 focus:ring-indigo-300'}`}
              autoFocus
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {submitting ? '確認中...' : 'ログイン'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => { localStorage.setItem(AUTH_KEY, 'demo'); window.location.reload() }}
            className="w-full text-slate-400 text-xs py-1 hover:text-slate-600 transition-colors"
          >
            🎭 デモモードで見る
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
