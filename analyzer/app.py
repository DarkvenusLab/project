import streamlit as st
from modules.parser import load_and_parse
from modules.metrics import analyze_trades
from views.components import apply_custom_css
from views import tab_summary, tab_nanpin, tab_hourly, tab_loss

st.set_page_config(page_title="DVLab Backtest Analyzer", layout="wide", page_icon="📊")
apply_custom_css()

st.title("DVLab Backtest Analyzer For Mt4 📊")
st.markdown("ナンピンEA向け バックテスト分析ツール")

# --- ファイルアップロード ---
st.sidebar.header("📁 ファイル読み込み")
uploaded_file = st.sidebar.file_uploader("MT4バックテストレポート (.htm / .html) をドロップ", type=['htm', 'html'])

if not uploaded_file:
    st.info("👈 左側のサイドバーからバックテストのHTMLファイルをアップロードしてください。")
    
    st.markdown("""
    ---
    ### 🔒 プライバシー・セキュリティについて
    * **データは保存されません**: アップロードされたバックテストレポート（.htm / .html）は、お使いのブラウザセッション内でのみ一時的に安全に処理されます。**サーバー上にファイルが保存・蓄積されたり、第三者に送信されることは一切ありません**のでご安心ください。
    * **完全無料・登録不要**: 面倒な会員登録や個人情報の入力なしで、すぐに高度なナンピン分析機能をご利用いただけます。
    """)
    st.stop()

# --- パース処理 ---
with st.spinner("データを解析しています..."):
    raw_df, ea_name, report_dd, report_dd_pct, initial_deposit, symbol, period = load_and_parse(uploaded_file)
    
if raw_df.empty:
    st.error("有効な取引データが見つかりませんでした。MT4のバックテストレポートか確認してください。")
    st.stop()
    
st.sidebar.success(f"解析成功: {ea_name}")
st.sidebar.markdown(f"**対象EA:** {ea_name}")
if symbol or period:
    st.sidebar.markdown(f"**通貨ペア/足:** {symbol} {period}".strip())

# --- 分析データ生成 ---
res_df_full = analyze_trades(raw_df)

# --- 売買フィルター (モード切替) ---
st.sidebar.divider()
st.sidebar.header("🔍 表示モード切替")
display_mode = st.sidebar.radio("集計対象を選択", ["🌐 両建て (Buy+Sell)", "🔵 買い (Buy) のみ", "🔴 売り (Sell) のみ"])

if display_mode == "🔵 買い (Buy) のみ":
    res_df = res_df_full[res_df_full['Type'] == 'buy'].copy()
    filtered_raw_df = raw_df[raw_df['Type'] == 'buy'].copy()
elif display_mode == "🔴 売り (Sell) のみ":
    res_df = res_df_full[res_df_full['Type'] == 'sell'].copy()
    filtered_raw_df = raw_df[raw_df['Type'] == 'sell'].copy()
else:
    res_df = res_df_full.copy()
    filtered_raw_df = raw_df.copy()

# フィルタ後のデータが空の場合
if res_df.empty:
    st.warning("選択したモード（売買方向）の取引データが存在しません。")
    st.stop()

# --- タブ表示 ---
info_str = f"**{ea_name}**"
if symbol or period:
    info_str += f" ({symbol} {period})".strip()
st.markdown(f"### 対象EA: {info_str} [{display_mode}]")

tab1, tab2, tab3, tab4 = st.tabs([
    "📊 総合パフォーマンス", 
    "🎯 ナンピン層・リスク分析", 
    "⏰ 時間帯・曜日分析", 
    "⚠️ 損切り分析＆ログ"
])

with tab1:
    tab_summary.render(res_df, filtered_raw_df, report_dd, report_dd_pct, initial_deposit)
    
with tab2:
    tab_nanpin.render(res_df, filtered_raw_df)
    
with tab3:
    tab_hourly.render(res_df)
    
with tab4:
    tab_loss.render(res_df, ea_name=ea_name, symbol=symbol, period=period)
