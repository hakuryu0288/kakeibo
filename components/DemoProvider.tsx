'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getDemoResponse } from '@/lib/demo-data'

const AUTH_KEY = 'kakeibo_auth'

const DemoContext = createContext(false)
export const useDemoMode = () => useContext(DemoContext)

export default function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false)

  useEffect(() => {
    const demo = localStorage.getItem(AUTH_KEY) === 'demo'
    setIsDemoMode(demo)
    if (!demo) return

    const orig = window.fetch
    window.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

      if (url.startsWith('/api/')) {
        if (method === 'GET') {
          const data = getDemoResponse(url)
          if (data !== null) {
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        } else {
          // デモモードでは書き込み操作をすべて無視して成功を返す
          return new Response(JSON.stringify({ id: `demo-new-${Date.now()}`, success: true }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
      return orig(input, init)
    }

    return () => {
      window.fetch = orig
    }
  }, [])

  function exitDemo() {
    localStorage.removeItem(AUTH_KEY)
    window.location.reload()
  }

  return (
    <DemoContext.Provider value={isDemoMode}>
      {isDemoMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-400 text-amber-900 text-xs font-bold text-center py-1.5 flex items-center justify-center gap-3">
          <span>🎭 デモモード表示中</span>
          <button
            onClick={exitDemo}
            className="bg-amber-700 text-white rounded-full px-3 py-0.5 text-xs font-semibold hover:bg-amber-800 transition-colors"
          >
            終了
          </button>
        </div>
      )}
      {isDemoMode ? <div className="pt-7">{children}</div> : children}
    </DemoContext.Provider>
  )
}
