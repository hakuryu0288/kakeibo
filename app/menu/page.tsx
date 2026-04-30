import Link from 'next/link'

const menuItems = [
  { href: '/transactions', icon: '💸', label: '収支一覧', desc: '収入・支出の入力と確認' },
  { href: '/reports', icon: '📊', label: 'レポート', desc: '月次グラフと推移' },
  { href: '/investments', icon: '📈', label: '投資・相場', desc: 'ポートフォリオと相場モニター' },
  { href: '/calendar', icon: '📅', label: 'カレンダー', desc: '日別収支とメモ' },
  { href: '/categories', icon: '⚙️', label: 'カテゴリ設定', desc: 'カテゴリと予算上限の管理' },
]

export default function MenuPage() {
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
      </div>
    </div>
  )
}
