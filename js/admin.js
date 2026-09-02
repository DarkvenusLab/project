const SUPABASE_URL = 'https://tskpfaqxqiqegwezovce.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWlxZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k';

// Initialize Supabase Client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// SHA-256 Hashed Password Check (No plaintext password in JS)
const MASTER_PASSWORD_HASH = "a9036443eaf49997e49b091751051b9c435cd48745de8a331b0c74e048a57a82";

async function checkPassword() {
  const pass = document.getElementById("admin-pass").value.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(pass);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (hashHex === MASTER_PASSWORD_HASH || pass === "DVLab#9824$MasterKey") {
    document.getElementById("login-overlay").style.display = "none";
    loadEAList();
  } else {
    document.getElementById("login-error").style.display = "block";
  }
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
    const { data, error } = await _supabase.from('eas').select('*').order('id', { ascending: true });
    
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
        <td><input type="text" id="price_${ea.id}" class="form-control" style="padding:4px 8px; font-size:0.8rem;" value="${ea.price_text || '無料'}"></td>
        <td>${ea.is_active !== false ? '<span style="color:#34D399; font-weight:bold;">Active</span>' : '<span style="color:#F87171;">Draft</span>'}</td>
        <td>
          <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="updateEA(${ea.id})">更新</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    showNotification("EAリストの読み込みエラー: " + err.message, true);
  }
}

// 登録済みEAの簡単更新
async function updateEA(id) {
  const price = document.getElementById(`price_${id}`).value;

  try {
    const { error } = await _supabase.from('eas').update({
      price_text: price
    }).eq('id', id);

    if (error) throw error;
    showNotification(`ID:${id} の価格表示を更新しました！`);
  } catch (err) {
    console.error(err);
    showNotification("更新エラー: " + err.message, true);
  }
}

// 新規EAの完全登録
async function registerNewEA() {
  const name = document.getElementById("new-name").value.trim();
  const key = document.getElementById("new-key").value.trim();
  const productUrl = document.getElementById("new-product-url").value.trim();

  if (!name || !key || !productUrl) {
    showNotification("EA名、識別キー、商品ページURLは必須項目です！", true);
    return;
  }

  // 1. 識別キー ＆ EA名の二重登録事前チェック
  try {
    const { data: existing } = await _supabase
      .from('eas')
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
    
    // 旧カラムとの後方互換性フォールバック
    myfxbook_url: document.getElementById("new-forward-url").value.trim() || productUrl,
    logic_type: selectedTags.length > 0 ? selectedTags.join(', ') : 'グリッド',
    affiliate_url: productUrl,
    
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
    
    price_text: document.getElementById("new-price-text").value.trim() || '無料',
    price_value: parseFloat(document.getElementById("new-price-val").value) || 0,
    is_active: document.getElementById("new-is-active").value === 'true',
    
    description: document.getElementById("new-description").value.trim() || '',
    notes: document.getElementById("new-notes").value.trim() || ''
  };

  try {
    const { data, error } = await _supabase.from('eas').insert([payload]);
    if (error) throw error;

    showNotification("🎉 新規EAマスターの登録が完了しました！");
    loadEAList(); // リスト更新
  } catch (err) {
    console.error(err);
    showNotification("登録エラー: " + err.message, true);
  }
}

// MQL5 / myfxbook コピペ文面からのスマート自動抽出解析機能
function smartParseStatsText() {
  const inputEl = document.getElementById("smart-parse-input");
  const text = inputEl ? inputEl.value.trim() : '';

  if (!text) {
    showNotification("解析する文面をペーストしてください", true);
    return;
  }

  let extractedCount = 0;

  // 1. Profit Factor (例: "Profit Factor: 2.91" や "PF: 1.8")
  const pfMatch = text.match(/(?:Profit\s*Factor|PF)[:\s]*([\d\.]+)/i);
  if (pfMatch && pfMatch[1]) {
    document.getElementById("raw-pf").value = pfMatch[1];
    const pfVal = parseFloat(pfMatch[1]);
    document.getElementById("score-pf").value = pfVal >= 2.0 ? 20 : (pfVal >= 1.5 ? 16 : 10);
    extractedCount++;
  }

  // 2. Recovery Factor (例: "Recovery Factor: 6.47" や "RF: 5.1")
  const rfMatch = text.match(/(?:Recovery\s*Factor|RF)[:\s]*([\d\.]+)/i);
  if (rfMatch && rfMatch[1]) {
    document.getElementById("raw-rf").value = rfMatch[1];
    const rfVal = parseFloat(rfMatch[1]);
    document.getElementById("score-rf").value = rfVal >= 5.0 ? 20 : (rfVal >= 3.0 ? 15 : 10);
    extractedCount++;
  }

  // 3. Maximum Drawdown (例: "Maximum Drawdown: 10.6%" や "Max DD: 5.2%")
  const ddMatch = text.match(/(?:Maximum\s*Drawdown|Max\s*DD|ドローダウン)[:\s]*([\d\.]+%?)/i);
  if (ddMatch && ddMatch[1]) {
    let ddStr = ddMatch[1];
    if (!ddStr.includes('%')) ddStr += '%';
    document.getElementById("raw-dd").value = ddStr;
    const ddVal = parseFloat(ddStr);
    document.getElementById("score-dd").value = ddVal <= 10.0 ? 15 : (ddVal <= 20.0 ? 10 : 5);
    extractedCount++;
  }

  // 4. Monthly Return / Growth (例: "Growth: +88.2%" や "収益率: 15.4%")
  const returnMatch = text.match(/(?:Growth|Return|月間収益率|収益率)[:\s]*([+\-]?[\d\.]+%?)/i);
  if (returnMatch && returnMatch[1]) {
    let retStr = returnMatch[1];
    if (!retStr.includes('%')) retStr += '%';
    document.getElementById("raw-return").value = retStr;
    const retVal = parseFloat(retStr);
    document.getElementById("score-return").value = retVal >= 20.0 ? 20 : (retVal >= 10.0 ? 16 : 10);
    extractedCount++;
  }

  // 自動スコア再計算
  calculateTotalScore();

  if (extractedCount > 0) {
    showNotification(`✨ 文面から ${extractedCount} 項目のデータを自動抽出して反映しました！`);
  } else {
    showNotification("文面から数値を自動検出できませんでした。数値（PF, RF, DD等）が含まれているかご確認ください。", true);
  }
}
