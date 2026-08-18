import streamlit as st
import pandas as pd
import textwrap
from modules.metrics import get_pos_stats, get_close_at_stop_stats
from views.components import render_metrics_grid

def render(res_df, raw_df=None):
    if res_df.empty:
        st.warning("表示できるデータがありません。")
        return

    # ---------------------------------------------------------
    # 1. ナンピン層別 詳細集計テーブル
    # ---------------------------------------------------------
    st.subheader("🎯 ナンピン層・リスク構造分析")
    
    pos_stats = get_pos_stats(res_df)
    
    if not pos_stats.empty:
        table_html = "<div style='overflow-x:auto;'><table class='custom-table'>"
        table_html += textwrap.dedent("""\
        <thead>
            <tr>
                <th style='text-align:center;'>ナンピン数</th>
                <th style='text-align:right;'>セット数</th>
                <th style='text-align:right;'>割合 (%)</th>
                <th style='text-align:right;'>累積割合 (%)</th>
                <th style='text-align:right;'>合計損益</th>
                <th style='text-align:right;'>累積損益</th>
                <th style='text-align:right;'>平均損益</th>
                <th style='text-align:right;'>平均合計ロット</th>
                <th style='text-align:right;'>最大単一ロット</th>
                <th style='text-align:right;'>平均保有時間</th>
                <th style='text-align:right;'>平均ナンピン幅</th>
            </tr>
        </thead>
        <tbody>
        """)
        
        for _, row in pos_stats.iterrows():
            pos_label = f"{int(row['PosCount'])} ポジ"
            set_count = f"{int(row['セット数']):,} 回"
            ratio = f"{row['セット数割合']:.1f} %"
            cum_ratio = f"{row['セット数割合累積']:.1f} %"
            
            tot_profit = row['合計損益']
            tot_profit_cls = "text-green" if tot_profit > 0 else ("text-red" if tot_profit < 0 else "")
            tot_profit_str = f"{tot_profit:,.0f} 円"
            
            cum_profit = row['合計損益累積']
            cum_profit_cls = "text-green" if cum_profit > 0 else ("text-red" if cum_profit < 0 else "")
            cum_profit_str = f"{cum_profit:,.0f} 円"
            
            avg_profit = row['平均損益']
            avg_profit_cls = "text-green" if avg_profit > 0 else ("text-red" if avg_profit < 0 else "")
            avg_profit_str = f"{avg_profit:,.0f} 円"
            
            tot_lots = f"{row['合計ロット数_1セット']:.2f} L"
            max_lot = f"{row['最大単一ロット']:.2f} L"
            hold_time = f"{row['平均保有時間_H']:.1f} H"
            pip_diff = f"{row['平均ナンピン幅_pips']:.1f} pips"
            
            table_html += "<tr>\n"
            table_html += f"<td style='text-align:center; font-weight:bold;'>{pos_label}</td>\n"
            table_html += f"<td style='text-align:right;'>{set_count}</td>\n"
            table_html += f"<td style='text-align:right;'>{ratio}</td>\n"
            table_html += f"<td style='text-align:right;'>{cum_ratio}</td>\n"
            table_html += f"<td style='text-align:right;' class='{tot_profit_cls}'>{tot_profit_str}</td>\n"
            table_html += f"<td style='text-align:right;' class='{cum_profit_cls}'>{cum_profit_str}</td>\n"
            table_html += f"<td style='text-align:right;' class='{avg_profit_cls}'>{avg_profit_str}</td>\n"
            table_html += f"<td style='text-align:right;'>{tot_lots}</td>\n"
            table_html += f"<td style='text-align:right;'>{max_lot}</td>\n"
            table_html += f"<td style='text-align:right;'>{hold_time}</td>\n"
            table_html += f"<td style='text-align:right;'>{pip_diff}</td>\n"
            table_html += "</tr>\n"
        table_html += "</tbody></table></div>"
        st.markdown(table_html, unsafe_allow_html=True)
    else:
        st.info("ナンピン層データがありません。")
        
    st.markdown("<div style='font-size:0.85em; color:#94a3b8; margin-top:8px; margin-bottom:15px;'>※上記の集計には、バックテスト終了時に強制決済された未決済ポジション（close at stop）は含まれていません。</div>", unsafe_allow_html=True)

    st.divider()

    # ---------------------------------------------------------
    # 2. バックテスト終了時の未決済情報 (close at stop)
    # ---------------------------------------------------------
    st.subheader("🔥 バックテスト終了時の未決済情報 (close at stop)")
    
    if raw_df is not None and not raw_df.empty:
        cas_data = get_close_at_stop_stats(raw_df)
        if cas_data:
            pos_count = cas_data['pos_count']
            total_lot = cas_data['total_lot']
            total_loss = cas_data['total_loss']
            cas_profit_class = "text-green" if total_loss > 0 else ("text-red" if total_loss < 0 else "")
            
            cas_items = [
                {"title": "未決済ポジション数", "value": f"{pos_count} ポジ"},
                {"title": "保有ロット", "value": f"{total_lot:.2f} L"},
                {"title": "未決済損益 (close at stop)", "value": f"{total_loss:,.0f} 円", "text_class": cas_profit_class},
                {"title": "", "value": "", "card_class": "metric-hidden"},
                {"title": "", "value": "", "card_class": "metric-hidden"},
                {"title": "", "value": "", "card_class": "metric-hidden"},
                {"title": "", "value": "", "card_class": "metric-hidden"}
            ]
            render_metrics_grid(cas_items)
        else:
            st.info("バックテスト終了時の未決済ポジション（close at stop）はありませんでした。")
    else:
        st.info("未決済情報データが取得できませんでした。")

    st.divider()

    # ---------------------------------------------------------
    # 3. 最大ナンピン到達セット 明細情報
    # ---------------------------------------------------------
    st.subheader("⚠️ 最大ナンピン到達セット 明細情報")
    
    max_pos = res_df['PosCount'].max()
    max_pos_df = res_df[res_df['PosCount'] == max_pos].copy() if max_pos > 0 else pd.DataFrame()
    
    if not max_pos_df.empty:
        st.markdown(f"<div style='font-size:0.9em; color:#cbd5e1; margin-bottom:12px;'>本バックテストで最大ナンピン数（<strong>{max_pos} ポジ</strong>）に到達した全取引セット（全 {len(max_pos_df)} 件）の個別明細です。</div>", unsafe_allow_html=True)
        
        detail_html = "<div style='overflow-x:auto;'><table class='custom-table'>"
        detail_html += textwrap.dedent("""\
        <thead>
            <tr>
                <th style='text-align:center;'>初回エントリー日時</th>
                <th style='text-align:center;'>売買</th>
                <th style='text-align:center;'>最終エントリー日時</th>
                <th style='text-align:center;'>ポジション数</th>
                <th style='text-align:right;'>保有ロット</th>
                <th style='text-align:right;'>平均取得価格</th>
                <th style='text-align:right;'>仮想最大DD</th>
                <th style='text-align:right;'>決済損益</th>
                <th style='text-align:right;'>保有時間</th>
                <th style='text-align:right;'>保有日数</th>
            </tr>
        </thead>
        <tbody>
        """)
        
        for _, row in max_pos_df.iterrows():
            first_time = row['FirstOpenTime'].strftime('%Y-%m-%d %H:%M') if pd.notnull(row['FirstOpenTime']) else "-"
            trade_type = "買い" if str(row.get('Type', '')).lower() == 'buy' else "売り"
            last_time = row['LastOpenTime'].strftime('%Y-%m-%d %H:%M') if 'LastOpenTime' in row and pd.notnull(row['LastOpenTime']) else "-"
            pos_cnt_str = f"{int(row['PosCount'])} ポジ"
            tot_size_str = f"{row['TotalSize']:.2f} L"
            
            avg_price = row.get('WeightedAvgPrice', 0.0)
            avg_price_str = f"{avg_price:.3f}" if avg_price > 0 else "-"
            
            virt_dd = row.get('VirtualDDPips', 0.0)
            virt_dd_str = f"{virt_dd:.1f} pips"
            
            profit = row['TotalProfit']
            profit_cls = "text-green" if profit > 0 else ("text-red" if profit < 0 else "")
            profit_str = f"{profit:,.0f} 円"
            
            hold_h = f"{row['HoldHours']:.1f} 時間"
            hold_d = f"{(row['HoldHours'] / 24.0):.1f} 日"
            
            detail_html += "<tr>\n"
            detail_html += f"<td style='text-align:center;'>{first_time}</td>\n"
            detail_html += f"<td style='text-align:center;'>{trade_type}</td>\n"
            detail_html += f"<td style='text-align:center;'>{last_time}</td>\n"
            detail_html += f"<td style='text-align:center; font-weight:bold;'>{pos_cnt_str}</td>\n"
            detail_html += f"<td style='text-align:right;'>{tot_size_str}</td>\n"
            detail_html += f"<td style='text-align:right;'>{avg_price_str}</td>\n"
            detail_html += f"<td style='text-align:right;'>{virt_dd_str}</td>\n"
            detail_html += f"<td style='text-align:right;' class='{profit_cls}'>{profit_str}</td>\n"
            detail_html += f"<td style='text-align:right;'>{hold_h}</td>\n"
            detail_html += f"<td style='text-align:right;'>{hold_d}</td>\n"
            detail_html += "</tr>\n"
        detail_html += "</tbody></table></div>"
        st.markdown(detail_html, unsafe_allow_html=True)
    else:
        st.info("最大ナンピン到達セットのデータはありません。")
