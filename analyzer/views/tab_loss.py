import streamlit as st
import pandas as pd
import io
import datetime
import re
from modules.metrics import get_loss_cuts
from views.components import render_metrics_grid

def build_filename(ea_name, symbol, period, category_name):
    today_str = datetime.date.today().strftime("%Y%m%d")
    parts = []
    clean_ea = re.sub(r'[\\/:*?"<>|\s]', '_', ea_name).strip('_')
    if clean_ea:
        parts.append(clean_ea)
    if symbol:
        clean_sym = re.sub(r'[\\/:*?"<>|\s]', '_', symbol).strip('_')
        parts.append(clean_sym)
    if period:
        clean_per = re.sub(r'[\\/:*?"<>|\s]', '_', period).strip('_')
        parts.append(clean_per)
    parts.append(today_str)
    parts.append(category_name)
    return "_".join(parts) + ".csv"

def render(res_df, ea_name="EA", symbol="", period=""):
    if res_df.empty:
        st.warning("データがありません。")
        return

    st.subheader("⚠️ ロスカット（損切り）分析")
    
    loss_df = get_loss_cuts(res_df)
    
    if loss_df.empty:
        st.success("損切り（マイナス決済）の履歴はありませんでした！")
    else:
        buy_loss = len(loss_df[loss_df['売買'].str.lower() == 'buy'])
        sell_loss = len(loss_df[loss_df['売買'].str.lower() == 'sell'])
        max_loss_val = loss_df['損失額'].min() # 負の値なのでmin
        total_loss_val = loss_df['損失額'].sum()
        
        loss_metrics = [
            {"title": "総損切り回数", "value": f"{len(loss_df)} 回", "text_class": "text-red"},
            {"title": "内訳 (買い / 売り)", "value": f"{buy_loss} 回 / {sell_loss} 回"},
            {"title": "損失額の合計", "value": f"¥ {total_loss_val:,.0f}", "text_class": "text-red"},
            {"title": "最大損失額/回", "value": f"¥ {max_loss_val:,.0f}", "text_class": "text-red"},
            {"title": "", "value": "", "card_class": "metric-hidden"},
            {"title": "", "value": "", "card_class": "metric-hidden"}
        ]
        render_metrics_grid(loss_metrics)
        
        st.divider()
        
        st.markdown("### 📝 ロスカット履歴")
        st.markdown("<div style='font-size:0.9em; color:#cbd5e1; margin-bottom:12px;'>過去の全ロスカットの明細です。一覧データはCSVとしてダウンロードし、Excel等で分析・管理することができます。</div>", unsafe_allow_html=True)
        
        # カスタムHTMLテーブルでの描画
        table_html = "<div style='overflow-x:auto;'><table class='custom-table'>"
        table_html += "<thead><tr>"
        table_html += "<th style='text-align:center;'>エントリー日時</th>"
        table_html += "<th style='text-align:center;'>決済日時</th>"
        table_html += "<th style='text-align:center;'>売買</th>"
        table_html += "<th style='text-align:right;'>最大ナンピン数</th>"
        table_html += "<th style='text-align:right;'>損失額</th>"
        table_html += "<th style='text-align:right;'>保有時間</th>"
        table_html += "<th style='text-align:right;'>保有日数</th>"
        table_html += "</tr></thead><tbody>"
        
        for _, row in loss_df.iterrows():
            open_t = row['エントリー日時'].strftime('%Y-%m-%d %H:%M') if pd.notnull(row['エントリー日時']) else "-"
            close_t = row['決済日時'].strftime('%Y-%m-%d %H:%M') if pd.notnull(row['決済日時']) else "-"
            trade_type = "買い" if str(row['売買']).lower() == 'buy' else "売り"
            max_pos = int(row['最大ナンピン数'])
            loss_val = row['損失額']
            hold_h = row['保有時間(H)']
            hold_d = row['保有日数(D)']
            
            table_html += "<tr>\n"
            table_html += f"<td style='text-align:center;'>{open_t}</td>\n"
            table_html += f"<td style='text-align:center;'>{close_t}</td>\n"
            table_html += f"<td style='text-align:center;'>{trade_type}</td>\n"
            table_html += f"<td style='text-align:right;'>{max_pos} ポジ</td>\n"
            table_html += f"<td style='text-align:right;' class='text-red'>¥ {loss_val:,.0f}</td>\n"
            table_html += f"<td style='text-align:right;'>{hold_h:.1f} 時間</td>\n"
            table_html += f"<td style='text-align:right;'>{hold_d:.1f} 日</td>\n"
            table_html += "</tr>\n"
            
        table_html += "</tbody></table></div>"
        st.markdown(table_html, unsafe_allow_html=True)
    
    # CSVダウンロード機能
    st.divider()
    st.markdown("### 📥 データのダウンロード")
    
    if not loss_df.empty:
        # DL用にユーザーメモ列を含むDFを作成し、小数点を丸める
        dl_df = loss_df.copy()
        dl_df['損失額'] = dl_df['損失額'].round(2)
        dl_df['保有時間(H)'] = dl_df['保有時間(H)'].round(2)
        dl_df['保有日数(D)'] = dl_df['保有日数(D)'].round(2)
        dl_df['ユーザーメモ'] = ""
        
        csv_buffer = io.BytesIO()
        dl_df.to_csv(csv_buffer, index=False, encoding='utf-8-sig')
        csv_data = csv_buffer.getvalue()
        
        loss_filename = build_filename(ea_name, symbol, period, "losscut_history")
        
        st.download_button(
            label="📥 損切り履歴（メモ用空列付き）をCSVでダウンロード",
            data=csv_data,
            file_name=loss_filename,
            mime="text/csv"
        )
    
    # 全取引履歴の数値丸め
    res_df_export = res_df.copy()
    for c in ['HoldHours', 'TotalProfit', 'TotalSize', 'MaxSize']:
        if c in res_df_export.columns:
            res_df_export[c] = res_df_export[c].round(2)
    if 'WeightedAvgPrice' in res_df_export.columns:
        res_df_export['WeightedAvgPrice'] = res_df_export['WeightedAvgPrice'].round(5)
    for c in ['AvgPipsDiff', 'VirtualDDPips', 'CumProfit']:
        if c in res_df_export.columns:
            res_df_export[c] = res_df_export[c].round(1)
            
    csv_full = io.BytesIO()
    res_df_export.to_csv(csv_full, index=False, encoding='utf-8-sig')
    csv_full_data = csv_full.getvalue()
    
    all_filename = build_filename(ea_name, symbol, period, "all_trades_summary")
    
    st.download_button(
        label="📥 全取引サマリーをCSVでダウンロード",
        data=csv_full_data,
        file_name=all_filename,
        mime="text/csv"
    )

    # 項目（ヘッダー）の解説テーブル
    st.divider()
    st.markdown("### 📖 CSV項目（ヘッダー）の解説一覧")
    st.markdown("<div style='font-size:0.9em; color:#cbd5e1; margin-bottom:12px;'>ダウンロードしたCSVファイルに含まれる各項目の詳細説明です。</div>", unsafe_allow_html=True)

    desc_html = """
    <div style='overflow-x:auto;'>
    <table class='custom-table' style='width:100%;'>
        <thead>
            <tr>
                <th style='width: 220px; text-align:left; padding-left:16px;'>CSVヘッダー名</th>
                <th style='text-align:left; padding-left:16px;'>項目の解説・意味</th>
            </tr>
        </thead>
        <tbody>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>CloseTime</td><td style='text-align:left; padding-left:16px; white-space:normal;'>セットが一括決済（利益確定/損切り）された日時</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>Type</td><td style='text-align:left; padding-left:16px; white-space:normal;'>売買方向（buy: 買い / sell: 売り）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>PosCount</td><td style='text-align:left; padding-left:16px; white-space:normal;'>対象セットで到達した最大ポジション数（ナンピン数）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>FirstOpenTime</td><td style='text-align:left; padding-left:16px; white-space:normal;'>1本目（初回ポジション）のエントリー日時</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>LastOpenTime</td><td style='text-align:left; padding-left:16px; white-space:normal;'>最後に追加されたナンピンポジションのエントリー日時</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>WeightedAvgPrice</td><td style='text-align:left; padding-left:16px; white-space:normal;'>損益分岐点となるロット加重平均の取得単価（平均エントリー価格）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>HoldHours</td><td style='text-align:left; padding-left:16px; white-space:normal;'>初回エントリーから一括決済までの保有時間（時間）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>TotalProfit</td><td style='text-align:left; padding-left:16px; white-space:normal;'>対象セットにおける確定損益の合計金額（円）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>TotalSize</td><td style='text-align:left; padding-left:16px; white-space:normal;'>保有した全ポジションの合計ロット数</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>MaxSize</td><td style='text-align:left; padding-left:16px; white-space:normal;'>対象セット内で最も大きい単体ポジションのロット数</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>AvgPipsDiff</td><td style='text-align:left; padding-left:16px; white-space:normal;'>ナンピン間隔の平均距離（Pips）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>VirtualDDPips</td><td style='text-align:left; padding-left:16px; white-space:normal;'>平均取得単価から想定逆行価格までの仮想ドローダウン距離（Pips）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>IsCloseAtStop</td><td style='text-align:left; padding-left:16px; white-space:normal;'>バックテスト最終日の強制決済（close at stop）かどうか（True / False）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>Weekday</td><td style='text-align:left; padding-left:16px; white-space:normal;'>初回エントリーの曜日（0:月曜日 〜 6:日曜日）</td></tr>
            <tr><td style='text-align:left; padding-left:16px; font-weight:600; color:#38bdf8;'>CumProfit</td><td style='text-align:left; padding-left:16px; white-space:normal;'>通算の累積損益額（円）</td></tr>
        </tbody>
    </table>
    </div>
    """
    st.markdown(desc_html, unsafe_allow_html=True)
