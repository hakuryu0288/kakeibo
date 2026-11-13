-- 全テーブルでRLS（行レベルセキュリティ）を有効にする
-- 先に Vercel の環境変数 SUPABASE_SERVICE_ROLE_KEY を設定して再デプロイし、
-- アプリが動くことを確認してから、Supabaseダッシュボードの SQL Editor で実行してください。
-- （ポリシーは作らない＝anonキーでは何も読み書きできない。service_roleキーはRLSの対象外）

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 確認：rowsecurity が全部 true になっていればOK
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
