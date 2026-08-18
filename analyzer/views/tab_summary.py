import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from modules.metrics import get_yearly_stats, get_close_at_stop_stats
from views.components import render_metric_card, render_metrics_grid

def render(res_df, raw_df, report_dd, report_dd_pct, initial_deposit):
    if res_df.empty:
        st.warning("データがありません。")
        return

    # 事前にclose at stopデータを取得
    cas_data = get_close_at_stop_stats(raw_df)
    cas_profit = cas_data['total_loss'] if cas_data else 0
    cas_profit_class = "text-red" if cas_profit < 0 else "text-green" if cas_profit > 0 else ""

    # 1. データの計算
    # 正常なトレードセット（close at stopを除外）でのロスカット集計
    normal_res_df = res_df[~res_df['IsCloseAtStop']] if 'IsCloseAtStop' in res_df.columns else res_df
    total_sets = len(normal_res_df)
    total_pos = len(raw_df[raw_df['CloseType'] != 'close at stop']) if 'CloseType' in raw_df.columns else len(raw_df)
    net_profit = res_df['TotalProfit'].sum()
    
    mt4_profit = raw_df[raw_df['NetProfit'] > 0]['NetProfit'].sum()
    mt4_loss = raw_df[raw_df['NetProfit'] <= 0]['NetProfit'].sum()
    pf = abs(mt4_profit / mt4_loss) if mt4_loss != 0 else float('inf')
    
    max_nanpin = res_df['PosCount'].max()
    loss_cuts = normal_res_df[normal_res_df['TotalProfit'] < 0]
    loss_count = len(loss_cuts)
    loss_amount = loss_cuts['TotalProfit'].sum()
    loss_rate = (loss_count / total_sets * 100) if total_sets > 0 else 0
    
    # UI表示 (6列 x 2段のコンパクトグリッド用データ準備)
    trend_arrow = "↑" if net_profit >= 0 else "↓"
    metrics_data = [
        # Row 1: メイン注目項目
        {"title": "初期証拠金", "value": f"{initial_deposit:,.0f}" if initial_deposit > 0 else "データなし"},
        {"title": "純損益", "value": f"{net_profit:,.0f} <span style='font-size:0.8em;opacity:0.85;'>{trend_arrow}</span>", "card_class": "metric-accent"},
        {"title": "プロフィットファクター", "value": f"{pf:.2f}"},
        {"title": "総利益 (MT4)", "value": f"{mt4_profit:,.0f}"},
        {"title": "総損失 (MT4)", "value": f"{mt4_loss:,.0f}", "text_class": "text-red"},
        {"title": "最大DD (金額)", "value": f"-{report_dd:,.0f}" if report_dd > 0 else "データなし", "text_class": "text-red"},
        {"title": "最大DD (割合)", "value": f"{report_dd_pct:.2f} %" if report_dd_pct > 0 else "データなし", "text_class": "text-red"},
    
        # Row 2: サブ項目
        {"title": "総取引セット数", "value": f"{total_sets} 回 <span style='font-size:0.55em;color:#94a3b8;font-weight:400;'>(計 {total_pos} ポジ)</span>"},
        {"title": "最大ナンピン数", "value": f"{max_nanpin} ポジ"},
        {"title": "ロスカット金額", "value": f"{loss_amount:,.0f}", "text_class": "text-red" if loss_amount < 0 else ""},
        {"title": "ロスカット率", "value": f"{loss_rate:.1f} %", "text_class": "text-red" if loss_rate > 0 else ""},
        {"title": "ロスカット回数", "value": f"{loss_count} 回", "text_class": "text-red" if loss_rate > 0 else ""},
        {"title": "未決済損益 (close at stop)", "value": f"{cas_profit:,.0f} 円", "text_class": cas_profit_class}
    ]
    
    # 2. 資産曲線 & ドローダウン二重軸グラフ (最上部に配置)
    st.subheader("📉 資産推移 ＆ ナンピンリスク")
    
    fig = go.Figure()
    # 資産推移
    fig.add_trace(go.Scatter(
        x=res_df['CloseTime'], y=res_df['CumulativeProfit'],
        mode='lines', name='累積損益',
        line=dict(color='#10b981', width=2),
        fill='tozeroy', fillcolor='rgba(16, 185, 129, 0.2)',
        hovertemplate='%{y:,.0f}<extra>累積損益</extra>'
    ))
    
    # 売り買いごとのナンピン数 (サブ軸)
    buy_df = res_df[res_df['Type'] == 'buy']
    sell_df = res_df[res_df['Type'] == 'sell']
    
    if not buy_df.empty:
        fig.add_trace(go.Scatter(
            x=buy_df['CloseTime'], y=buy_df['PosCount'],
            mode='markers', name='買いナンピン数',
            marker=dict(color='#0ea5e9', size=6, opacity=0.8), # シアン
            yaxis='y2',
            hovertemplate='%{y} ポジ<extra>買いナンピン</extra>'
        ))
    if not sell_df.empty:
        fig.add_trace(go.Scatter(
            x=sell_df['CloseTime'], y=sell_df['PosCount'],
            mode='markers', name='売りナンピン数',
            marker=dict(color='#f43f5e', size=6, opacity=0.8), # ローズレッド
            yaxis='y2',
            hovertemplate='%{y} ポジ<extra>売りナンピン</extra>'
        ))
        
        
    # 左上テキストアノテーション (レポート基準の数値)
    if report_dd > 0:
        fig.add_annotation(
            x=0.01, y=0.95, xref='paper', yref='paper',
            text=f"⚠️ レポート最大DD: -{report_dd:,.0f}",
            showarrow=False,
            font=dict(size=12, color="#f43f5e"),
            bgcolor="rgba(15, 23, 42, 0.8)",
            bordercolor="#f43f5e", borderwidth=1, borderpad=4,
            xanchor='left', yanchor='top'
        )
    
    fig.update_layout(
        height=380,
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font=dict(color='#f8fafc'),
        xaxis=dict(showgrid=True, gridcolor='#334155'),
        yaxis=dict(title='累積損益', showgrid=True, gridcolor='#334155', tickformat=',.0f'),
        yaxis2=dict(title='ナンピンポジション数', overlaying='y', side='right', showgrid=False, range=[0, max_nanpin + 2] if max_nanpin > 0 else [0, 5], tickformat=',.0f'),
        legend=dict(x=0.01, y=0.82, bgcolor='rgba(15,23,42,0.6)'),
        margin=dict(l=10, r=10, t=20, b=20),
        hovermode='x'
    )
    st.plotly_chart(fig, use_container_width=True)
    
    st.divider()

    # 3. 総合パフォーマンスメトリクスカード
    st.subheader("📊 総合パフォーマンス")
    render_metrics_grid(metrics_data)
    
    st.markdown("<div style='font-size:0.85em; color:#94a3b8; margin-top:8px; margin-bottom:15px;'>※総損失および最終純損益には、バックテスト終了時に強制決済された未決済含み損（close at stop）が含まれています。</div>", unsafe_allow_html=True)

    st.divider()

    # 4. バックテスト終了時の未決済情報 (close at stop)
    st.subheader("🔥 バックテスト終了時の未決済情報 (close at stop)")
    
    if cas_data:
        pos_count = cas_data['pos_count']
        total_lot = cas_data['total_lot']
        total_loss = cas_data['total_loss']
        
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

    st.divider()
    
    # 5. 年別パフォーマンス表
    st.subheader("📅 年別パフォーマンス")
    yearly_df = get_yearly_stats(res_df, raw_df)
    
    if not yearly_df.empty:
        # カスタムHTMLテーブルの構築
        table_html = "<div style='overflow-x:auto;'><table class='custom-table'>"
        # ヘッダー
        table_html += "<thead><tr>"
        for col in yearly_df.columns:
            table_html += f"<th>{col}</th>"
        table_html += "</tr></thead><tbody>"
        
        # 行データ
        for _, row in yearly_df.iterrows():
            table_html += "<tr>"
            for col in yearly_df.columns:
                val = row[col]
                cell_style = ""
                
                # 数値・金額のフォーマットと色付け
                if col in ['純損益', '総利益', '総損失', 'ロスカット金額']:
                    if isinstance(val, (int, float)):
                        if val > 0:
                            cell_style = "color: #10b981; font-weight: 500;"
                        elif val < 0:
                            cell_style = "color: #f43f5e; font-weight: 500;"
                        val = f"¥ {val:,.0f}"
                elif col == '仮想最大ドローダウン※':
                    cell_style = "color: #f43f5e;"
                elif isinstance(val, (int, float)):
                    val = f"{val:,.0f}"
                    
                table_html += f"<td style='{cell_style}'>{val}</td>"
            table_html += "</tr>"
            
        table_html += "</tbody></table></div>"
        
        # CSS定義
        st.markdown("""
        <style>
        .custom-table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Inter', sans-serif;
            font-size: 1em;
            background-color: #151b2b;
            color: #f8fafc;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 15px;
        }
        .custom-table th {
            background-color: #1e293b;
            color: #f8fafc;
            font-family: 'Inter', 'Roboto', 'Helvetica Neue', sans-serif;
            font-size: 1rem;
            font-weight: 400;
            text-align: center;
            padding: 12px 10px;
            border-bottom: 1px solid #334155;
            white-space: nowrap;
        }
        .custom-table td {
            padding: 10px 10px;
            border-bottom: 1px solid #1e293b;
            text-align: center;
            white-space: nowrap;
        }
        .custom-table tbody tr:hover {
            background-color: #1e293b;
        }
        </style>
        """, unsafe_allow_html=True)
        
        # テーブル描画
        st.markdown(table_html, unsafe_allow_html=True)
        
        # 注意書きボックス描画
        st.markdown("""<div style="background-color: rgba(56, 189, 248, 0.08); border-left: 4px solid #38bdf8; padding: 16px; border-radius: 6px; margin-top: 15px;">
<h4 style="margin-top: 0; margin-bottom: 12px; color: #38bdf8; font-size: 1.05em; font-weight: 600;">💡 年別パフォーマンスの集計基準 ＆ ご注意</h4>
<div style="line-height: 1.7; color: #cbd5e1;">
<strong>1. 集計基準（年またぎのポジションについて）※</strong><br>
・本テーブルの各種集計（セット数・ポジション数・損益）はすべて<strong>「決済完了日時」を基準</strong>としています。<br>
・年を跨いで保有し翌年に決済された取引セットは、損益が確定した<strong>決済年の実績として全ポジション数がまとめてカウント</strong>されます。<br><br>
<strong>2. 仮想最大ドローダウンについて※</strong><br>
・MT4のHTMLレポートには年ごとのドローダウン推移が出力されないため、その年の最大ナンピンセットにおける「平均取得単価（建値）から想定最大逆行価格までの距離 (pips)」と「合計保有ロット数」から算出された参考値（<u style="text-decoration: underline; font-weight: 500;">距離pips × 合計ロット数</u>）を掲載しています。<br>
・<b style="color: #f43f5e; font-weight: bold;">MT4で表示される最大ドローダウンとは乖離があります。</b><br>
<span style="display: block; margin-top: 4px;">※計算式： <u style="text-decoration: underline; font-weight: 500;">(平均取得単価 − 想定最悪価格) の pips距離 × 合計ロット数(L)</u><br>（想定最悪価格 ＝ 最後にエントリーしたポジション価格から、さらに平均ナンピン幅分だけ逆行した価格）</span>
</div>
</div>""", unsafe_allow_html=True)
