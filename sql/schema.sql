-- ========================================================
-- DVLab EA Battle & Performance System Database Schema
-- Supabase PostgreSQL Schema Definition (v5.2.0 最新決定版)
-- ========================================================

-- 1. EA Master Table (7セクション完全連動マスターテーブル)
CREATE TABLE IF NOT EXISTS public.ea_master (
    id SERIAL PRIMARY KEY,
    
    -- 【1. 基本スペック】
    ea_key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    platform text[] DEFAULT '{MT4}',
    currency_pair VARCHAR(50) DEFAULT 'EURUSD',
    timeframe VARCHAR(50) DEFAULT 'H1',
    broker VARCHAR(100) DEFAULT '',
    tags text[] DEFAULT '{}',
    
    -- 【2. URL ＆ 画像メディア】
    product_url TEXT NOT NULL,                     -- 商品ページURL (*)
    image_url TEXT NOT NULL,                       -- EAサムネイル画像URL (*)
    
    -- 【3. MQL5個別スクレイピング連携】
    forward_url TEXT NOT NULL,                     -- MQL5シグナルURL (*)
    
    -- 【4. 詳細ページ用フォワード実績 ＆ 月次推移プレビュー】
    -- 6軸生数値
    raw_monthly_return VARCHAR(50) DEFAULT '0%',
    raw_pf VARCHAR(50) DEFAULT '0.0',
    raw_rf VARCHAR(50) DEFAULT '0.0',
    raw_dd VARCHAR(50) DEFAULT '0%',
    raw_period VARCHAR(50) DEFAULT '0ヶ月',
    raw_stability VARCHAR(50) DEFAULT '0ヶ月',
    -- 13詳細実績
    total_profit VARCHAR(50) DEFAULT '0.00 EUR',
    balance VARCHAR(50) DEFAULT '0.00 EUR',
    total_deposits VARCHAR(50) DEFAULT '0.00 EUR',
    total_withdrawals VARCHAR(50) DEFAULT '0.00 EUR',
    raw_win_rate VARCHAR(20) DEFAULT '0%',
    win_trades INT DEFAULT 0,
    loss_trades INT DEFAULT 0,
    raw_trade_count INT DEFAULT 0,
    best_trade VARCHAR(50) DEFAULT '0.00',
    worst_trade VARCHAR(50) DEFAULT '0.00',
    expected_payoff VARCHAR(50) DEFAULT '0.00',
    max_deposit_load VARCHAR(20) DEFAULT '0%',
    trading_activity VARCHAR(20) DEFAULT '0%',
    trades_per_week INT DEFAULT 0,
    avg_holding_time VARCHAR(50) DEFAULT '',
    sharpe_ratio VARCHAR(20) DEFAULT '0.0',
    
    -- 【5. EAランク ＆ カード印字スコア】
    target_month VARCHAR(10) DEFAULT '2026.08',    -- 対象年月（カード印字用） (*)
    published_from VARCHAR(10) DEFAULT '2026-08',  -- ランキング参加開始月
    current_rank INT,                              -- 直近確定月の確定順位
    total_score INT DEFAULT 0,                     -- 6軸合計点 (0〜100)
    rank_badge VARCHAR(10) DEFAULT 'D',            -- 総合ランク (SSS〜D)
    score_monthly_return INT DEFAULT 0,
    score_pf INT DEFAULT 0,
    score_rf INT DEFAULT 0,
    score_dd INT DEFAULT 0,
    score_period INT DEFAULT 0,
    score_stability INT DEFAULT 0,
    
    -- 【6. 価格 ＆ 公開設定】
    price_currency VARCHAR(10) DEFAULT 'USD',      -- 通貨 (USD, JPY, EUR) (*)
    price_value NUMERIC(10, 2) DEFAULT 0,          -- 価格数値 (0 = 無料) (*)
    price_text VARCHAR(100) DEFAULT '無料',        -- 表示価格テキスト (自動生成・編集可)
    copy_price_value NUMERIC(10, 2) DEFAULT NULL,   -- コピートレード価格数値 (月額, NULL/0 = 未設定または無料)
    copy_price_text VARCHAR(100) DEFAULT '',       -- コピートレード表示テキスト (例: $30 / 月)
    recommended_margin VARCHAR(100) DEFAULT '',    -- 推奨証拠金
    is_active BOOLEAN DEFAULT TRUE,                -- 公開ステータス
    
    -- 【7. 統合管理メモ ＆ 運用注意事項】
    notes TEXT DEFAULT '',                         -- 統合メモ (箇条書き・改行対応)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Monthly Finalized Performance Summaries (月次確定実績推移)
CREATE TABLE IF NOT EXISTS public.ea_monthly_summaries (
    id BIGSERIAL PRIMARY KEY,
    ea_id INT NOT NULL REFERENCES public.ea_master(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL,                -- e.g. '2026-08'
    monthly_return_percent NUMERIC(8, 2) DEFAULT 0,
    rank_position INT,                             -- その月の確定順位
    max_drawdown_percent NUMERIC(8, 2) DEFAULT 0,
    recovery_factor NUMERIC(8, 2) DEFAULT 0,
    profit_factor NUMERIC(8, 2) DEFAULT 0,
    total_trades INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_ea_year_month UNIQUE (ea_id, year_month)
);

-- インデックス設定
CREATE INDEX IF NOT EXISTS idx_monthly_ym ON public.ea_monthly_summaries(year_month);
CREATE INDEX IF NOT EXISTS idx_ea_master_current_rank ON public.ea_master(current_rank);
CREATE INDEX IF NOT EXISTS idx_ea_master_ea_key ON public.ea_master(ea_key);

-- ========================================================
-- RLS (Row-Level Security) 許可設定
-- ダッシュボードから直接保存できるように匿名アクセスの制限を解除します
-- ========================================================
ALTER TABLE public.ea_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_monthly_summaries DISABLE ROW LEVEL SECURITY;
