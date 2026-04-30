'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'ホーム', icon: '🏠' },
  { href: '/transactions', label: '収支', icon: '💸' },
  { href: '/reports', label: 'レポート', icon: '📊' },
  { href: '/investments', label: '投資', icon: '📈' },
  { href: '/categories', label: '設定', icon: '⚙️' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-lg mx-auto flex">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors ${
                active ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={active ? 'font-semibold' : ''}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
