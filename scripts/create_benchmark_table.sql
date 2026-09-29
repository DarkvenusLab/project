-- ==========================================================
-- Dark Venus ラボ公式ベンチマーク 専用テーブル作成SQL
-- Supabase Dashboardの「SQL Editor」で実行してください
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.lab_benchmark_snapshots (
  id TEXT PRIMARY KEY DEFAULT 'dark-venus-benchmark',
  ea_name TEXT NOT NULL,
  display_title TEXT,
  category_badge TEXT,
  category_tag TEXT,
  currency_pair TEXT,
  timeframe TEXT,
  broker TEXT,
  leverage TEXT,
  platform TEXT,
  price_text TEXT,
  forward_url TEXT,
  target_month TEXT,
  total_score INTEGER DEFAULT 0,
  rank_badge TEXT DEFAULT 'A',
  score_monthly_return INTEGER DEFAULT 0,
  score_pf INTEGER DEFAULT 0,
  score_rf INTEGER DEFAULT 0,
  score_dd INTEGER DEFAULT 0,
  score_period INTEGER DEFAULT 0,
  score_stability INTEGER DEFAULT 0,
  raw_monthly_return TEXT,
  raw_pf TEXT,
  raw_rf TEXT,
  raw_dd TEXT,
  raw_period TEXT,
  raw_stability TEXT,
  gain_percent TEXT,
  abs_gain_percent TEXT,
  daily_return_percent TEXT,
  total_profit TEXT,
  balance TEXT,
  equity TEXT,
  total_deposits TEXT,
  total_withdrawals TEXT,
  total_trades INTEGER DEFAULT 0,
  total_pips TEXT,
  win_rate TEXT,
  expectancy TEXT,
  start_date TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  notes TEXT
);

-- RLS (Row Level Security) の設定
ALTER TABLE public.lab_benchmark_snapshots ENABLE ROW LEVEL SECURITY;

-- 全員（匿名ユーザー）に読み取り権限を付与
CREATE POLICY "Allow public read access for lab_benchmark_snapshots"
  ON public.lab_benchmark_snapshots
  FOR SELECT
  USING (true);

-- 匿名ユーザー（anon key）による更新・登録を許可（APIスクリプトから書き込み可能にする場合）
CREATE POLICY "Allow public insert/update for lab_benchmark_snapshots"
  ON public.lab_benchmark_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);
