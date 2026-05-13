# 📒 Kakeibo — 個人用家計簿アプリ

Next.js + Supabase で作ったセルフホスト型の家計簿Webアプリです。  
自分のデータを自分のSupabaseに置いて、完全に自己管理できます。

![デモ画面](https://placehold.co/800x400?text=Demo+Screenshot)

## 機能

- **ホーム** — 総資産・次月末残高予測・直近の取引
- **収支一覧** — 取引の入力・編集・削除（カード/銀行/現金/ポイント払い対応）
- **口座・カード・現金** — クレカ使用履歴・現金収支・銀行残高の月末見込み
- **カレンダー** — 日別収支とメモ
- **レポート** — 月次グラフと推移
- **資産** — NISA・投資ポートフォリオ・転売商材
- **計画** — 確定出費・ウィッシュリスト・大型支出
- **サブスク管理** — 定額課金の自動取引登録
- **デモモード** — ダミーデータで全画面を表示（SNS投稿などに）

## 技術スタック

| カテゴリ | 使用技術 |
|---|---|
| フロントエンド | Next.js (App Router), TypeScript, Tailwind CSS |
| バックエンド | Next.js API Routes |
| データベース | Supabase (PostgreSQL) |
| デプロイ | Vercel など |

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/your-username/kakeibo.git
cd kakeibo
npm install
```

### 2. Supabase プロジェクトを作成

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. SQL エディタで `supabase_schema_v2.sql` を実行してテーブルを作成
3. プロジェクト設定 > API から URL と anon key を取得

### 3. 環境変数を設定

```bash
cp .env.example .env.local
```

`.env.local` を編集して Supabase の情報と任意の PIN を設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_PASSWORD=あなたの4桁PIN
```

### 4. 開発サーバーを起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いて設定した PIN でログイン。

## Vercel へのデプロイ

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Vercel にデプロイする場合は、プロジェクトの環境変数に上記 3 つを設定してください。

## デモモード

実データを見せずにアプリを紹介したい場合は **デモモード** が使えます。

- ログイン画面またはメニュー画面から「🎭 デモモードで見る」を選択
- ダミーデータが表示され、Supabase へのアクセスは一切発生しません
- メニューから「デモモード終了」で元に戻ります

## ライセンス

MIT
