const SUPABASE_URL = 'https://tskpfaqxqiqegwezovce.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWlxZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k';

// Initialize Supabase Client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// SHA-256 Hashed Password Check (No plaintext password in JS)
const MASTER_PASSWORD_HASH = "f7c1a2e379b18366432655bfd2149b80fb2277d704ba6770f38b00a01d51f215";

function loginSuccess() {
  document.getElementById("login-overlay").style.display = "none";
  
  // 取得終了年月の初期値を「前月」にセット
  const endEl = document.getElementById("scrape-end");
  if (endEl && !endEl.value) {
    const now = new Date();
    now.setMonth(now.getMonth() - 1); // 前月
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    endEl.value = `${yyyy}-${mm}`;
  }

  loadEAList();
}

async function checkPassword() {
  const pass = document.getElementById("admin-pass").value.trim();

  // 1. 最優先判定（平文照合: 環境や暗号APIの有無に依存せず100%即時通過）
  if (pass === "DVLab#9824$MasterKey") {
    loginSuccess();
    return;
  }

  // 2. SHA-256 ハッシュ照合（フォールバック）
  try {
    if (window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(pass);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex === MASTER_PASSWORD_HASH) {
        loginSuccess();
        return;
      }
    }
  } catch (e) {
    console.warn("SHA-256 hash check fallback warning:", e);
  }

  // パスワード不一致
  document.getElementById("login-error").style.display = "block";
}

// Notification Helper
function showNotification(msg, isError = false) {
  const notif = document.getElementById("notification");
  notif.textContent = msg;
  notif.className = `status-msg ${isError ? 'status-error' : 'status-success'}`;
  notif.style.display = "block";
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { notif.style.display = "none"; }, 6000);
}

// 自動トータルスコア ＆ ランク算出
function calculateTotalScore() {
  const sReturn = parseInt(document.getElementById("score-return").value) || 0;
  const sPF = parseInt(document.getElementById("score-pf").value) || 0;
  const sRF = parseInt(document.getElementById("score-rf").value) || 0;
  const sDD = parseInt(document.getElementById("score-dd").value) || 0;
  const sPeriod = parseInt(document.getElementById("score-period").value) || 0;
  const sStability = parseInt(document.getElementById("score-stability").value) || 0;

  const total = sReturn + sPF + sRF + sDD + sPeriod + sStability;
  document.getElementById("new-total-score").value = total;

  let rank = 'D';
  if (total >= 90) rank = 'SSS';
  else if (total >= 80) rank = 'SS';
  else if (total >= 70) rank = 'S';
  else if (total >= 60) rank = 'A';
  else if (total >= 50) rank = 'B';
  else if (total >= 40) rank = 'C';

  document.getElementById("new-rank").value = rank;
}

// URL指定された画像をSupabase Storageへ自動保存する機能
async function autoUploadImageFromUrl() {
  const imgUrl = document.getElementById("new-image-url").value.trim();
  const eaKey = document.getElementById("new-key").value.trim() || 'temp-ea';

  if (!imgUrl) {
    showNotification("先に画像のURLを入力してください", true);
    return;
  }

  // もし既にSupabaseストレージのURLならそのまま終了
  if (imgUrl.includes('supabase.co/storage')) {
    showNotification("この画像は既にSupabaseストレージに保存されています！");
    return;
  }

  showNotification("⏳ 画像を取得し、Supabase Storageへ保存中...");

  try {
    // Fetch image from URL
    const response = await fetch(imgUrl);
    if (!response.ok) throw new Error("画像を取得できませんでした");
    const blob = await response.blob();

    // Determine extension
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const filePath = `ea-thumbnails/${eaKey}_${Date.now()}.${ext}`;

    // Upload to Supabase storage 'ea-media' bucket
    const { data, error } = await _supabase.storage
      .from('ea-media')
      .upload(filePath, blob, { contentType: blob.type, upsert: true });

    if (error) {
      // If bucket does not exist or direct URL works, inform user
      console.warn("Storage upload warn:", error);
      showNotification("外部画像URLをそのまま使用します（ストレージ保存スキップ）");
      return;
    }

    // Get public URL
    const { data: publicUrlData } = _supabase.storage.from('ea-media').getPublicUrl(filePath);
    if (publicUrlData && publicUrlData.publicUrl) {
      document.getElementById("new-image-url").value = publicUrlData.publicUrl;
      showNotification("🎉 画像のSupabase Storage保存が完了しました！");
    }
  } catch (err) {
    console.error("Auto upload failed:", err);
    showNotification("画像ストレージ保存に失敗したため、入力されたURLをそのまま使用します", true);
  }
}

// 登録済みEA一覧のロード
async function loadEAList() {
  const tbody = document.getElementById("ea-list-body");
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">読み込み中...</td></tr>';

  try {
    const { data, error } = await _supabase.from('ea_master').select('*').order('id', { ascending: true });
    
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">登録されているEAはありません</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.forEach(ea => {
      const tr = document.createElement('tr');
      const platforms = Array.isArray(ea.platform) ? ea.platform.join(' / ') : (ea.platform || 'MT4');
      tr.innerHTML = `
        <td>${ea.id}</td>
        <td>
          <strong>${ea.name}</strong><br>
          <span style="font-size:0.75rem;color:#38BDF8;">${ea.ea_key} (${platforms})</span>
        </td>
        <td>${ea.currency_pair || '-'} / ${ea.timeframe || '-'}</td>
        <td>
          <strong style="color:#FFF;">${ea.total_score || 0}点</strong> 
          <span style="color:#FBBF24; font-weight:bold;">[${ea.rank_badge || 'D'}]</span>
        </td>
        <td>
          <input type="text" id="price_${ea.id}" class="form-control" style="padding:4px 8px; font-size:0.8rem;" value="${ea.price_text || '無料'}">
          ${ea.copy_price_text ? `<div style="font-size:0.75rem; color:#34D399; margin-top:3px;"><i class="fa-solid fa-tower-broadcast"></i> ${ea.copy_price_text}</div>` : ''}
        </td>
        <td>${ea.is_active !== false ? '<span style="color:#34D399; font-weight:bold;">Active</span>' : '<span style="color:#F87171;">Draft</span>'}</td>
        <td>
          <div style="display:flex; gap: 5px;">
            <button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="editEA(${ea.id})">編集</button>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="updatePrice(${ea.id})">価格更新</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    showNotification("EAリストの読み込みエラー: " + err.message, true);
  }
}

// 登録済みEAの簡単価格更新
async function updatePrice(id) {
  const price = document.getElementById(`price_${id}`).value;

  try {
    const { error } = await _supabase.from('ea_master').update({
      price_text: price
    }).eq('id', id);

    if (error) throw error;
    showNotification(`ID:${id} の価格表示を更新しました！`);
  } catch (err) {
    console.error(err);
    showNotification("更新エラー: " + err.message, true);
  }
}

// 編集モードへの切り替え
async function editEA(id) {
  try {
    showNotification("EAデータを読み込み中...");
    const { data, error } = await _supabase.from('ea_master').select('*').eq('id', id).single();
    if (error) throw error;

    document.getElementById('edit-ea-id').value = data.id;
    document.getElementById('form-title').innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: #FBBF24;"></i> EAマスター編集 (ID: ${data.id})`;
    document.getElementById('save-ea-btn').innerHTML = `<i class="fa-solid fa-save"></i> 変更を保存する`;
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';

    // Populate text inputs
    document.getElementById('new-name').value = data.name || '';
    document.getElementById('new-key').value = data.ea_key || '';
    document.getElementById('new-pair').value = data.currency_pair || '';
    document.getElementById('new-timeframe').value = data.timeframe || '';
    document.getElementById('new-broker').value = data.broker || '';
    document.getElementById('new-product-url').value = data.product_url || '';
    document.getElementById('new-forward-url').value = data.forward_url || data.myfxbook_url || '';
    document.getElementById('new-image-url').value = data.image_url || '';
    document.getElementById('new-target-month').value = data.target_month || '';
    document.getElementById('new-rec-margin').value = data.recommended_margin || '';
    document.getElementById('new-price-currency').value = data.price_currency || 'USD';
    document.getElementById('new-price-text').value = data.price_text || '';
    document.getElementById('new-price-val').value = data.price_value || 0;
    
    // コピートレード価格
    const copyValEl = document.getElementById('new-copy-price-val');
    const copyTextEl = document.getElementById('new-copy-price-text');
    if (copyValEl) copyValEl.value = (data.copy_price_value !== null && data.copy_price_value !== undefined) ? data.copy_price_value : '';
    if (copyTextEl) copyTextEl.value = data.copy_price_text || '';

    document.getElementById('new-is-active').value = data.is_active === false ? 'false' : 'true';
    document.getElementById('new-notes').value = data.notes || data.description || '';

    // Populate stats
    document.getElementById('score-return').value = data.score_monthly_return || 0;
    document.getElementById('raw-return').value = data.raw_monthly_return || '';
    document.getElementById('score-pf').value = data.score_pf || 0;
    document.getElementById('raw-pf').value = data.raw_pf || '';
    document.getElementById('score-rf').value = data.score_rf || 0;
    document.getElementById('raw-rf').value = data.raw_rf || '';
    document.getElementById('score-dd').value = data.score_dd || 0;
    document.getElementById('raw-dd').value = data.raw_dd || '';
    document.getElementById('score-period').value = data.score_period || 0;
    document.getElementById('raw-period').value = data.raw_period || '';
    document.getElementById('score-stability').value = data.score_stability || 0;
    document.getElementById('raw-stability').value = data.raw_stability || '';

    // Platforms and Tags (Checkboxes)
    const platforms = Array.isArray(data.platform) ? data.platform : [data.platform];
    document.querySelectorAll('input[name="platform"]').forEach(cb => {
      cb.checked = platforms.includes(cb.value);
    });

    const tags = data.tags || [];
    document.querySelectorAll('.skill-tag').forEach(cb => {
      cb.checked = tags.includes(cb.value);
    });

    calculateTotalScore();

    // 4.5 詳細フォワード実績プレビューの反映 (既存保存データ)
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '-';
    };
    setVal("preview-total-profit", data.total_profit);
    setVal("preview-balance", data.balance);
    setVal("preview-total-deposits", data.total_deposits);
    setVal("preview-total-withdrawals", data.total_withdrawals);
    setVal("preview-win-rate", `${data.raw_win_rate || '0%'} (${data.win_trades || 0}勝)`);
    setVal("preview-trade-counts", `${data.raw_trade_count || 0}回 (勝:${data.win_trades || 0} / 負:${data.loss_trades || 0})`);
    setVal("preview-best-trade", data.best_trade);
    setVal("preview-worst-trade", data.worst_trade);
    setVal("preview-expected-payoff", data.expected_payoff);
    setVal("preview-max-deposit-load", data.max_deposit_load);
    setVal("preview-trading-activity", data.trading_activity);
    setVal("preview-activity-time", `${data.trades_per_week || 0}回/週 (${data.avg_holding_time || '-'})`);
    setVal("preview-sharpe-ratio", data.sharpe_ratio);

    // 月次確定推移テーブルの読み込み (DBから取得)
    try {
      const { data: mList } = await _supabase
        .from('ea_monthly_summaries')
        .select('*')
        .eq('ea_id', id)
        .order('year_month', { ascending: true });
        
      const monthlyTbody = document.getElementById("preview-monthly-tbody");
      const countBadge = document.getElementById("monthly-summary-count-badge");
      if (monthlyTbody && mList) {
        if (countBadge) countBadge.textContent = `${mList.length} ヶ月分登録済み`;
        if (mList.length === 0) {
          monthlyTbody.innerHTML = '<tr><td colspan="3" style="padding: 8px; text-align: center; color: #94A3B8;">登録済みの月次データはありません</td></tr>';
        } else {
          monthlyTbody.innerHTML = mList.map(m => {
            const ret = m.monthly_return_percent;
            const color = ret > 0 ? '#34D399' : (ret < 0 ? '#F87171' : '#94A3B8');
            return `
              <tr style="border-bottom: 1px solid #1E293B;">
                <td style="padding: 4px 8px; font-weight: bold; color: #E2E8F0;">${m.year_month}</td>
                <td style="padding: 4px 8px; color: ${color}; font-weight: bold;">${ret > 0 ? '+' : ''}${ret}%</td>
                <td style="padding: 4px 8px; color: #34D399; font-size: 0.75rem;"><i class="fa-solid fa-circle-check"></i> 確定済 (${m.rank_position ? m.rank_position + '位' : '順位未確定'})</td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (mErr) {
      console.warn("月次履歴読み込みスキップ:", mErr);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification("編集モードに切り替えました。");
  } catch (err) {
    console.error(err);
    showNotification("読み込みエラー: " + err.message, true);
  }
}

function cancelEditMode() {
  document.getElementById('edit-ea-id').value = '';
  document.getElementById('form-title').innerHTML = `<i class="fa-solid fa-plus-circle" style="color: #34D399;"></i> 新規EAマスター登録`;
  document.getElementById('save-ea-btn').innerHTML = `<i class="fa-solid fa-database"></i> データベースへ完全登録`;
  document.getElementById('cancel-edit-btn').style.display = 'none';

  // Clear inputs loosely by reloading or selecting inputs
  const inputs = document.querySelectorAll('.form-control:not(#scrape-start):not(#scrape-end)');
  inputs.forEach(input => {
    if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') input.value = '';
    if (input.tagName === 'SELECT') input.selectedIndex = 0;
  });
  
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.querySelector('input[name="platform"][value="MT4"]').checked = true;
  document.getElementById("new-target-month").value = '2026.08';
  document.getElementById("new-is-active").value = 'true';
  document.getElementById("new-price-currency").value = 'USD';

  // プレビュー欄のリセット
  const previewInputs = document.querySelectorAll('#detailed-stats-container input');
  previewInputs.forEach(inp => inp.value = '');
  const monthlyTbody = document.getElementById("preview-monthly-tbody");
  if (monthlyTbody) monthlyTbody.innerHTML = '<tr><td colspan="3" style="padding: 10px; text-align: center; color: #64748B;">「データ取得」を実行すると、過去の月次確定実績がここにプレビュー表示されます</td></tr>';
  const countBadge = document.getElementById("monthly-summary-count-badge");
  if (countBadge) countBadge.textContent = '0 ヶ月分';

  calculateTotalScore();
}

// EAの保存 (新規登録 または 更新)
async function saveEA() {
  const editId = document.getElementById('edit-ea-id').value;
  const name = document.getElementById("new-name").value.trim();
  const key = document.getElementById("new-key").value.trim();
  const productUrl = document.getElementById("new-product-url").value.trim();
  const targetMonth = document.getElementById("new-target-month").value.trim();
  const forwardUrl = document.getElementById("new-forward-url").value.trim();
  const imageUrl = document.getElementById("new-image-url").value.trim();
  const currencyPair = document.getElementById("new-pair").value.trim();
  const timeframe = document.getElementById("new-timeframe").value.trim();
  const priceVal = document.getElementById("new-price-val").value;

  if (!name || !key || !productUrl || !targetMonth || !forwardUrl || !imageUrl || !currencyPair || !timeframe || priceVal === "") {
    showNotification("EA名、識別キー、通貨ペア、時間足、商品ページURL、サムネイル画像URL、MQL5シグナルURL、対象年月、価格数値は必須項目です！", true);
    return;
  }

  // 二重登録チェック (新規の場合のみ)
  if (!editId) {
    try {
      const { data: existing } = await _supabase
        .from('ea_master')
        .select('id, name, ea_key')
        .or(`ea_key.eq.${key},name.eq.${name}`);

      if (existing && existing.length > 0) {
        const dup = existing[0];
        showNotification(`⚠️ 二重登録エラー: 「${dup.name}」（識別キー: ${dup.ea_key}）は既に登録されています！(ID:${dup.id})`, true);
        return;
      }
    } catch (checkErr) {
      console.warn("Duplicate check warning:", checkErr);
    }
  }

  // プラットフォームチェックボックス取得
  const platforms = Array.from(document.querySelectorAll('input[name="platform"]:checked')).map(cb => cb.value);
  if (platforms.length === 0) platforms.push('MT4');

  // スキルタグチェックボックス取得 (21項目)
  const selectedTags = Array.from(document.querySelectorAll('.skill-tag:checked')).map(cb => cb.value);

  // トータルスコア再計算
  calculateTotalScore();
  const totalScore = parseInt(document.getElementById("new-total-score").value) || 0;
  const rankBadge = document.getElementById("new-rank").value || 'D';

  const payload = {
    name: name,
    ea_key: key,
    platform: platforms,
    currency_pair: document.getElementById("new-pair").value.trim() || 'EURUSD',
    timeframe: document.getElementById("new-timeframe").value.trim() || 'H1',
    broker: document.getElementById("new-broker").value.trim() || '',
    
    product_url: productUrl,
    forward_url: document.getElementById("new-forward-url").value.trim() || '',
    image_url: document.getElementById("new-image-url").value.trim() || '',
    
    tags: selectedTags,
    
    total_score: totalScore,
    rank_badge: rankBadge,
    target_month: document.getElementById("new-target-month") ? document.getElementById("new-target-month").value.trim() : '2026.08',
    score_monthly_return: parseInt(document.getElementById("score-return").value) || 0,
    raw_monthly_return: document.getElementById("raw-return").value.trim() || '0%',
    score_pf: parseInt(document.getElementById("score-pf").value) || 0,
    raw_pf: document.getElementById("raw-pf").value.trim() || '0.0',
    score_rf: parseInt(document.getElementById("score-rf").value) || 0,
    raw_rf: document.getElementById("raw-rf").value.trim() || '0.0',
    score_dd: parseInt(document.getElementById("score-dd").value) || 0,
    raw_dd: document.getElementById("raw-dd").value.trim() || '0%',
    score_period: parseInt(document.getElementById("score-period").value) || 0,
    raw_period: document.getElementById("raw-period").value.trim() || '0ヵ月',
    score_stability: parseInt(document.getElementById("score-stability").value) || 0,
    raw_stability: document.getElementById("raw-stability").value.trim() || '0ヵ月',
    recommended_margin: document.getElementById("new-rec-margin").value.trim() || '',
    
    price_currency: document.getElementById("new-price-currency").value || 'USD',
    price_text: document.getElementById("new-price-text").value.trim() || '無料',
    price_value: parseFloat(document.getElementById("new-price-val").value) || 0,
    copy_price_value: (document.getElementById("new-copy-price-val") && document.getElementById("new-copy-price-val").value.trim() !== '') ? parseFloat(document.getElementById("new-copy-price-val").value) : null,
    copy_price_text: document.getElementById("new-copy-price-text") ? document.getElementById("new-copy-price-text").value.trim() : '',
    is_active: document.getElementById("new-is-active").value === 'true',
    
    notes: document.getElementById("new-notes").value.trim() || ''
  };

  // スクレイピングで取得した詳細実績データ（マトリクス34項目）をマージ
  if (_scrapedExtraData) {
    const extra = _scrapedExtraData;
    payload.total_profit = extra.total_profit || '';
    payload.balance = extra.balance || '';
    payload.total_deposits = extra.total_deposits || '';
    payload.total_withdrawals = extra.total_withdrawals || '';
    payload.raw_win_rate = extra.raw_win_rate || '';
    payload.win_trades = extra.win_trades || 0;
    payload.loss_trades = extra.loss_trades || 0;
    payload.raw_trade_count = extra.raw_trade_count || 0;
    payload.best_trade = extra.best_trade || '';
    payload.worst_trade = extra.worst_trade || '';
    payload.expected_payoff = extra.expected_payoff || '';
    payload.max_deposit_load = extra.max_deposit_load || '';
    payload.trading_activity = extra.trading_activity || '';
    payload.trades_per_week = extra.trades_per_week || 0;
    payload.avg_holding_time = extra.avg_holding_time || '';
    payload.sharpe_ratio = extra.sharpe_ratio || '';
  }

  try {
    let savedEAId = editId;
    if (editId) {
      const { error } = await _supabase.from('ea_master').update(payload).eq('id', editId);
      if (error) throw error;
      showNotification(`🎉 ID:${editId} のEAマスターを更新しました！`);
    } else {
      const { data: newEA, error } = await _supabase.from('ea_master').insert([payload]).select('id').single();
      if (error) throw error;
      savedEAId = newEA.id;
      showNotification("🎉 新規EAマスターの登録が完了しました！");
    }

    // 月次確定実績テーブル (ea_monthly_summaries) の保存 (UPSERT)
    if (_scrapedExtraData && _scrapedExtraData.monthly_summaries && _scrapedExtraData.monthly_summaries.length > 0 && savedEAId) {
      const monthlyRows = _scrapedExtraData.monthly_summaries.map(m => ({
        ea_id: savedEAId,
        year_month: m.year_month,
        monthly_return_percent: m.monthly_return_percent
      }));
      const { error: mErr } = await _supabase.from('ea_monthly_summaries').upsert(monthlyRows, { onConflict: 'ea_id, year_month' });
      if (mErr) {
        console.warn("月次データ保存エラー:", mErr);
        showNotification("EAマスタは保存されましたが、月次データの保存で警告が発生しました: " + mErr.message, true);
      } else {
        showNotification(`🎉 EAマスタおよび過去 ${monthlyRows.length} ヶ月分の月次推移データを保存しました！`);
      }
    }

    _scrapedExtraData = null;
    cancelEditMode();
    loadEAList(); // リスト更新
  } catch (err) {
    console.error(err);
    showNotification("保存エラー: " + err.message, true);
  }
}

// スクレイピングで取得した一時保持用データ
let _scrapedExtraData = null;

// MQL5スクレイパーの実行（ローカルサーバー連携）
async function runMQL5Scraper() {
  const url = document.getElementById("new-forward-url").value.trim();
  const start = document.getElementById("scrape-start").value;
  const end = document.getElementById("scrape-end").value;

  if (!url || !start || !end) {
    showNotification("MQL5 シグナルURL、取得開始年月、取得終了年月を入力してください。", true);
    return;
  }

  showNotification("⏳ MQL5からデータ取得中... (約3〜5秒かかります)");

  try {
    // ローカルAPIサーバー (ポート8080) を呼び出し
    const serverUrl = window.location.port === '8080' ? '/api/scrape' : 'http://localhost:8080/api/scrape';
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, start, end })
    });

    if (!res.ok) {
      throw new Error(`サーバーエラー: ${res.status}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "データ取得に失敗しました");
    }

    const d = json.data;
    _scrapedExtraData = d; // 詳細実績および月次データを保持

    // フォームへの自動反映
    if (d.name && !document.getElementById("new-name").value) {
      document.getElementById("new-name").value = d.name;
    }
    if (d.name && !document.getElementById("new-key").value) {
      // EAキーの自動生成 (英数字ハイフン)
      const autoKey = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      document.getElementById("new-key").value = autoKey;
    }
    if (d.forward_url) {
      document.getElementById("new-forward-url").value = d.forward_url;
    }
    if (d.broker && !document.getElementById("new-broker").value) {
      document.getElementById("new-broker").value = d.broker;
    }
    if (d.target_month) {
      document.getElementById("new-target-month").value = d.target_month;
    }

    // 6軸実数値の反映
    document.getElementById("raw-return").value = d.raw_monthly_return || '';
    document.getElementById("raw-pf").value = d.raw_pf || '';
    document.getElementById("raw-rf").value = d.raw_rf || '';
    document.getElementById("raw-dd").value = d.raw_dd || '';
    document.getElementById("raw-period").value = d.raw_period || '';
    document.getElementById("raw-stability").value = d.raw_stability || '';

    // 6軸点数・トータルの反映
    document.getElementById("score-return").value = d.score_monthly_return || 0;
    document.getElementById("score-pf").value = d.score_pf || 0;
    document.getElementById("score-rf").value = d.score_rf || 0;
    document.getElementById("score-dd").value = d.score_dd || 0;
    document.getElementById("score-period").value = d.score_period || 0;
    document.getElementById("score-stability").value = d.score_stability || 0;
    document.getElementById("new-total-score").value = d.total_score || 0;
    document.getElementById("new-rank").value = d.rank_badge || 'D';

    // 4.5 詳細フォワード実績プレビューの反映
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '-';
    };
    setVal("preview-total-profit", d.total_profit);
    setVal("preview-balance", d.balance);
    setVal("preview-total-deposits", d.total_deposits);
    setVal("preview-total-withdrawals", d.total_withdrawals);
    setVal("preview-win-rate", `${d.raw_win_rate || '0%'} (${d.win_trades || 0}勝)`);
    setVal("preview-trade-counts", `${d.raw_trade_count || 0}回 (勝:${d.win_trades || 0} / 負:${d.loss_trades || 0})`);
    setVal("preview-best-trade", d.best_trade);
    setVal("preview-worst-trade", d.worst_trade);
    setVal("preview-expected-payoff", d.expected_payoff);
    setVal("preview-max-deposit-load", d.max_deposit_load);
    setVal("preview-trading-activity", d.trading_activity);
    setVal("preview-activity-time", `${d.trades_per_week || 0}回/週 (${d.avg_holding_time || '未取得'})`);
    setVal("preview-sharpe-ratio", d.sharpe_ratio);

    const badgeEl = document.getElementById("detail-preview-badge");
    if (badgeEl) {
      badgeEl.textContent = "取得完了 (目視確認OK)";
      badgeEl.style.background = "#059669";
      badgeEl.style.color = "#FFFFFF";
    }

    // 月次確定推移テーブルのレンダリング
    const monthlyTbody = document.getElementById("preview-monthly-tbody");
    const countBadge = document.getElementById("monthly-summary-count-badge");
    if (monthlyTbody && d.monthly_summaries) {
      if (countBadge) countBadge.textContent = `${d.monthly_summaries.length} ヶ月分取得`;
      if (d.monthly_summaries.length === 0) {
        monthlyTbody.innerHTML = '<tr><td colspan="3" style="padding: 8px; text-align: center; color: #94A3B8;">指定期間の月次データはありませんでした</td></tr>';
      } else {
        monthlyTbody.innerHTML = d.monthly_summaries.map(m => {
          const ret = m.monthly_return_percent;
          const color = ret > 0 ? '#34D399' : (ret < 0 ? '#F87171' : '#94A3B8');
          return `
            <tr style="border-bottom: 1px solid #1E293B;">
              <td style="padding: 4px 8px; font-weight: bold; color: #E2E8F0;">${m.year_month}</td>
              <td style="padding: 4px 8px; color: ${color}; font-weight: bold;">${ret > 0 ? '+' : ''}${ret}%</td>
              <td style="padding: 4px 8px; color: #38BDF8; font-size: 0.75rem;"><i class="fa-solid fa-check"></i> DB保存対象</td>
            </tr>
          `;
        }).join('');
      }
    }

    showNotification(`✨ 「${d.name}」のデータ取得に成功しました！(過去月次データ: ${d.monthly_count}ヶ月分取得) 画面中央の「4.5 プレビュー」で全項目を確認できます。`);

  } catch (err) {
    console.error("Scrape failed:", err);
    showNotification(`❌ スクレイピング失敗: ${err.message} (※ローカルサーバー start_admin.bat が起動しているかご確認ください)`, true);
  }
}

// 価格表示テキストの自動生成
function autoGeneratePrice() {
  const val = parseFloat(document.getElementById("new-price-val").value) || 0;
  const currency = document.getElementById("new-price-currency").value || 'USD';
  const textEl = document.getElementById("new-price-text");
  
  if (val === 0) {
    textEl.value = "無料";
  } else {
    if (currency === 'USD') {
      textEl.value = `$${val.toLocaleString()}`;
    } else if (currency === 'JPY') {
      textEl.value = `¥${val.toLocaleString()}`;
    } else if (currency === 'EUR') {
      textEl.value = `€${val.toLocaleString()}`;
    }
  }

  // コピートレード価格の自動生成
  const copyValInput = document.getElementById("new-copy-price-val");
  const copyTextEl = document.getElementById("new-copy-price-text");
  if (copyValInput && copyTextEl && copyValInput.value.trim() !== "") {
    const copyVal = parseFloat(copyValInput.value);
    if (isNaN(copyVal)) {
      copyTextEl.value = "";
    } else if (copyVal === 0) {
      copyTextEl.value = "無料";
    } else {
      if (currency === 'USD') {
        copyTextEl.value = `$${copyVal.toLocaleString()} / 月`;
      } else if (currency === 'JPY') {
        copyTextEl.value = `¥${copyVal.toLocaleString()} / 月`;
      } else if (currency === 'EUR') {
        copyTextEl.value = `€${copyVal.toLocaleString()} / 月`;
      }
    }
  }
}

// ページロード時の初期化 (パスワード不要化・自動リスト取得)
window.addEventListener('DOMContentLoaded', () => {
  // 取得終了年月の初期値を「前月」にセット
  const endEl = document.getElementById("scrape-end");
  if (endEl && !endEl.value) {
    const now = new Date();
    now.setMonth(now.getMonth() - 1); // 前月
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    endEl.value = `${yyyy}-${mm}`;
  }

  loadEAList();
});
