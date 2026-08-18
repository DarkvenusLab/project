import streamlit as st

def apply_custom_css():
    """DarkVenus Lab向けのダークテーマCSS (モックアップ仕様) を適用する"""
    st.markdown("""
        <style>
        /* 全体の背景とフォント設定 */
        .stApp {
            background-color: #0f172a !important; /* 深いネイビーグレー */
            color: #f8fafc;
            font-family: 'Inter', 'Roboto', 'Helvetica Neue', sans-serif;
        }
        
        /* 邪魔なデフォルトパディング・マージンを詰める */
        .block-container {
            padding-top: 1.5rem !important;
            padding-bottom: 2rem !important;
            max-width: 96% !important;
        }

        /* コンパクトグリッドレイアウト */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 20px;
            margin-bottom: 15px;
        }
        @media (max-width: 1400px) {
            .metrics-grid {
                grid-template-columns: repeat(4, 1fr);
            }
        }
        @media (max-width: 900px) {
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        /* カスタムカードのコンパクトデザイン */
        .metric-card-compact {
            background-color: #151b2b;
            padding: 20px 10px !important;
            border-radius: 8px !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.04);
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-sizing: border-box !important;
            height: auto !important;
            min-height: 0 !important;
        }
        
        /* タイトル (項目名) */
        .metric-card-compact .m-title {
            margin: 0 0 10px 0 !important;
            padding: 0 !important;
            font-size: 1rem !important;
            font-weight: 400 !important;
            color: #f8fafc !important;
            line-height: 1.1 !important;
            letter-spacing: 0.2px !important;
        }
        
        /* 数値 */
        .metric-card-compact .m-value {
            margin: 0 !important;
            padding: 0 !important;
            font-size: 2rem !important;
            font-weight: 600 !important;
            color: #f8fafc !important;
            line-height: 1.1 !important;
        }

        /* 特別なカード (深い緑アクセント: 例 純損益) */
        .metric-accent {
            background: linear-gradient(135deg, #064e3b 0%, #047857 100%) !important;
            border: 1px solid rgba(16, 185, 129, 0.3) !important;
            box-shadow: 0 3px 10px rgba(4, 120, 87, 0.25) !important;
        }
        .metric-accent .m-title {
            color: rgba(255, 255, 255, 0.85) !important;
        }
        .metric-accent .m-value {
            color: #ffffff !important;
        }
        
        /* 状態ごとの文字色 */
        .text-red { color: #f43f5e !important; }
        .text-blue { color: #38bdf8 !important; }
        .text-green { color: #10b981 !important; }
        .text-white { color: #f8fafc !important; }
        
        /* 透明ダミーカード (グリッド位置揃え用) */
        .metric-hidden {
            visibility: hidden !important;
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
        }
        
        /* Streamlit dividerマージン削減 */
        hr {
            margin: 1rem 0 !important;
        }
        
        /* StreamlitのデフォルトDataFrameのデザイン */
        [data-testid="stDataFrame"] {
            border-radius: 8px;
        }
        
        /* Streamlitタブのデザイン */
        .stTabs [data-baseweb="tab-list"] {
            gap: 12px;
            margin-bottom: 10px;
        }
        .stTabs [data-baseweb="tab"] {
            height: 50px;
            padding: 0 18px;
            background-color: #1e293b;
            border-radius: 8px 8px 0 0;
            color: #cbd5e1;
            font-size: 1.15rem !important;
            font-weight: 600 !important;
            border: 1px solid #334155;
            border-bottom: none;
            transition: all 0.2s ease;
        }
        .stTabs [data-baseweb="tab"]:hover {
            color: #ffffff !important;
            background-color: #334155 !important;
        }
        .stTabs [aria-selected="true"] {
            color: #10b981 !important;
            background-color: #0f172a !important;
            border: 1px solid #10b981 !important;
            border-bottom: 3px solid #10b981 !important;
            font-weight: 700 !important;
        }

        /* ダウンロードボタン・標準ボタンの視認性改善カスタムCSS */
        div[data-testid="stDownloadButton"] > button, .stButton > button {
            background-color: #1e293b !important;
            color: #38bdf8 !important;
            border: 1px solid #0284c7 !important;
            font-weight: 600 !important;
            border-radius: 6px !important;
            padding: 0.6rem 1.2rem !important;
            transition: all 0.2s ease-in-out !important;
        }
        div[data-testid="stDownloadButton"] > button:hover, .stButton > button:hover {
            background-color: #0284c7 !important;
            color: #ffffff !important;
            border-color: #38bdf8 !important;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.4) !important;
        }
        div[data-testid="stDownloadButton"] > button p, .stButton > button p,
        div[data-testid="stDownloadButton"] > button span, .stButton > button span {
            color: inherit !important;
            font-weight: 600 !important;
        }
        </style>
    """, unsafe_allow_html=True)

def render_metrics_grid(metrics):
    """カスタムメトリクスカード群を6列コンパクトグリッドで描画する"""
    cards_html = ""
    for m in metrics:
        c_class = m.get("card_class", "")
        t_class = m.get("text_class", "")
        cards_html += f'<div class="metric-card-compact {c_class}"><div class="m-title">{m["title"]}</div><div class="m-value {t_class}">{m["value"]}</div></div>'
    st.markdown(f'<div class="metrics-grid">{cards_html}</div>', unsafe_allow_html=True)

def render_metric_card(title, value, card_class="", text_class=""):
    """単体カスタムメトリクスカードを描画する"""
    st.markdown(f'<div class="metric-card-compact {card_class}"><div class="m-title">{title}</div><div class="m-value {text_class}">{value}</div></div>', unsafe_allow_html=True)
