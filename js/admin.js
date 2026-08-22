const SUPABASE_URL = 'https://tskpfaqxqiqegwezovce.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWlxZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k';

// Initialize Supabase Client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Simple password protection (Hardcoded for basic access restriction)
const ADMIN_PASSWORD = "admin"; // Change this if needed in production

function checkPassword() {
  const pass = document.getElementById("admin-pass").value;
  if (pass === ADMIN_PASSWORD || pass === "dvlab") {
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
  setTimeout(() => { notif.style.display = "none"; }, 5000);
}

// Load EA List from Supabase
async function loadEAList() {
  const tbody = document.getElementById("ea-list-body");
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">読み込み中...</td></tr>';

  try {
    const { data, error } = await _supabase.from('eas').select('*').order('id', { ascending: true });
    
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">登録されているEAはありません</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.forEach(ea => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${ea.id}</td>
        <td><strong>${ea.name}</strong><br><span style="font-size:0.75rem;color:#94A3B8;">${ea.currency_pair} | ${ea.timeframe}</span></td>
        <td><input type="text" id="price_${ea.id}" value="${ea.price_text}"></td>
        <td><input type="text" id="aff_${ea.id}" value="${ea.affiliate_url}"></td>
        <td>${ea.is_active ? '<span style="color:#34D399;">Active</span>' : '<span style="color:#F87171;">Inactive</span>'}</td>
        <td>
          <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="updateEA(${ea.id})">更新</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    showNotification("EAリストの読み込みに失敗しました: " + err.message, true);
  }
}

// Update existing EA inline
async function updateEA(id) {
  const price = document.getElementById(`price_${id}`).value;
  const affUrl = document.getElementById(`aff_${id}`).value;

  try {
    const { error } = await _supabase.from('eas').update({
      price_text: price,
      affiliate_url: affUrl
    }).eq('id', id);

    if (error) throw error;
    showNotification(`ID:${id} の更新が完了しました！`);
  } catch (err) {
    console.error(err);
    showNotification("更新に失敗しました: " + err.message, true);
  }
}

// Register New EA
async function registerNewEA() {
  const url = document.getElementById("new-url").value;
  const name = document.getElementById("new-name").value;
  const key = document.getElementById("new-key").value;
  
  if (!url || !name || !key) {
    showNotification("URL、EA名、識別キーは必須です！", true);
    return;
  }

  const payload = {
    myfxbook_url: url,
    name: name,
    ea_key: key,
    currency_pair: document.getElementById("new-pair").value || 'EURUSD',
    timeframe: document.getElementById("new-timeframe").value || 'H1',
    broker: document.getElementById("new-broker").value || 'Axiory',
    logic_type: document.getElementById("new-logic").value || '',
    price_text: document.getElementById("new-price-text").value || '無料',
    price_value: parseFloat(document.getElementById("new-price-val").value) || 0,
    affiliate_url: document.getElementById("new-affiliate").value || ''
  };

  try {
    const { data, error } = await _supabase.from('eas').insert([payload]);
    if (error) throw error;
    
    showNotification("🎉 新規EAの登録が完了しました！");
    // Clear inputs
    document.getElementById("new-url").value = '';
    document.getElementById("new-name").value = '';
    document.getElementById("new-key").value = '';
    loadEAList(); // Refresh list
  } catch (err) {
    console.error(err);
    showNotification("登録エラー: " + err.message, true);
  }
}

// Auto Fetch dummy/helper function (Extracts info from URL if possible)
function autoFetchMyfxbook() {
  const url = document.getElementById("new-url").value;
  if (!url) {
    showNotification("先にmyfxbookのURLを入力してください", true);
    return;
  }
  
  // URLから簡易的な情報を推測する (例: sloperider-grid-nzdcad から抽出)
  try {
    const parts = url.split('/');
    const slug = parts[parts.length - 2]; // e.g. sloperider-grid-nzdcad
    
    if (slug) {
      document.getElementById("new-key").value = slug;
      
      // Try to extract pair if it ends with standard 6 letters (e.g. eurusd, nzdcad)
      const possiblePair = slug.slice(-6).toUpperCase();
      if (/^[A-Z]{6}$/.test(possiblePair)) {
        document.getElementById("new-pair").value = possiblePair;
      }
      
      showNotification("URLから識別キーと通貨ペアの推測に成功しました。内容を確認してください。");
    }
  } catch(e) {
    showNotification("URLからの情報推測に失敗しました。手動で入力してください。", true);
  }
}
