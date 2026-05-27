'use client'

import { useEffect, useState } from 'react'

const AUTH_KEY = 'kakeibo_auth'
const PASSWORD = process.env.NEXT_PUBLIC_APP_PASSWORD ?? '0000'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    const v = localStorage.getItem(AUTH_KEY)
    return v === '1' || v === 'demo'
  })
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input === PASSWORD) {
      localStorage.setItem(AUTH_KEY, '1')
      setAuthed(true)
    } else {
      setError(true)
      setInput('')
    }
  }

  if (authed === null) return null

  if (!authed) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 w-72 shadow-2xl text-center space-y-5">
          <div className="text-4xl">🔒</div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">家計簿</h1>
            <p className="text-sm text-slate-500 mt-1">4桁のパスワードを入力してください</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false) }}
              placeholder="----"
              className={`w-full border rounded-xl p-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:ring-red-300' : 'border-slate-200 focus:ring-indigo-300'}`}
              autoFocus
            />
            {error && <p className="text-xs text-red-500">パスワードが違います</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
            >
              ログイン
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
