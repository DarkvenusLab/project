import pandas as pd
from bs4 import BeautifulSoup
import re

def load_and_parse(uploaded_file):
    """
    アップロードされたHTMLファイルを読み込み、取引履歴データフレームとEA名を返す。
    MT4の日本語文字化け（cp932/utf-8など）を自動判別してパースする。
    """
    # バイトデータを読み込む
    raw_bytes = uploaded_file.read()
    
    # エンコーディングの推測とデコード
    html_text = ""
    for enc in ['utf-8', 'cp932', 'shift_jis']:
        try:
            html_text = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    
    if not html_text:
        # どうしてもデコードできなければエラー文字を置換してutf-8として読む
        html_text = raw_bytes.decode('utf-8', errors='replace')
        
    soup = BeautifulSoup(html_text, 'html.parser')
    
    # 1. EA名の取得
    ea_name = "Unknown EA"
    title_tag = soup.find('title')
    if title_tag and title_tag.string:
        # 例: "Strategy Tester: ToNaPi_ver_2" -> "ToNaPi_ver_2"
        m = re.search(r'Strategy Tester:?\s*(.*)', title_tag.string, re.IGNORECASE)
        if m:
            ea_name = m.group(1).strip()
        else:
            ea_name = title_tag.string.strip()
            
    # タイトルから取れなかった場合のフォールバック（<div style="font: 16pt Times New Roman"><b>...</b></div>）
    if ea_name == "Unknown EA":
        for div in soup.find_all('div'):
            if div.b and '16pt' in str(div.get('style', '')):
                ea_name = div.b.get_text(strip=True)
                break
                
    # 1.5 レポート全体テキストからの情報抽出 (DD, DD%, Initial Deposit)
    report_dd_val = 0.0
    report_dd_pct = 0.0
    initial_deposit = 0.0
    
    text_content = soup.get_text(separator=' ')
    
    # 最大ドローダウンとパーセント
    m_dd = re.search(r'(?:Maximal drawdown|最大ドローダウン)[^\d\.\-]*([\d\.\-]+)\s*\(\s*([\d\.\-]+)\s*%\s*\)', text_content, re.IGNORECASE)
    if m_dd:
        try:
            report_dd_val = float(m_dd.group(1))
            report_dd_pct = float(m_dd.group(2))
        except ValueError:
            pass
    else:
        # パーセントがうまく取れない場合のフォールバック
        m_dd2 = re.search(r'(?:Maximal drawdown|最大ドローダウン)[^\d\.\-]*([\d\.\-]+)', text_content, re.IGNORECASE)
        if m_dd2:
            try: report_dd_val = float(m_dd2.group(1))
            except ValueError: pass
            
    # 初期証拠金
    m_dep = re.search(r'(?:Initial deposit|初期証拠金)[^\d\.\-]*([\d\.\-]+)', text_content, re.IGNORECASE)
    if m_dep:
        try:
            initial_deposit = float(m_dep.group(1))
        except ValueError:
            pass

    # 1.6 通貨ペア(Symbol) と 時間足(Period) の抽出
    symbol = ""
    period = ""
    
    m_sym = re.search(r'(?:Symbol|通貨ペア|銘柄)[^\w]*([A-Z0-9_\-\.\+]+)', text_content, re.IGNORECASE)
    if m_sym:
        symbol = m_sym.group(1).strip()
    else:
        for td in soup.find_all('td'):
            txt = td.get_text(strip=True)
            if 'Symbol' in txt or '通貨ペア' in txt:
                nxt = td.find_next_sibling('td')
                if nxt:
                    symbol = nxt.get_text(strip=True).split(' ')[0]
                    break
                    
    m_per = re.search(r'(?:Period|期間)[^\w\d]*([^\n\r\(]*\((M\d+|H\d+|D1|W1|MN)\)|M\d+|H\d+|D1|W1|MN)', text_content, re.IGNORECASE)
    if m_per:
        period_match = re.search(r'(M\d+|H\d+|D1|W1|MN)', m_per.group(0), re.IGNORECASE)
        if period_match:
            period = period_match.group(1).upper()
        else:
            period = m_per.group(1).strip()
            
    if not period:
        for td in soup.find_all('td'):
            txt = td.get_text(strip=True)
            if 'Period' in txt or '期間' in txt:
                nxt = td.find_next_sibling('td')
                if nxt:
                    period_match = re.search(r'(M\d+|H\d+|D1|W1|MN)', nxt.get_text(strip=True), re.IGNORECASE)
                    if period_match:
                        period = period_match.group(1).upper()
                    break

    # 2. 取引履歴のパース
    rows = soup.find_all('tr')
    completed_trades = []
    tester_trades = {} # key: order_id
    
    for row in rows:
        cols = row.find_all('td')
        texts = [c.get_text(strip=True) for c in cols]
        
        if not texts or not texts[0].isdigit():
            continue
            
        # MT4 Strategy Tester Report format (approx 9-10 cols)
        if len(cols) == 10 or (len(cols) >= 9 and 'colspan' in str(row)):
            time_str = texts[1]
            type_str = texts[2].lower()
            try:
                order_id = int(texts[3])
                size = float(texts[4]) if texts[4] else 0.0
                price = float(texts[5]) if texts[5] else 0.0
            except ValueError:
                continue
                
            if type_str in ['buy', 'sell']:
                tester_trades[order_id] = {
                    'Ticket': order_id,
                    'OpenTime': time_str,
                    'Type': type_str,
                    'Size': size,
                    'OpenPrice': price
                }
            elif type_str not in ['buy', 'sell', 'modify']:
                if order_id in tester_trades:
                    profit_str = texts[8].replace(' ', '') if len(texts) > 8 else ""
                    if profit_str:
                        try:
                            profit = float(profit_str)
                            trade = tester_trades[order_id]
                            trade['CloseTime'] = time_str
                            trade['ClosePrice'] = price
                            trade['CloseType'] = type_str # e.g. 'close at stop'
                            trade['NetProfit'] = profit
                            completed_trades.append(trade)
                            del tester_trades[order_id]
                        except ValueError:
                            pass

        # MT4 Account Statement format (approx 14 cols)
        elif len(cols) >= 13:
            type_str = texts[2].lower()
            if type_str not in ['buy', 'sell']:
                continue
            try:
                ticket = texts[0]
                open_time = texts[1]
                size = float(texts[3])
                open_price = float(texts[5])
                close_time = texts[8]
                close_price = float(texts[9])
                
                commission = float(texts[10].replace(' ', '')) if texts[10] else 0.0
                taxes = float(texts[11].replace(' ', '')) if texts[11] else 0.0
                swap = float(texts[12].replace(' ', '')) if texts[12] else 0.0
                profit = float(texts[13].replace(' ', '')) if len(texts) > 13 and texts[13] else 0.0
                
                if not close_time:
                    continue
                    
                completed_trades.append({
                    'Ticket': ticket,
                    'OpenTime': open_time,
                    'Type': type_str,
                    'Size': size,
                    'OpenPrice': open_price,
                    'CloseTime': close_time,
                    'ClosePrice': close_price,
                    'NetProfit': profit + commission + taxes + swap
                })
            except ValueError:
                continue

    df = pd.DataFrame(completed_trades)
    if not df.empty:
        # MT4の日付フォーマット YYYY.MM.DD HH:MM
        df['OpenTime'] = pd.to_datetime(df['OpenTime'].str.replace('.', '-'), errors='coerce')
        df['CloseTime'] = pd.to_datetime(df['CloseTime'].str.replace('.', '-'), errors='coerce')
        df = df.dropna(subset=['OpenTime', 'CloseTime'])
        
    return df, ea_name, report_dd_val, report_dd_pct, initial_deposit, symbol, period
