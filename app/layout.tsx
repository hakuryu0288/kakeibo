import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import AuthGuard from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: 'Kakeibo',
  description: '個人用家計簿アプリ',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <AuthGuard>
          <main className="max-w-lg mx-auto px-4 pt-4 pb-2">{children}</main>
          <BottomNav />
        </AuthGuard>
      </body>
    </html>
  )
}
