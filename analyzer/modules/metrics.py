import pandas as pd
import numpy as np

def analyze_trades(df):
    """
    全取引履歴DFから、同時決済されたポジションを「1セット」としてグループ化し、
    セット単位の統計情報（ナンピン数、合計損益、保有時間など）を算出する。
    """
    if df.empty:
        return pd.DataFrame()
        
    grouped = df.groupby(['Type', 'CloseTime'])
    results = []
    
    for (type_str, close_time), group in grouped:
        group = group.sort_values('OpenTime')
        pos_count = len(group)
        first_open_time = group['OpenTime'].min()
        total_profit = group['NetProfit'].sum()
        total_size = group['Size'].sum()
        max_size = group['Size'].max()
        
        hold_time = close_time - first_open_time
        hold_hours = hold_time.total_seconds() / 3600.0
        
        # Pips換算 (簡易判定) ＆ 仮想ドローダウン距離の計算
        if pos_count > 1:
            prices = group['OpenPrice'].values
            diffs = np.abs(np.diff(prices))
            avg_diff_raw = np.mean(diffs)
            mean_price = np.mean(prices)
            pip_multiplier = 100 if mean_price > 50 else 10000
            avg_diff_pips = avg_diff_raw * pip_multiplier
            
            # ユーザー定義の仮想ドローダウン計算ロジック
            # ① 加重平均建値（平均取得単価）の算出
            weighted_avg_price = (group['OpenPrice'] * group['Size']).sum() / total_size if total_size > 0 else group['OpenPrice'].mean()
            last_open_price = group['OpenPrice'].iloc[-1]
            
            # ② 最後の足からさらに平均ナンピン幅分逆行した想定最悪価格
            if type_str.lower() == 'buy':
                worst_price = last_open_price - avg_diff_raw
            else:
                worst_price = last_open_price + avg_diff_raw
                
            # ③④ 平均取得単価から想定最悪価格までの距離(pips)
            virtual_dd_pips = abs(weighted_avg_price - worst_price) * pip_multiplier
            # close at stop (バックテスト強制終了) の判定
            is_cas = ('CloseType' in group.columns and (group['CloseType'] == 'close at stop').any())
        else:
            avg_diff_pips = 0.0
            virtual_dd_pips = 0.0
            is_cas = ('CloseType' in group.columns and (group['CloseType'] == 'close at stop').any())
            
        weekday = first_open_time.weekday()
        
        results.append({
            'CloseTime': close_time,
            'Type': type_str,
            'PosCount': pos_count,
            'FirstOpenTime': first_open_time,
            'LastOpenTime': group['OpenTime'].max(),
            'WeightedAvgPrice': weighted_avg_price if pos_count > 1 else group['OpenPrice'].iloc[0],
            'HoldHours': hold_hours,
            'TotalProfit': total_profit,
            'TotalSize': total_size,
            'MaxSize': max_size,
            'AvgPipsDiff': avg_diff_pips,
            'VirtualDDPips': virtual_dd_pips,
            'IsCloseAtStop': is_cas,
            'Weekday': weekday
        })
        
    res_df = pd.DataFrame(results)
    # 累積損益 (残高推移用)
    res_df = res_df.sort_values('CloseTime')
    res_df['CumulativeProfit'] = res_df['TotalProfit'].cumsum()
    # ドローダウンの計算 (確定損益ベース)
    res_df['HighWaterMark'] = res_df['CumulativeProfit'].cummax()
    res_df['Drawdown'] = res_df['CumulativeProfit'] - res_df['HighWaterMark']
    
    return res_df

def get_yearly_stats(res_df, raw_df):
    """
    年別パフォーマンスを集計する。
    """
    if res_df.empty or raw_df.empty:
        return pd.DataFrame()
        
    # 年またぎは決済日基準
    res_df['Year'] = res_df['CloseTime'].dt.year
    raw_df['Year'] = raw_df['CloseTime'].dt.year
    
    yearly = []
    for year, group in res_df.groupby('Year'):
        raw_group = raw_df[raw_df['Year'] == year]
        
        trades = len(group)
        pos_count = group['PosCount'].sum()
        
        # 個別の生注文から純利益・損失を集計
        profit_trades = raw_group[raw_group['NetProfit'] > 0]['NetProfit'].sum()
        loss_trades = raw_group[raw_group['NetProfit'] <= 0]['NetProfit'].sum()
        
        net_profit = group['TotalProfit'].sum()
        pf = abs(profit_trades / loss_trades) if loss_trades != 0 else float('inf')
        
        year_max_pos = group['PosCount'].max()
        
        # 正常なトレードセットのみからロスカットを算出 (close at stop を除外)
        normal_group = group[~group['IsCloseAtStop']] if 'IsCloseAtStop' in group.columns else group
        normal_trades = len(normal_group)
        
        loss_cuts = normal_group[normal_group['TotalProfit'] < 0]
        loss_cut_count = len(loss_cuts)
        loss_cut_amount = loss_cuts['TotalProfit'].sum()
        loss_cut_rate = (loss_cut_count / normal_trades * 100) if normal_trades > 0 else 0
        
        # 仮想ドローダウン（平均建値からの距離pips × 合計ロット数）
        max_pos_df = group[group['PosCount'] == year_max_pos]
        if not max_pos_df.empty:
            avg_dd_pips = max_pos_df['VirtualDDPips'].mean()
            avg_total_size = max_pos_df['TotalSize'].mean()
            dd_str = f"-{avg_dd_pips:.1f} pips × {avg_total_size:.2f}Lot"
        else:
            dd_str = "0"
        
        yearly.append({
            '年': str(year) + "年",
            '純損益': net_profit,
            'PF': f"{pf:.2f}" if pf != float('inf') else "∞",
            '総利益': profit_trades,
            '総損失': loss_trades,
            '総取引セット数※': f"{trades} 回 (計 {pos_count} ポジ)",
            '最大ナンピン数': f"{year_max_pos} ポジ",
            'ロスカット金額': loss_cut_amount,
            'ロスカット率': f"{loss_cut_rate:.1f} %",
            'ロスカット回数': f"{loss_cut_count} 回",
            '仮想最大ドローダウン※': dd_str
        })
        
    return pd.DataFrame(yearly)

def get_close_at_stop_stats(raw_df):
    """
    バックテスト終了時に強制決済された未決済ポジション（close at stop）を集計する。
    """
    if raw_df.empty:
        return None
        
    # パーサーからCloseTypeが取得できている場合
    if 'CloseType' in raw_df.columns:
        cas_df = raw_df[raw_df['CloseType'] == 'close at stop']
    else:
        # 互換性フォールバック：最後の決済日時に複数ポジションが同値決済されているものを探す
        last_close = raw_df['CloseTime'].max()
        cas_df = raw_df[raw_df['CloseTime'] == last_close]
        
    if cas_df.empty:
        return None
        
    pos_count = len(cas_df)
    total_lot = cas_df['Size'].sum()
    total_loss = cas_df['NetProfit'].sum()
    
    return {
        'pos_count': pos_count,
        'total_lot': total_lot,
        'total_loss': total_loss
    }

def get_pos_stats(res_df):
    """
    ポジション数(ナンピン数)別の統計情報を集計する。
    (close at stop ポジションを除外して集計)
    """
    if res_df.empty:
        return pd.DataFrame()
        
    df = res_df[~res_df['IsCloseAtStop']].copy() if 'IsCloseAtStop' in res_df.columns else res_df.copy()
    if df.empty:
        df = res_df.copy()
        
    stats_df = df.groupby('PosCount').agg(
        セット数=('CloseTime', 'count'),
        合計損益=('TotalProfit', 'sum'),
        平均損益=('TotalProfit', 'mean'),
        合計ロット数_1セット=('TotalSize', 'mean'),
        最大単一ロット=('MaxSize', 'mean'),
        平均保有時間_H=('HoldHours', 'mean'),
        平均ナンピン幅_pips=('AvgPipsDiff', 'mean')
    ).reset_index()
    
    total_sets = stats_df['セット数'].sum()
    stats_df['セット数割合'] = (stats_df['セット数'] / total_sets * 100) if total_sets > 0 else 0
    stats_df['セット数割合累積'] = stats_df['セット数割合'].cumsum()
    stats_df['合計損益累積'] = stats_df['合計損益'].cumsum()
    
    cols = ['PosCount', 'セット数', 'セット数割合', 'セット数割合累積', '合計損益', '合計損益累積', '平均損益', '合計ロット数_1セット', '最大単一ロット', '平均保有時間_H', '平均ナンピン幅_pips']
    return stats_df[cols]

def get_hourly_stats(res_df):
    """
    時間帯(0-23時)別のエントリー傾向を集計する。
    """
    if res_df.empty:
        return pd.DataFrame()
        
    res_df['EntryHour'] = res_df['FirstOpenTime'].dt.hour
    hour_stats = res_df.groupby('EntryHour').agg(
        エントリー回数=('CloseTime', 'count'),
        平均ナンピン数=('PosCount', 'mean'),
        最大ナンピン数=('PosCount', 'max'),
        平均保有時間=('HoldHours', 'mean')
    ).reset_index()
    
    all_hours = pd.DataFrame({'EntryHour': range(24)})
    hour_stats = pd.merge(all_hours, hour_stats, on='EntryHour', how='left').fillna(0)
    return hour_stats

def get_weekday_stats(res_df):
    """
    曜日別(0=月...6=日)別のエントリー傾向を集計する。
    """
    if res_df.empty:
        return pd.DataFrame()
        
    weekday_stats = res_df.groupby('Weekday').agg(
        エントリー回数=('CloseTime', 'count'),
        平均ナンピン数=('PosCount', 'mean'),
        最大ナンピン数=('PosCount', 'max'),
        平均保有時間=('HoldHours', 'mean'),
        合計損益=('TotalProfit', 'sum')
    ).reset_index()
    
    all_days = pd.DataFrame({'Weekday': range(7)})
    weekday_stats = pd.merge(all_days, weekday_stats, on='Weekday', how='left').fillna(0)
    return weekday_stats

def get_weekday_hour_stats(res_df):
    """
    曜日(0=月...6=日) × 時間帯(0-23時) 別のエントリー傾向を集計する。
    """
    if res_df.empty:
        return pd.DataFrame()
        
    res_df['EntryHour'] = res_df['FirstOpenTime'].dt.hour
    stats = res_df.groupby(['Weekday', 'EntryHour']).agg(
        エントリー回数=('CloseTime', 'count'),
        平均ナンピン数=('PosCount', 'mean'),
        最大ナンピン数=('PosCount', 'max')
    ).reset_index()
    return stats

def get_loss_cuts(res_df):
    """
    ロスカット（合計損益がマイナス）となったセットを抽出する。
    """
    if res_df.empty:
        return pd.DataFrame()
        
    loss_df = res_df[res_df['TotalProfit'] < 0].copy()
    if loss_df.empty:
        return pd.DataFrame()
        
    loss_df['HoldDays'] = loss_df['HoldHours'] / 24.0
    loss_df = loss_df[['FirstOpenTime', 'CloseTime', 'Type', 'PosCount', 'TotalProfit', 'HoldHours', 'HoldDays']]
    loss_df = loss_df.sort_values('CloseTime', ascending=False)
    loss_df.columns = ['エントリー日時', '決済日時', '売買', '最大ナンピン数', '損失額', '保有時間(H)', '保有日数(D)']
    return loss_df
