import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from modules.metrics import get_hourly_stats, get_weekday_stats, get_weekday_hour_stats

def get_rank_badge(val, ranked_list):
    """
    値がranked_list(昇順にソートされた上位3つのユニークな値のリスト)に含まれる場合、
    順位に応じたネオンバッジのHTML文字列を返す。
    """
    if val not in ranked_list:
        return ""
    
    rank = ranked_list.index(val) + 1
    if rank == 1:
        return " <span style='background:rgba(16,185,129,0.2); color:#34d399; border:1px solid #10b981; padding:2px 6px; border-radius:4px; font-size:0.75em; margin-left:5px;'>🥇 1位</span>"
    elif rank == 2:
        return " <span style='background:rgba(6,182,212,0.2); color:#22d3ee; border:1px solid #06b6d4; padding:2px 6px; border-radius:4px; font-size:0.75em; margin-left:5px;'>🥈 2位</span>"
    elif rank == 3:
        return " <span style='background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid #3b82f6; padding:2px 6px; border-radius:4px; font-size:0.75em; margin-left:5px;'>🥉 3位</span>"
    return ""

def render(res_df):
    if res_df.empty:
        st.warning("表示できるデータがありません。")
        return

    # --- 0. 最も安全な「曜日 × 時間帯」ベスト3 ---
    st.subheader("🏆 最も安全な「曜日 × 時間帯」ベスト3")
    st.markdown("<div style='font-size:0.9em; color:#cbd5e1; margin-bottom:12px;'>全168パターンの「曜日 × 時間帯」から、ナンピン数が少なく安全性が高い上位3つを抽出します。</div>", unsafe_allow_html=True)
    
    col_ui1, col_ui2 = st.columns([1, 2])
    with col_ui1:
        min_entries = st.number_input("対象とする最低エントリー回数:", min_value=1, max_value=1000, value=3, step=1, help="エントリー回数が極端に少ない時間帯がランキングに入るのを防ぎます。")
        
    rank_stats = get_weekday_hour_stats(res_df)
    valid_rank_stats = rank_stats[rank_stats['エントリー回数'] >= min_entries].copy()
    
    if not valid_rank_stats.empty:
        weekdays_names = ['月', '火', '水', '木', '金', '土', '日']
        
        # 平均ナンピン数ランキング (同値の場合は最大ナンピン数が少ない順 -> エントリー数が多い順)
        avg_top3 = valid_rank_stats.sort_values(by=['平均ナンピン数', '最大ナンピン数', 'エントリー回数'], ascending=[True, True, False]).head(3)
        # 最大ナンピン数ランキング (同値の場合は平均ナンピン数が少ない順 -> エントリー数が多い順)
        max_top3 = valid_rank_stats.sort_values(by=['最大ナンピン数', '平均ナンピン数', 'エントリー回数'], ascending=[True, True, False]).head(3)
        
        rank_html = "<div style='display:flex; flex-wrap:wrap; gap:20px; margin-bottom:20px;'>"
        
        # 平均ランキングブロック
        rank_html += "<div style='flex:1; min-width:300px; background:#1e293b; border-radius:8px; padding:15px; border:1px solid #334155;'>"
        rank_html += "<h4 style='margin-top:0; color:#10b981; margin-bottom:15px; font-size:1.1rem; font-weight:600;'>🌱 平均ナンピン数が少ない Top 3</h4>"
        medals = ["🥇 1位", "🥈 2位", "🥉 3位"]
        colors = ["#34d399", "#22d3ee", "#60a5fa"]
        
        for i, (_, row) in enumerate(avg_top3.iterrows()):
            wd = weekdays_names[int(row['Weekday'])]
            hr = f"{int(row['EntryHour']):02d}時"
            avg_p = f"{row['平均ナンピン数']:.2f}"
            max_p = int(row['最大ナンピン数'])
            cnt = int(row['エントリー回数'])
            
            rank_html += f"<div style='margin-bottom:10px; padding:10px; background:#151b2b; border-left:4px solid {colors[i]}; border-radius:4px; display:flex; justify-content:space-between; align-items:center;'>"
            rank_html += f"<div><span style='color:{colors[i]}; font-weight:bold; margin-right:8px;'>{medals[i]}</span><span style='font-size:1.1em; font-weight:600; color:#f8fafc;'>{wd}曜日 {hr}</span></div>"
            rank_html += f"<div style='text-align:right;'><div style='color:#f8fafc; font-weight:bold;'>平均 {avg_p} ポジ</div><div style='font-size:0.8em; color:#94a3b8;'>最大 {max_p} / {cnt}回</div></div>"
            rank_html += "</div>"
        rank_html += "</div>"
        
        # 最大ランキングブロック
        rank_html += "<div style='flex:1; min-width:300px; background:#1e293b; border-radius:8px; padding:15px; border:1px solid #334155;'>"
        rank_html += "<h4 style='margin-top:0; color:#06b6d4; margin-bottom:15px; font-size:1.1rem; font-weight:600;'>🛡️ 最大ナンピン数が少ない Top 3</h4>"
        
        for i, (_, row) in enumerate(max_top3.iterrows()):
            if i >= len(colors): break
            wd = weekdays_names[int(row['Weekday'])]
            hr = f"{int(row['EntryHour']):02d}時"
            avg_p = f"{row['平均ナンピン数']:.2f}"
            max_p = int(row['最大ナンピン数'])
            cnt = int(row['エントリー回数'])
            
            rank_html += f"<div style='margin-bottom:10px; padding:10px; background:#151b2b; border-left:4px solid {colors[i]}; border-radius:4px; display:flex; justify-content:space-between; align-items:center;'>"
            rank_html += f"<div><span style='color:{colors[i]}; font-weight:bold; margin-right:8px;'>{medals[i]}</span><span style='font-size:1.1em; font-weight:600; color:#f8fafc;'>{wd}曜日 {hr}</span></div>"
            rank_html += f"<div style='text-align:right;'><div style='color:#f8fafc; font-weight:bold;'>最大 {max_p} ポジ</div><div style='font-size:0.8em; color:#94a3b8;'>平均 {avg_p} / {cnt}回</div></div>"
            rank_html += "</div>"
        rank_html += "</div>"
        
        rank_html += "</div>"
        st.markdown(rank_html, unsafe_allow_html=True)
    else:
        st.info("指定された最低エントリー回数を満たすデータがありません。")

    st.divider()

    # --- 1. エントリー時間帯別の傾向 ---
    st.subheader("⏰ エントリー時間帯別の傾向")
    st.markdown("<div style='font-size:0.9em; color:#cbd5e1; margin-bottom:8px;'>1ポジ目がエントリーされた「時間帯(0時〜23時)」ごとの集計です。</div>", unsafe_allow_html=True)
    
    # 曜日フィルターUI
    weekdays_list = ["全体", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"]
    selected_weekday = st.radio("表示する曜日を絞り込む:", weekdays_list, horizontal=True)
    
    # データフィルタリング
    hour_df = res_df.copy()
    if selected_weekday != "全体":
        wd_idx = weekdays_list.index(selected_weekday) - 1
        hour_df = hour_df[hour_df['Weekday'] == wd_idx]
        
    hour_stats = get_hourly_stats(hour_df)
    total_entries = hour_stats['エントリー回数'].sum()
    
    # --- 1. 時間帯グラフ ---
    fig_hour = go.Figure()
    fig_hour.add_trace(go.Bar(
        x=hour_stats['EntryHour'].apply(lambda x: f"{int(x):02d}時"),
        y=hour_stats['エントリー回数'], 
        name='エントリー回数', 
        marker_color='#06b6d4',
        opacity=0.8
    ))
    fig_hour.add_trace(go.Scatter(
        x=hour_stats['EntryHour'].apply(lambda x: f"{int(x):02d}時"),
        y=hour_stats['平均ナンピン数'], 
        name='平均ナンピン数', 
        yaxis='y2', 
        mode='lines+markers', 
        line=dict(color='#10b981', width=3),
        marker=dict(size=8, color='#10b981', line=dict(width=1, color='white'))
    ))
    
    fig_hour.update_layout(
        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#FAFAFA'),
        xaxis=dict(title='', tickangle=0),
        yaxis=dict(title='エントリー回数', side='left', showgrid=True, gridcolor='#334155'),
        yaxis2=dict(title='平均ナンピン数', side='right', overlaying='y', showgrid=False, rangemode='tozero'),
        legend=dict(x=0.01, y=0.99, bgcolor='rgba(15,23,42,0.8)'), margin=dict(l=0, r=0, t=30, b=0)
    )
    st.plotly_chart(fig_hour, use_container_width=True)
    
    # --- 2. 時間帯カスタムテーブル ---
    st.markdown("<div style='font-size:0.85em; color:#94a3b8; margin-bottom:10px;'>※各ナンピン数の <span style='color:#34d399;'>🥇 1位 〜 🥉 3位</span> バッジは、値が小さく安全性が高いトップ3を示します。</div>", unsafe_allow_html=True)
    
    # 順位（トップ3）の算出（エントリーがない時間は除外）
    valid_hours = hour_stats[hour_stats['エントリー回数'] > 0]
    avg_pos_ranks = sorted(valid_hours['平均ナンピン数'].unique())[:3] if not valid_hours.empty else []
    max_pos_ranks = sorted(valid_hours['最大ナンピン数'].unique())[:3] if not valid_hours.empty else []
    
    table_html = "<div style='overflow-x:auto;'><table class='custom-table'>"
    table_html += "<thead><tr>"
    table_html += "<th style='text-align:center;'>時間帯</th>"
    table_html += "<th style='text-align:right;'>エントリー回数</th>"
    table_html += "<th style='text-align:right;'>回数割合 (%)</th>"
    table_html += "<th style='text-align:left;'>平均ナンピン数</th>"
    table_html += "<th style='text-align:left;'>最大ナンピン数</th>"
    table_html += "<th style='text-align:right;'>平均保有時間</th>"
    table_html += "<th style='text-align:right;'>平均保有日数</th>"
    table_html += "</tr></thead><tbody>"
    
    for _, row in hour_stats.iterrows():
        hour_val = int(row['EntryHour'])
        hour_str = f"{hour_val:02d}時"
        
        cnt = int(row['エントリー回数'])
        pct = (cnt / total_entries * 100) if total_entries > 0 else 0
        avg_pos = row['平均ナンピン数']
        max_pos = int(row['最大ナンピン数'])
        avg_h = row['平均保有時間']
        avg_d = avg_h / 24.0
        
        # バッジの取得
        avg_badge = get_rank_badge(avg_pos, avg_pos_ranks) if cnt > 0 else ""
        max_badge = get_rank_badge(max_pos, max_pos_ranks) if cnt > 0 else ""
        
        # 行の背景を微妙にハイライト（1位が含まれる場合のみ）
        row_bg = "background-color: rgba(16,185,129,0.03);" if "🥇" in avg_badge or "🥇" in max_badge else ""
        
        table_html += f"<tr style='{row_bg}'>\n"
        table_html += f"<td style='text-align:center; font-weight:bold;'>{hour_str}</td>\n"
        table_html += f"<td style='text-align:right;'>{cnt} 回</td>\n"
        table_html += f"<td style='text-align:right;'>{pct:.1f} %</td>\n"
        table_html += f"<td style='text-align:left;'>{avg_pos:.2f} ポジ{avg_badge}</td>\n"
        table_html += f"<td style='text-align:left;'>{max_pos} ポジ{max_badge}</td>\n"
        table_html += f"<td style='text-align:right;'>{avg_h:.1f} 時間</td>\n"
        table_html += f"<td style='text-align:right;'>{avg_d:.1f} 日</td>\n"
        table_html += "</tr>\n"
    
    table_html += "</tbody></table></div>"
    st.markdown(table_html, unsafe_allow_html=True)
    
    st.divider()
    
    # --- 3. 曜日別グラフ ---
    st.subheader("📅 曜日別のエントリー傾向")
    st.markdown("<div style='font-size:0.9em; color:#cbd5e1; margin-bottom:12px;'>曜日ごとのパフォーマンスとナンピン数の傾向です。全体集計となります。</div>", unsafe_allow_html=True)
    
    wk_stats = get_weekday_stats(res_df)
    total_wk_entries = wk_stats['エントリー回数'].sum()
    weekdays = ['月', '火', '水', '木', '金', '土', '日']
    
    fig_wk = go.Figure()
    fig_wk.add_trace(go.Bar(
        x=[weekdays[int(w)] for w in wk_stats['Weekday']],
        y=wk_stats['エントリー回数'], 
        name='エントリー回数', 
        marker_color='#8b5cf6',
        opacity=0.8
    ))
    fig_wk.add_trace(go.Scatter(
        x=[weekdays[int(w)] for w in wk_stats['Weekday']],
        y=wk_stats['平均ナンピン数'], 
        name='平均ナンピン数', 
        yaxis='y2', 
        mode='lines+markers', 
        line=dict(color='#f43f5e', width=3),
        marker=dict(size=8, color='#f43f5e', line=dict(width=1, color='white'))
    ))
    
    fig_wk.update_layout(
        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#FAFAFA'),
        xaxis=dict(title='', tickangle=0),
        yaxis=dict(title='エントリー回数', side='left', showgrid=True, gridcolor='#334155'),
        yaxis2=dict(title='平均ナンピン数', side='right', overlaying='y', showgrid=False, rangemode='tozero'),
        legend=dict(x=0.01, y=0.99, bgcolor='rgba(15,23,42,0.8)'), margin=dict(l=0, r=0, t=30, b=0)
    )
    st.plotly_chart(fig_wk, use_container_width=True)
    
    # --- 4. 曜日別カスタムテーブル ---
    valid_wks = wk_stats[wk_stats['エントリー回数'] > 0]
    wk_avg_ranks = sorted(valid_wks['平均ナンピン数'].unique())[:3] if not valid_wks.empty else []
    wk_max_ranks = sorted(valid_wks['最大ナンピン数'].unique())[:3] if not valid_wks.empty else []

    wk_html = "<div style='overflow-x:auto;'><table class='custom-table'>"
    wk_html += "<thead><tr>"
    wk_html += "<th style='text-align:center;'>曜日</th>"
    wk_html += "<th style='text-align:right;'>エントリー回数</th>"
    wk_html += "<th style='text-align:right;'>割合 (%)</th>"
    wk_html += "<th style='text-align:left;'>平均ナンピン数</th>"
    wk_html += "<th style='text-align:left;'>最大ナンピン数</th>"
    wk_html += "<th style='text-align:right;'>平均保有時間</th>"
    wk_html += "<th style='text-align:right;'>合計損益</th>"
    wk_html += "</tr></thead><tbody>"
    
    for _, row in wk_stats.iterrows():
        wd = int(row['Weekday'])
        wd_str = weekdays[wd] + "曜日"
        
        cnt = int(row['エントリー回数'])
        pct = (cnt / total_wk_entries * 100) if total_wk_entries > 0 else 0
        avg_pos = row['平均ナンピン数']
        max_pos = int(row['最大ナンピン数'])
        avg_h = row['平均保有時間']
        profit = row['合計損益']
        
        avg_badge = get_rank_badge(avg_pos, wk_avg_ranks) if cnt > 0 else ""
        max_badge = get_rank_badge(max_pos, wk_max_ranks) if cnt > 0 else ""
        row_bg = "background-color: rgba(16,185,129,0.03);" if "🥇" in avg_badge or "🥇" in max_badge else ""
        
        profit_cls = "text-green" if profit > 0 else ("text-red" if profit < 0 else "")
        profit_str = f"{profit:,.0f} 円"
        
        wk_html += f"<tr style='{row_bg}'>\n"
        wk_html += f"<td style='text-align:center; font-weight:bold;'>{wd_str}</td>\n"
        wk_html += f"<td style='text-align:right;'>{cnt} 回</td>\n"
        wk_html += f"<td style='text-align:right;'>{pct:.1f} %</td>\n"
        wk_html += f"<td style='text-align:left;'>{avg_pos:.2f} ポジ{avg_badge}</td>\n"
        wk_html += f"<td style='text-align:left;'>{max_pos} ポジ{max_badge}</td>\n"
        wk_html += f"<td style='text-align:right;'>{avg_h:.1f} 時間</td>\n"
        wk_html += f"<td style='text-align:right;' class='{profit_cls}'>{profit_str}</td>\n"
        wk_html += "</tr>\n"
        
    wk_html += "</tbody></table></div>"
    st.markdown(wk_html, unsafe_allow_html=True)
