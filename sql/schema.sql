-- ========================================================
-- DVLab EA Battle & Performance System Database Schema
-- Supabase PostgreSQL Schema Definition
-- ========================================================

-- 1. EA Master Table (EA基本情報 ＆ 6軸スタッツマスター)
CREATE TABLE IF NOT EXISTS public.eas (
    id SERIAL PRIMARY KEY,
    ea_key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    platform text[] DEFAULT '{MT4}',
    currency_pair VARCHAR(50) DEFAULT 'EURUSD',
    timeframe VARCHAR(50) DEFAULT 'H1',
    broker VARCHAR(100) DEFAULT '',
    
    product_url TEXT DEFAULT '',
    forward_url TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    
    tags text[] DEFAULT '{}',
    
    total_score INT DEFAULT 0,
    rank_badge VARCHAR(10) DEFAULT 'D',
    target_month VARCHAR(10) DEFAULT '2026.08',
    
    score_monthly_return INT DEFAULT 0,
    raw_monthly_return VARCHAR(50) DEFAULT '0%',
    score_pf INT DEFAULT 0,
    raw_pf VARCHAR(50) DEFAULT '0.0',
    score_rf INT DEFAULT 0,
    raw_rf VARCHAR(50) DEFAULT '0.0',
    score_dd INT DEFAULT 0,
    raw_dd VARCHAR(50) DEFAULT '0%',
    score_period INT DEFAULT 0,
    raw_period VARCHAR(50) DEFAULT '0ヶ月',
    score_stability INT DEFAULT 0,
    raw_stability VARCHAR(50) DEFAULT '0ヶ月',
    recommended_margin VARCHAR(100) DEFAULT '',
    
    price_text VARCHAR(100) DEFAULT '無料 (オープンソース)',
    price_value NUMERIC(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    description TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Monthly Finalized Performance Summaries (月次確定データ & 6軸スコア)
CREATE TABLE IF NOT EXISTS public.ea_monthly_summaries (
    id BIGSERIAL PRIMARY KEY,
    ea_id INT NOT NULL REFERENCES public.eas(id) ON DELETE CASCADE,
    period_month VARCHAR(7) NOT NULL, -- e.g. '2026-08'
    monthly_return_percent NUMERIC(8, 2) DEFAULT 0,
    max_drawdown_percent NUMERIC(8, 2) DEFAULT 0,
    recovery_factor NUMERIC(8, 2) DEFAULT 0,
    profit_factor NUMERIC(8, 2) DEFAULT 0,
    testing_months INT DEFAULT 1,
    recommended_deposit NUMERIC(12, 2) DEFAULT 100000,
    win_rate_percent NUMERIC(8, 2) DEFAULT 0,
    total_trades INT DEFAULT 0,
    score_total INT DEFAULT 0,
    rarity_rank VARCHAR(10) DEFAULT 'B',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_ea_period UNIQUE (ea_id, period_month)
);

-- 3. Daily Safety & Equity Snapshot Logs (日次安全監視データ)
CREATE TABLE IF NOT EXISTS public.ea_daily_snapshots (
    id BIGSERIAL PRIMARY KEY,
    ea_id INT NOT NULL REFERENCES public.eas(id) ON DELETE CASCADE,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    balance NUMERIC(12, 2) DEFAULT 0,
    equity NUMERIC(12, 2) DEFAULT 0,
    current_drawdown_percent NUMERIC(8, 2) DEFAULT 0
);

-- Create Indexes for Fast Leaderboard Queries
CREATE INDEX IF NOT EXISTS idx_monthly_period ON public.ea_monthly_summaries(period_month);
CREATE INDEX IF NOT EXISTS idx_monthly_rank ON public.ea_monthly_summaries(rarity_rank);
CREATE INDEX IF NOT EXISTS idx_daily_ea_time ON public.ea_daily_snapshots(ea_id, collected_at);

-- Initial EA Master Seed Data
INSERT INTO public.eas (ea_key, name, myfxbook_url, currency_pair, timeframe, logic_type, broker, price_text, price_value, affiliate_url)
VALUES 
  ('sloperider-grid-nzdcad', 'SlopeRider Grid', 'https://www.myfxbook.com/portfolio/sloperider-grid-nzdcad/12159507', 'NZDCAD', 'M15', 'トレンド順張り / グリッド', 'Axiory ナノ口座 (Demo)', '無料 (オープンソース)', 0, 'setfiles.html'),
  ('bouncerider-grid-eurusd', 'BounceRider Grid (EURUSD)', 'https://www.myfxbook.com/portfolio/bouncerider-grid-eurusd/12159430', 'EURUSD', 'H1', 'BB逆張り / グリッド', 'Axiory ナノ口座 (Demo)', '無料 (オープンソース)', 0, 'setfiles.html'),
  ('bouncerider-grid-audnzd', 'BounceRider Grid (AUDNZD)', 'https://www.myfxbook.com/portfolio/bouncerider-grid-audnzd/12159480', 'AUDNZD', 'H1', 'レンジオセアニア / グリッド', 'Axiory ナノ口座 (Demo)', '無料 (オープンソース)', 0, 'setfiles.html')
ON CONFLICT (ea_key) DO NOTHING;
