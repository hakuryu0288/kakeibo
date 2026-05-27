'use client'

import Link from 'next/link'
import { useState } from 'react'

const AUTH_KEY = 'kakeibo_auth'

const menuItems = [
  { href: '/transactions', icon: '💸', label: '収支一覧', desc: '収入・支出の入力と確認' },
  { href: '/reports', icon: '📊', label: 'レポート', desc: '月次グラフと推移' },
  { href: '/investments', icon: '📈', label: '投資・相場', desc: 'ポートフォリオと相場モニター' },
  { href: '/calendar', icon: '📅', label: 'カレンダー', desc: '日別収支とメモ' },
  { href: '/categories', icon: '⚙️', label: 'カテゴリ設定', desc: 'カテゴリと予算上限の管理' },
  { href: '/settings', icon: '🗂️', label: 'マスタ設定', desc: 'クレカ・口座の追加・編集・削除' },
]

export default function MenuPage() {
  const [isDemoMode] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(AUTH_KEY) === 'demo'
  )

  const enterDemo = () => {
    localStorage.setItem(AUTH_KEY, 'demo')
    window.location.reload()
  }

  const exitDemo = () => {
    localStorage.removeItem(AUTH_KEY)
    window.location.reload()
  }

  const logout = () => {
    localStorage.removeItem(AUTH_KEY)
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">メニュー</h1>
      <div className="space-y-2">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm hover:bg-slate-50 transition-colors">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
            <span className="ml-auto text-slate-300">›</span>
          </Link>
        ))}

        {isDemoMode ? (
          <button onClick={exitDemo}
            className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4 w-full text-left hover:bg-amber-100 transition-colors">
            <span className="text-2xl">🎭</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">デモモード終了</p>
              <p className="text-xs text-amber-500">実データの表示に戻る</p>
            </div>
            <span className="ml-auto text-amber-300">›</span>
          </button>
        ) : (
          <button onClick={enterDemo}
            className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm w-full text-left hover:bg-slate-50 transition-colors">
            <span className="text-2xl">🎭</span>
            <div>
              <p className="text-sm font-semibold">デモモードで見る</p>
              <p className="text-xs text-slate-400">ダミーデータで表示（SNS投稿用）</p>
            </div>
            <span className="ml-auto text-slate-300">›</span>
          </button>
        )}

        <button onClick={logout}
          className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm w-full text-left hover:bg-red-50 transition-colors">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="text-sm font-semibold text-red-500">ログアウト</p>
            <p className="text-xs text-slate-400">パスワード画面に戻る</p>
          </div>
          <span className="ml-auto text-slate-300">›</span>
        </button>
      </div>
    </div>
  )
}
