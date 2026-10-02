const SUPABASE_URL = 'https://tskpfaqxqiqegwezovce.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWlxZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allEAs = [];
let monthlyHistoryMap = {};
let availableMonths = [];
let selectedMonth = '';
let currentSortMode = 'score';

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    fetchRankingData(),
    loadBenchmarkData()
  ]);
  
  // Sort Buttons Setup
  const sortBtns = document.querySelectorAll('.btn-sort');
  sortBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      sortBtns.forEach(b => b.classList.remove('active'));
      const targetBtn = e.target.closest('.btn-sort');
      if (targetBtn) {
        targetBtn.classList.add('active');
        const sortMode = targetBtn.getAttribute('data-sort');
        currentSortMode = sortMode;
        renderRanking(currentSortMode);
        if (typeof gtag === 'function') {
          gtag('event', 'sort_ranking', {
            sort_mode: sortMode
          });
        }
      }
    });
  });

  // Month Navigation Buttons
  const btnPrev = document.getElementById("btn-prev-month");
  const btnNext = document.getElementById("btn-next-month");
  const monthSelector = document.getElementById("month-selector");

  if (monthSelector) {
    monthSelector.addEventListener("change", (e) => {
      switchMonth(e.target.value);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      const idx = availableMonths.indexOf(selectedMonth);
      if (idx !== -1 && idx < availableMonths.length - 1) {
        switchMonth(availableMonths[idx + 1]);
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      const idx = availableMonths.indexOf(selectedMonth);
      if (idx > 0) {
        switchMonth(availableMonths[idx - 1]);
      }
    });
  }

  // ブラウザの戻る・進むボタン対応
  window.addEventListener("popstate", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramMonth = urlParams.get('month');
    if (paramMonth && availableMonths.includes(paramMonth) && paramMonth !== selectedMonth) {
      selectedMonth = paramMonth;
      updateMonthSelectorUI();
      renderRanking(currentSortMode);
    }
  });
});

function formatMonthLabel(ym) {
  if (!ym) return '';
  const parts = ym.replace('.', '-').split('-');
  if (parts.length >= 2) {
    return `${parts[0]}年${parseInt(parts[1], 10)}月度`;
  }
  return ym;
}

function switchMonth(newMonth) {
  if (!newMonth || newMonth === selectedMonth) return;
  selectedMonth = newMonth;

  // URLパラメータの同期 (リロードなし)
  const url = new URL(window.location);
  url.searchParams.set('month', selectedMonth);
  window.history.pushState({}, '', url);

  updateMonthSelectorUI();
  renderRanking(currentSortMode);

  // Google Analytics (GA4) 仮想PV & 月選択イベント送信
  if (typeof gtag === 'function') {
    gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search
    });
    gtag('event', 'select_ranking_month', {
      selected_month: selectedMonth
    });
  }
}

function updateMonthSelectorUI() {
  const monthSelector = document.getElementById("month-selector");
  if (monthSelector) {
    monthSelector.value = selectedMonth;
  }

  const headerMonthTag = document.getElementById("header-month-tag");
  if (headerMonthTag) {
    headerMonthTag.textContent = `（${formatMonthLabel(selectedMonth)}）`;
  }
  document.title = `MQL5ランキング（${formatMonthLabel(selectedMonth)}） | リアル稼働EA評価 | Dark Venus ラボ`;

  const monthStatusBadge = document.getElementById("month-status-badge");
  if (monthStatusBadge) {
    const isLatest = (selectedMonth === availableMonths[0]);
    if (isLatest) {
      monthStatusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> 最新・確定実績`;
      monthStatusBadge.style.color = '#34D399';
      monthStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      monthStatusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
    } else {
      monthStatusBadge.innerHTML = `<i class="fa-solid fa-box-archive"></i> 過去アーカイブ`;
      monthStatusBadge.style.color = '#38BDF8';
      monthStatusBadge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      monthStatusBadge.style.background = 'rgba(56, 189, 248, 0.15)';
    }
  }

  // 前月 / 次月 ボタンの活性・非活性制御
  const idx = availableMonths.indexOf(selectedMonth);
  const btnPrev = document.getElementById("btn-prev-month");
  const btnNext = document.getElementById("btn-next-month");

  if (btnPrev) btnPrev.disabled = (idx >= availableMonths.length - 1);
  if (btnNext) btnNext.disabled = (idx <= 0);
}

async function fetchRankingData() {
  try {
    const { data: eaData, error: eaErr } = await _supabase
      .from('ea_master')
      .select('*')
      .eq('is_active', true);

    if (eaErr) throw eaErr;
    allEAs = eaData || [];

    // 月次確定推移データも一括取得
    let allMonthsSet = new Set();
    allEAs.forEach(ea => {
      if (ea.target_month) {
        allMonthsSet.add(ea.target_month.replace('.', '-'));
      }
    });

    try {
      const { data: mData, error: mErr } = await _supabase
        .from('ea_monthly_summaries')
        .select('ea_id, year_month, monthly_return_percent, rank_position, profit_factor, max_drawdown_percent')
        .order('year_month', { ascending: true });

      if (!mErr && mData) {
        monthlyHistoryMap = {};
        mData.forEach(item => {
          if (!monthlyHistoryMap[item.ea_id]) {
            monthlyHistoryMap[item.ea_id] = [];
          }
          monthlyHistoryMap[item.ea_id].push(item);
          if (item.year_month) {
            allMonthsSet.add(item.year_month);
          }
        });
      }
    } catch (mErr) {
      console.warn("月次推移の取得をスキップ:", mErr);
    }

    // 利用可能な年月リストを降順ソート (新しい順)
    availableMonths = Array.from(allMonthsSet).sort((a, b) => b.localeCompare(a));
    if (availableMonths.length === 0) {
      availableMonths = ['2026-08'];
    }

    // URLパラメータから月を取得、なければ最新月
    const urlParams = new URLSearchParams(window.location.search);
    const paramMonth = urlParams.get('month');
    if (paramMonth && availableMonths.includes(paramMonth)) {
      selectedMonth = paramMonth;
    } else {
      selectedMonth = availableMonths[0];
    }

    // ドロップダウンのオプション生成
    const monthSelector = document.getElementById("month-selector");
    if (monthSelector) {
      monthSelector.innerHTML = availableMonths.map((ym, idx) => {
        const isLatest = (idx === 0);
        const label = formatMonthLabel(ym) + (isLatest ? ' (最新)' : '');
        return `<option value="${ym}">${label}</option>`;
      }).join('');
    }

    updateMonthSelectorUI();

    document.getElementById("loading-message").style.display = "none";
    document.getElementById("table-section").style.display = "block";
    
    // 初回レンダリング
    renderRanking(currentSortMode);
  } catch (error) {
    console.error("Error fetching EAs:", error);
    document.getElementById("loading-message").innerHTML = `<span style="color: #EF4444;"><i class="fa-solid fa-triangle-exclamation"></i> データの取得に失敗しました。</span>`;
  }
}

function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const match = String(val).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : 0;
}

// 累積運用期間の月数パース
function parsePeriodMonths(rawPeriod) {
  if (!rawPeriod) return 0;
  const mWeek = rawPeriod.match(/(\d+)\s*週/);
  if (mWeek) {
    const weeks = parseInt(mWeek[1], 10);
    return Math.floor(weeks * 7 / 30.4375);
  }
  const mYear = rawPeriod.match(/([\d\.]+)\s*年/);
  if (mYear) {
    return Math.floor(parseFloat(mYear[1]) * 12);
  }
  const mMonth = rawPeriod.match(/(\d+)\s*か?月/);
  if (mMonth) {
    return parseInt(mMonth[1], 10);
  }
  return 0;
}

// 2つの年月の月数差 (ymTo - ymFrom)
function getMonthDiff(ymFrom, ymTo) {
  if (!ymFrom || !ymTo) return 0;
  const [y1, m1] = ymFrom.replace('.', '-').split('-').map(Number);
  const [y2, m2] = ymTo.replace('.', '-').split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

// 稼働期間スコア自動採点 (仕様書 3.5: 15点満点)
function calcPeriodScore(months) {
  if (months >= 60) return 15;
  if (months >= 48) return 14;
  if (months >= 36) return 13;
  if (months >= 24) return 11;
  if (months >= 12) return 8;
  if (months >= 6) return 5;
  if (months >= 3) return 2;
  return 0;
}

// 稼働期間のテキスト表示
function formatPeriodText(months) {
  if (months <= 0) return '0週 (開始月)';
  const weeks = Math.round(months * 30.4375 / 7);
  if (months >= 12) {
    const yrs = (months / 12).toFixed(1);
    return `${yrs}年 (${weeks}週)`;
  }
  return `${weeks}週`;
}

// 収益安定性スコア自動採点 (仕様書 3.6: 10点満点、直近12ヶ月プラス月数)
function calcStabilityScore(winMonths) {
  if (winMonths >= 12) return 10;
  if (winMonths === 11) return 9;
  if (winMonths === 10) return 8;
  if (winMonths === 9) return 7;
  if (winMonths === 8) return 6;
  if (winMonths === 7) return 5;
  if (winMonths === 6) return 4;
  if (winMonths === 5) return 3;
  if (winMonths === 4) return 2;
  if (winMonths === 3) return 1;
  return 0;
}

// 月間収益率（%）からのスコア自動採点 (仕様書 3.1: 20点満点)
function calcMonthlyReturnScore(returnPercent) {
  const r = parseFloat(returnPercent);
  if (isNaN(r)) return 0;
  if (r >= 20.0) return 20;
  if (r >= 15.0) return 18;
  if (r >= 10.0) return 16;
  if (r >= 7.0) return 14;
  if (r >= 5.0) return 12;
  if (r >= 3.0) return 9;
  if (r >= 1.0) return 5;
  if (r >= 0.0) return 2;
  return 0; // 0%未満
}

// 総合得点（0〜100点）からの総合ランク判定 (仕様書 4: SSS〜D)
function calcRankBadge(totalScore) {
  const s = parseInt(totalScore, 10) || 0;
  if (s >= 90) return 'SSS';
  if (s >= 80) return 'SS';
  if (s >= 70) return 'S';
  if (s >= 60) return 'A';
  if (s >= 50) return 'B';
  if (s >= 40) return 'C';
  return 'D';
}

function renderRanking(sortMode) {
  const latestMonth = availableMonths[0];
  const isLatest = (selectedMonth === latestMonth);

  // 月次データが選ばれている場合、各EAの該当月実績をマッピング＆再計算（案1: その月基準）
  const targetEAs = [];
  allEAs.forEach(ea => {
    const clone = { ...ea };
    // カード表示用の年月バッジを選択月に連動
    if (selectedMonth) {
      clone.target_month = selectedMonth.replace('-', '.');
    }

    if (!isLatest) {
      // 過去月が選ばれている場合、その月の月次確定データで上書き＆スコア再計算（案1）
      const monthData = (monthlyHistoryMap[ea.id] || []).find(m => m.year_month === selectedMonth);
      if (!monthData) {
        // この月に運用実績がないEAは過去月ランキングから除外
        return;
      }
      const retVal = parseFloat(monthData.monthly_return_percent) || 0;
      clone.raw_monthly_return = (retVal >= 0 ? '+' : '') + retVal.toFixed(2) + '%';
      if (parseFloat(monthData.profit_factor) > 0) clone.raw_pf = String(monthData.profit_factor);
      if (parseFloat(monthData.max_drawdown_percent) > 0) clone.raw_dd = String(monthData.max_drawdown_percent) + '%';

      // 1. 月間収益率スコアの再計算 (20点満点)
      clone.score_monthly_return = calcMonthlyReturnScore(retVal);

      // 2. 稼働期間 (15点満点) のその月基準再計算
      const baseMonths = parsePeriodMonths(ea.raw_period);
      const diffMonths = getMonthDiff(selectedMonth, latestMonth);
      const elapsedMonths = Math.max(0, baseMonths - diffMonths);
      clone.score_period = calcPeriodScore(elapsedMonths);
      clone.raw_period = formatPeriodText(elapsedMonths);

      // 3. 収益安定性 (10点満点) のその月基準再計算（その月から遡って直近最大12ヶ月）
      const recordsUpToSelected = (monthlyHistoryMap[ea.id] || []).filter(m => m.year_month <= selectedMonth);
      const past12 = recordsUpToSelected.slice(-12);
      const winMonths = past12.filter(m => (parseFloat(m.monthly_return_percent) || 0) > 0).length;
      clone.score_stability = calcStabilityScore(winMonths);
      clone.raw_stability = `${winMonths}勝`;

      // 4. PF (20点), RF (20点), 最大DD (15点) は直近最新値（合意済み仕様）
      const fixedScores = (ea.score_pf || 0) + (ea.score_rf || 0) + (ea.score_dd || 0);

      // 5. 総合得点の再計算 (100点満点)
      clone.total_score = clone.score_monthly_return + fixedScores + clone.score_period + clone.score_stability;

      // 6. 総合ランクバッジの再計算 (SSS〜D)
      clone.rank_badge = calcRankBadge(clone.total_score);
    }
    targetEAs.push(clone);
  });

  // Sort Logic with Tie-Breaker
  const sorted = [...targetEAs].sort((a, b) => {
    if (sortMode === 'score') {
      // 1次: 総合スコア
      const diffScore = (b.total_score || 0) - (a.total_score || 0);
      if (diffScore !== 0) return diffScore;
      // 2次: 月利の実数値 (%)
      const diffReturn = parseNum(b.raw_monthly_return) - parseNum(a.raw_monthly_return);
      if (diffReturn !== 0) return diffReturn;
      // 3次: PFの実数値
      const diffPF = parseNum(b.raw_pf) - parseNum(a.raw_pf);
      if (diffPF !== 0) return diffPF;
      // 4次: 最大DDの実数値 (低い方が上位)
      return parseNum(a.raw_dd) - parseNum(b.raw_dd);
    } else if (sortMode === 'pf') {
      // 1次: PF実数値 (高い順)
      const diffPF = parseNum(b.raw_pf) - parseNum(a.raw_pf);
      if (diffPF !== 0) return diffPF;
      // 2次: 総合スコア
      return (b.total_score || 0) - (a.total_score || 0);
    } else if (sortMode === 'return') {
      // 1次: 月間収益率実数値 (高い順)
      const diffReturn = parseNum(b.raw_monthly_return) - parseNum(a.raw_monthly_return);
      if (diffReturn !== 0) return diffReturn;
      // 2次: 総合スコア
      return (b.total_score || 0) - (a.total_score || 0);
    } else if (sortMode === 'dd') {
      // 1次: DDスコア (高い順) または DD実数値 (低い順)
      const diffDDScore = (b.score_dd || 0) - (a.score_dd || 0);
      if (diffDDScore !== 0) return diffDDScore;
      const diffDD = parseNum(a.raw_dd) - parseNum(b.raw_dd);
      if (diffDD !== 0) return diffDD;
      return (b.total_score || 0) - (a.total_score || 0);
    }
    return 0;
  });

  // ソート順位 (1位〜) を確定
  sorted.forEach((ea, idx) => {
    ea.current_rank = idx + 1;
  });

  renderTopCards(sorted.slice(0, 5), sortMode);
  renderTable(sorted.slice(5), sortMode);
}

let chartInstances = {};

function renderTopCards(topEAs, sortMode = 'score') {
  // 既存のChartインスタンスを破棄してメモリリーク・重複描画を防止
  Object.keys(chartInstances).forEach(id => {
    try { chartInstances[id].destroy(); } catch (e) {}
  });
  chartInstances = {};

  const container = document.getElementById("top-cards-container");
  container.innerHTML = "";

  const sortConfig = {
    score: { 
      badgeTitle: '総合スコア第', 
      scoreLabel: '総合評価', 
      renderVal: (ea) => `★ ${ea.total_score || 0} <span class="score-max-text">/ 100</span>` 
    },
    pf: { 
      badgeTitle: 'PFランキング第', 
      scoreLabel: 'PF (プロフィットファクター)', 
      renderVal: (ea) => `PF ${ea.raw_pf || '0.0'} <span class="score-max-text">(${ea.score_pf || 0}点)</span>` 
    },
    return: { 
      badgeTitle: '月間収益率第', 
      scoreLabel: '月間リターン', 
      renderVal: (ea) => `${ea.raw_monthly_return || '0%'} <span class="score-max-text">(${ea.score_monthly_return || 0}点)</span>` 
    },
    dd: { 
      badgeTitle: '低ドローダウン(安定)第', 
      scoreLabel: '最大DD', 
      renderVal: (ea) => `${ea.raw_dd || '0%'} <span class="score-max-text">(${ea.score_dd || 0}点)</span>` 
    }
  };
  const currentSort = sortConfig[sortMode] || sortConfig.score;

  topEAs.forEach((ea, index) => {
    const rankNum = index + 1;
    const rankBadge = (ea.rank_badge || 'C').toUpperCase();
    const isSRankOrHigher = ['S', 'SS', 'SSS'].includes(rankBadge);
    
    // Total Score color class
    let scoreColorClass = 'score-other';
    if (isSRankOrHigher) scoreColorClass = 'score-s';
    else if (['A', 'B'].includes(rankBadge)) scoreColorClass = 'score-a';

    // 順位バッジのクラス
    let rankPillClass = 'rank-pill-other';
    if (rankNum === 1) rankPillClass = 'rank-pill-1';
    else if (rankNum === 2) rankPillClass = 'rank-pill-2';
    else if (rankNum === 3) rankPillClass = 'rank-pill-3';

    // Parts
    const rankIcon = `images/CardDesignParts/Rank/rank_${rankBadge}.png`;
    const targetMonth = ea.target_month || '2026.08';

    // Tags
    let tagsStr = 'N/A';
    if (Array.isArray(ea.tags) && ea.tags.length > 0) {
      tagsStr = ea.tags.join(' / ');
    } else if (typeof ea.tags === 'string' && ea.tags.trim() !== '') {
      tagsStr = ea.tags;
    }

    // 中枠 (アート枠) の背景画像
    const frameImagePath = `images/CardDesignParts/Frame/frame_${rankBadge}.png`;
    const artFrameStyle = `background-image: url('${frameImagePath}');`;

    let skillBannerHtml = "";
    let statsFrameHtml = "";

    if (isSRankOrHigher) {
      skillBannerHtml = `
        <div class="skill-banner-container" style="background-image: url('images/CardDesignParts/Frame/frame_Skill.png');">
          <div class="skill-tags-text">${tagsStr}</div>
        </div>
      `;
      statsFrameHtml = `<div class="stats-frame" style="background-image: url('images/CardDesignParts/Frame/frame_Under.png');">`;
    } else {
      skillBannerHtml = `
        <div class="skill-banner-container skill-banner-css">
          <div class="skill-tags-text">${tagsStr}</div>
        </div>
      `;
      statsFrameHtml = `<div class="stats-frame stats-frame-css">`;
    }

    const thumbnail = ea.image_url || 'images/default-ea.jpg';
    const priceText = ea.price_text || (ea.price_value ? `$${ea.price_value}` : '無料');
    const hasCopyPrice = ea.copy_price_text || ea.copy_price_value;
    const copyPriceText = ea.copy_price_text || (ea.copy_price_value ? `$${ea.copy_price_value} / 月` : '');

    // プラットフォーム表示
    const platformStr = Array.isArray(ea.platform) ? ea.platform.join(', ') : (ea.platform || 'MT4');

    // 直近6ヶ月の月次ランク履歴バッジ (1行表示)
    // 選択された月までの過去最大6ヶ月分を表示
    const eaHistoryUpToSelected = (monthlyHistoryMap[ea.id] || [])
      .filter(m => m.year_month <= selectedMonth);
    const eaMonthlyList = eaHistoryUpToSelected.slice(-6);

    let historyBadgesHtml = '';
    if (eaMonthlyList.length > 0) {
      const latestMonth = availableMonths[0];
      const baseMonths = parsePeriodMonths(ea.raw_period);
      const fixedScores = (ea.score_pf || 0) + (ea.score_rf || 0) + (ea.score_dd || 0);

      historyBadgesHtml = eaMonthlyList.map((m, idx) => {
        const val = parseFloat(m.monthly_return_percent) || 0;
        const mReturnScore = calcMonthlyReturnScore(val);

        // その月基準の稼働期間と安定性を算出
        const mDiffMonths = getMonthDiff(m.year_month, latestMonth);
        const mElapsedMonths = Math.max(0, baseMonths - mDiffMonths);
        const mPeriodScore = calcPeriodScore(mElapsedMonths);

        const mRecordsUpTo = (monthlyHistoryMap[ea.id] || []).filter(item => item.year_month <= m.year_month);
        const mPast12 = mRecordsUpTo.slice(-12);
        const mWinMonths = mPast12.filter(item => (parseFloat(item.monthly_return_percent) || 0) > 0).length;
        const mStabilityScore = calcStabilityScore(mWinMonths);

        const mTotalScore = mReturnScore + fixedScores + mPeriodScore + mStabilityScore;
        const mRank = calcRankBadge(mTotalScore);
        const rankClass = `rank-bg-${mRank.toLowerCase()}`;
        
        const parts = m.year_month.split('-');
        const monthLabel = parts.length > 1 ? `${parseInt(parts[1], 10)}月` : m.year_month;
        const arrow = idx < eaMonthlyList.length - 1 ? '<i class="fa-solid fa-arrow-right history-arrow"></i>' : '';
        
        const isCurrentSelected = (m.year_month === selectedMonth);
        const activeStyle = isCurrentSelected 
          ? 'style="box-shadow: 0 0 0 2px #38BDF8, 0 0 8px rgba(56, 189, 248, 0.4); border-color: #38BDF8; background: rgba(56, 189, 248, 0.15); border-radius: 4px;"' 
          : '';

        return `
          <div class="history-badge-item" ${activeStyle}>
            <span class="history-month">${monthLabel}</span>
            <span class="history-rank-badge ${rankClass}">${mRank}</span>
          </div>
          ${arrow}
        `;
      }).join('');
    } else {
      historyBadgesHtml = `<span style="font-size:0.72rem; color:#64748B;">直近の確定月次ランク推移を収集中です</span>`;
    }

    // 管理人メモ (notes)
    const adminNotes = ea.notes && ea.notes.trim() !== ''
      ? ea.notes.replace(/\n/g, '<br>')
      : 'リアル口座での安定運用実績を継続モニタリング中。リスク管理ロジックとドローダウン許容度に注目して検証を進めています。';

    const unitHtml = `
      <div class="ranking-item-unit">
        <!-- 1. ヘッダー部 (カード外の順位・EA名・スコア) -->
        <div class="ranking-unit-header">
          <div class="rank-badge-pill ${rankPillClass}">
            <span class="rank-num-box">${rankNum}</span>
            <span class="rank-title-text">${currentSort.badgeTitle}${rankNum}位</span>
          </div>
          <div class="header-tags">
            <span class="tag-badge currency"><i class="fa-solid fa-coins"></i> ${ea.currency_pair || 'EURUSD'}</span>
            <span class="tag-badge"><i class="fa-solid fa-clock"></i> ${ea.timeframe || 'H1'}</span>
            <span class="tag-badge">${platformStr}</span>
          </div>
        </div>

        <div class="ranking-unit-title-row">
          <h2 class="ranking-ea-title">${ea.name || 'Unknown EA'}</h2>
          <div class="ranking-unit-score">
            <span class="score-label-text">${currentSort.scoreLabel}</span>
            <span class="score-main-val ${scoreColorClass}">${currentSort.renderVal(ea)}</span>
            <span class="rank-letter-tag">${rankBadge}ランク</span>
          </div>
        </div>

        <!-- 2. コンテンツ部 (左：TCGカード、右：価格・ハイライト・メモ・3大ボタン) -->
        <div class="ranking-unit-body">
          <!-- 左カラム：TCGカード -->
          <div class="card-column">
            <div class="tcg-card">
              <!-- TOP SECTION -->
              <div class="top-section">
                <div class="ea-title-area">
                  <div class="ea-name">${ea.name || 'Unknown EA'}</div>
                  <div class="total-score-box">
                    <span class="total-score-label">TotalScore</span>
                    <span class="total-score-val ${scoreColorClass}">${ea.total_score || 0} / 100</span>
                  </div>
                </div>
                
                <!-- Floating Rank Badge & Date -->
                <div class="rank-badge-area">
                  <img src="${rankIcon}" class="rank-ss-logo" alt="${rankBadge} Rank Logo" onerror="this.style.display='none'">
                  <div class="date-badge">${targetMonth}</div>
                </div>
              </div>

              <!-- MIDDLE SECTION (Left: Thumbnail, Right: Radar) -->
              <div class="art-frame" style="${artFrameStyle}">
                <img src="${thumbnail}" class="ea-thumbnail" alt="${ea.name}" onerror="this.src='images/administrator.png'">
                <div class="radar-circle">
                  <canvas id="radar-${ea.id}"></canvas>
                </div>
              </div>

              <!-- SKILL BANNER SECTION -->
              ${skillBannerHtml}

              <!-- BOTTOM SECTION (6-Axis Status List) -->
              ${statsFrameHtml}
                <div class="stat-row">
                  <div class="stat-left">
                    <i class="fa-solid fa-hand-fist stat-icon"></i>
                    <span class="stat-name">月間収益率</span>
                    <span class="stat-points">${ea.score_monthly_return || 0} / 20</span>
                  </div>
                  <div class="stat-raw-value">${ea.raw_monthly_return || '0%'}</div>
                </div>

                <div class="stat-row">
                  <div class="stat-left">
                    <i class="fa-solid fa-coins stat-icon"></i>
                    <span class="stat-name">PF</span>
                    <span class="stat-points">${ea.score_pf || 0} / 20</span>
                  </div>
                  <div class="stat-raw-value">${ea.raw_pf || '0.0'}</div>
                </div>

                <div class="stat-row">
                  <div class="stat-left">
                    <i class="fa-solid fa-feather-pointed stat-icon"></i>
                    <span class="stat-name">RF</span>
                    <span class="stat-points">${ea.score_rf || 0} / 20</span>
                  </div>
                  <div class="stat-raw-value">${ea.raw_rf || '0.0'}</div>
                </div>

                <div class="stat-row">
                  <div class="stat-left">
                    <i class="fa-solid fa-shield-halved stat-icon"></i>
                    <span class="stat-name">DD</span>
                    <span class="stat-points">${ea.score_dd || 0} / 15</span>
                  </div>
                  <div class="stat-raw-value">${ea.raw_dd || '0%'}</div>
                </div>

                <div class="stat-row">
                  <div class="stat-left">
                    <i class="fa-solid fa-hourglass-half stat-icon"></i>
                    <span class="stat-name">稼働期間</span>
                    <span class="stat-points">${ea.score_period || 0} / 15</span>
                  </div>
                  <div class="stat-raw-value">${ea.raw_period || '0ヶ月'}</div>
                </div>

                <div class="stat-row">
                  <div class="stat-left">
                    <i class="fa-solid fa-heart stat-icon"></i>
                    <span class="stat-name">収益安定性</span>
                    <span class="stat-points">${ea.score_stability || 0} / 10</span>
                  </div>
                  <div class="stat-raw-value">${ea.raw_stability || '0ヶ月'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 右カラム：サイドパネル (価格・6項目サマリー・推移・メモ・3大ボタン) -->
          <div class="side-action-column">
            <!-- 価格カード -->
            <div class="side-price-card">
              <div class="side-price-item">
                <span class="price-type-text"><i class="fa-solid fa-cart-shopping"></i> 販売価格</span>
                <span class="price-amount-text">${priceText}</span>
              </div>
              ${hasCopyPrice ? `
              <div class="side-price-item copy">
                <span class="price-type-text"><i class="fa-solid fa-copy"></i> コピートレード</span>
                <span class="price-amount-text">${copyPriceText}</span>
              </div>` : ''}
            </div>

            <!-- クイックサマリー (6項目) -->
            <div class="quick-stats-summary">
              <div class="summary-item">
                <span class="summary-label">月利</span>
                <span class="summary-val highlight">${ea.raw_monthly_return || '0%'}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">PF</span>
                <span class="summary-val">${ea.raw_pf || '0.0'}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">最大DD</span>
                <span class="summary-val highlight">${ea.raw_dd || '0%'}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">勝率</span>
                <span class="summary-val">${ea.raw_win_rate || '-'}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">稼働期間</span>
                <span class="summary-val">${ea.raw_period || '0ヶ月'}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">安定性</span>
                <span class="summary-val">${ea.raw_stability || '0ヶ月'}</span>
              </div>
            </div>

            <!-- 直近ランク推移 (直近6ヶ月・1行) -->
            <div class="monthly-history-section">
              <div class="history-header">
                <span><i class="fa-solid fa-clock-rotate-left"></i> 直近ランク推移 (過去6ヶ月)</span>
                <span style="font-size:0.68rem; color:#64748B;">確定推移</span>
              </div>
              <div class="history-badge-list">
                ${historyBadgesHtml}
              </div>
            </div>

            <!-- 管理人ワンポイント解説 (notes) -->
            <div class="admin-memo-box">
              <div class="memo-header">
                <i class="fa-solid fa-lightbulb"></i>
                <span>管理人ワンポイント解説</span>
              </div>
              <p class="memo-content">${adminNotes}</p>
            </div>

            <!-- 3大アクションボタン (横並び1行) -->
            <div class="side-action-buttons">
              <a href="${ea.product_url || '#'}" target="_blank" class="action-btn btn-mql5" title="MQL5公式 EA紹介ページへ">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> EA紹介 (MQL5)
              </a>

              <a href="${ea.forward_url || '#'}" target="_blank" class="action-btn btn-forward" title="リアル口座フォワードテスト検証へ">
                <i class="fa-solid fa-chart-line"></i> フォワード検証
              </a>

              <a href="detail.html?ea=${ea.ea_key || ea.id}&month=${selectedMonth}" class="action-btn btn-detail-site" title="当サイトの個別詳細データへ">
                <i class="fa-solid fa-file-waveform"></i> 当サイト詳細
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', unitHtml);
    
    // レーダーチャートの描画
    setTimeout(() => {
      renderRadarChart(`radar-${ea.id}`, ea);
    }, 50);
  });
}



function renderTable(tableEAs, sortMode = 'score') {
  const tbody = document.getElementById("ranking-table-body");
  tbody.innerHTML = "";

  tableEAs.forEach((ea, index) => {
    const rankNum = index + 6;
    const rankBadge = (ea.rank_badge || 'C').toUpperCase();
    const priceText = ea.price_text || (ea.price_value ? `$${ea.price_value}` : '無料');
    const copyPriceText = ea.copy_price_text || (ea.copy_price_value ? `$${ea.copy_price_value} / 月` : '-');

    const isReturnSort = sortMode === 'return';
    const isPFSort = sortMode === 'pf';
    const isDDSort = sortMode === 'dd';

    const rowHtml = `
      <tr>
        <td>
          <span class="rank-number">${rankNum}</span>
        </td>
        <td>
          <div style="font-weight: 800; color: #FFF; font-size: 1.05rem;">${ea.name || 'Unknown'}</div>
          <div style="font-size: 0.8rem; color: #94A3B8;">${ea.currency_pair || 'N/A'}</div>
        </td>
        <td>
          <div style="font-weight: 900; color: #38BDF8; font-size: 1.1rem; font-family: 'Outfit', sans-serif;">
            ${ea.total_score || 0} pts
          </div>
          <div style="font-size: 0.8rem; font-weight: bold; color: #FBBF24;">Rank: ${rankBadge}</div>
        </td>
        <td>
          <div class="score-breakdown">
            <span class="score-badge" style="${isReturnSort ? 'border-color:#38BDF8; background:rgba(56,189,248,0.2);' : ''}">月利 <strong>${ea.score_monthly_return || 0}</strong></span>
            <span class="score-badge" style="${isPFSort ? 'border-color:#38BDF8; background:rgba(56,189,248,0.2);' : ''}">PF <strong>${ea.score_pf || 0}</strong></span>
            <span class="score-badge">RF <strong>${ea.score_rf || 0}</strong></span>
            <span class="score-badge" style="${isDDSort ? 'border-color:#38BDF8; background:rgba(56,189,248,0.2);' : ''}">DD <strong>${ea.score_dd || 0}</strong></span>
            <span class="score-badge">期間 <strong>${ea.score_period || 0}</strong></span>
            <span class="score-badge">安定 <strong>${ea.score_stability || 0}</strong></span>
          </div>
        </td>
        <td>
          <div style="font-size: 0.85rem; color: #FBBF24;">購入: ${priceText}</div>
          <div style="font-size: 0.85rem; color: #34D399;">Copy: ${copyPriceText}</div>
        </td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <a href="detail.html?ea=${ea.ea_key || ea.id}&month=${selectedMonth}" class="btn-detail" style="background: linear-gradient(135deg, #1E293B, #334155); border: 1px solid #38BDF8; color: #38BDF8;" title="当サイト独自EA詳細検証"><i class="fa-solid fa-file-waveform"></i> 詳細</a>
            <a href="${ea.product_url || '#'}" target="_blank" class="btn-detail" title="EA紹介 (MQL5)">紹介 <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
            <a href="${ea.forward_url || '#'}" target="_blank" class="btn-detail" style="background: #059669; border-color: #10B981; color: #FFF;" title="フォワードテスト (MQL5シグナル)">検証 <i class="fa-solid fa-chart-line"></i></a>
          </div>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHtml);
  });
}

function renderRadarChart(canvasId, ea) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (chartInstances[canvasId]) {
    try { chartInstances[canvasId].destroy(); } catch (e) {}
    delete chartInstances[canvasId];
  }
  const ctx = canvas.getContext('2d');

  // 各指標の満点比率（100点換算）
  const valReturn = Math.min(100, Math.round(((ea.score_monthly_return || 0) / 20) * 100));
  const valPF = Math.min(100, Math.round(((ea.score_pf || 0) / 20) * 100));
  const valRF = Math.min(100, Math.round(((ea.score_rf || 0) / 20) * 100));
  const valDD = Math.min(100, Math.round(((ea.score_dd || 0) / 15) * 100));
  const valPeriod = Math.min(100, Math.round(((ea.score_period || 0) / 15) * 100));
  const valStability = Math.min(100, Math.round(((ea.score_stability || 0) / 10) * 100));

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['収益', 'PF', 'RF', 'DD', '期間', '安定'],
      datasets: [{
        data: [valReturn, valPF, valRF, valDD, valPeriod, valStability],
        backgroundColor: 'rgba(56, 189, 248, 0.3)',
        borderColor: '#38BDF8',
        borderWidth: 1.5,
        pointRadius: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
          grid: { color: 'rgba(255, 255, 255, 0.2)' },
          pointLabels: { 
            color: '#F8FAFC', 
            font: { size: 9, weight: 'bold', style: 'italic' } 
          },
          ticks: { display: false },
          min: 0,
          max: 100
        }
      }
    }
  });
}

/* ==========================================================================
   当ラボ公式 リアル検証機（特別ベンチマーク枠）
   ========================================================================== */
let cachedBenchmark = null;

async function loadBenchmarkData() {
  const container = document.getElementById("benchmark-showcase-container");
  if (!container) return;

  let bench = null;

  // 1. Supabase (lab_benchmark_snapshots) から取得を試行
  try {
    const { data, error } = await _supabase
      .from('lab_benchmark_snapshots')
      .select('*')
      .order('target_month', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      bench = data[0];
    }
  } catch (err) {
    // テーブル未作成等の場合はローカルJSONにフォールバック
  }

  // 2. ローカル静的JSONファイルから取得
  if (!bench) {
    try {
      const res = await fetch('data/benchmark_darkvenus.json');
      if (res.ok) {
        bench = await res.json();
      }
    } catch (err) {
      console.warn("ベンチマークデータの読み込みをスキップ:", err);
    }
  }

  if (bench) {
    cachedBenchmark = bench;
    renderBenchmarkCard(bench);
  }
}

let benchmarkChartInstance = null;

function renderBenchmarkRadar(canvasId, bench) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (benchmarkChartInstance) {
    try { benchmarkChartInstance.destroy(); } catch (e) {}
    benchmarkChartInstance = null;
  }
  const ctx = canvas.getContext('2d');

  const valReturn = Math.min(100, Math.round(((bench.score_monthly_return || 5) / 20) * 100));
  const valPF = Math.min(100, Math.round(((bench.score_pf || 20) / 20) * 100));
  const valRF = Math.min(100, Math.round(((bench.score_rf || 14) / 20) * 100));
  const valDD = Math.min(100, Math.round(((bench.score_dd || 12) / 15) * 100));
  const valPeriod = Math.min(100, Math.round(((bench.score_period || 8) / 15) * 100));
  const valStability = Math.min(100, Math.round(((bench.score_stability || 8) / 10) * 100));

  benchmarkChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['収益', 'PF', 'RF', 'DD', '期間', '安定'],
      datasets: [{
        data: [valReturn, valPF, valRF, valDD, valPeriod, valStability],
        backgroundColor: 'rgba(56, 189, 248, 0.35)',
        borderColor: '#38BDF8',
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: '#FCD34D'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
          grid: { color: 'rgba(255, 255, 255, 0.2)' },
          pointLabels: { 
            color: '#F8FAFC', 
            font: { size: 9, weight: 'bold', style: 'italic' } 
          },
          ticks: { display: false },
          min: 0,
          max: 100
        }
      }
    }
  });
}

function renderBenchmarkCard(bench) {
  const container = document.getElementById("benchmark-showcase-container");
  if (!container || !bench) return;

  const targetMonthStr = bench.target_month ? formatMonthLabel(bench.target_month) : '最新';
  const cleanProfit = bench.total_profit ? bench.total_profit.split('.')[0] : '¥210,358';
  const cleanWinRate = bench.win_rate ? (parseFloat(bench.win_rate).toFixed(1) + '%') : '67.5%';
  const tradesCount = bench.total_trades ? Number(bench.total_trades).toLocaleString() : '1,313';
  const scoreVal = bench.total_score || 67;
  const rankBadge = bench.rank_badge || 'A';
  const pfVal = bench.raw_pf || '2.49';
  const ddVal = bench.raw_dd || '13.88%';
  const returnVal = bench.raw_monthly_return || '+2.12%';
  const periodVal = bench.raw_period || '1.8年 (96週)';
  const stabilityVal = bench.raw_stability || '10勝';
  const rfVal = bench.raw_rf || '4.26';
  const gainVal = bench.gain_percent || '+59.10%';
  const forwardUrl = bench.forward_url || 'https://www.myfxbook.com/portfolio/axiory-nzdcad-m15/11923451';

  container.innerHTML = `
    <div class="ranking-item-unit benchmark-unit">
      <!-- 1. ヘッダー部 (特別ベンチマークバッジ・タグ) -->
      <div class="ranking-unit-header">
        <div class="rank-badge-pill rank-pill-benchmark">
          <span class="rank-num-box"><i class="fa-solid fa-crown" style="font-size: 0.85rem; color: #FCD34D;"></i></span>
          <span class="rank-title-text">特別ベンチマーク ｜ 当ラボ看板・公式リアル実弾検証機</span>
        </div>
        <div class="header-tags">
          <span class="tag-badge currency"><i class="fa-solid fa-coins"></i> ${bench.currency_pair || 'NZDCAD'}</span>
          <span class="tag-badge"><i class="fa-solid fa-clock"></i> ${bench.timeframe || 'M15'}</span>
          <span class="tag-badge benchmark-badge-real"><i class="fa-solid fa-circle-check"></i> Axiory Real (実弾口座)</span>
          <span class="tag-badge benchmark-badge-free"><i class="fa-solid fa-tag"></i> ${bench.price_text || '完全無料EA (Free)'}</span>
        </div>
      </div>

      <div class="ranking-unit-title-row">
        <h2 class="ranking-ea-title">
          Dark Venus <span style="font-size: 1.05rem; color: #38BDF8; font-weight: 700; margin-left: 8px;">［当ラボ公式NZDCAD設定 / ${bench.timeframe || 'M15'}］</span>
        </h2>
        <div class="ranking-unit-score">
          <span class="score-label-text">総合スコア</span>
          <span class="score-main-val score-a">★ ${scoreVal} <span class="score-max-text">/ 100</span></span>
          <span class="rank-letter-tag" style="background: rgba(56, 189, 248, 0.2); color: #38BDF8; border-color: #38BDF8;">${rankBadge}ランク</span>
        </div>
      </div>

      <!-- 2. コンテンツ部 (左：TCGカード、右：サイドパネル) -->
      <div class="ranking-unit-body">
        <!-- 左カラム：TCGカード -->
        <div class="card-column">
          <div class="tcg-card">
            <!-- TOP SECTION -->
            <div class="top-section">
              <div class="ea-title-area">
                <div class="ea-name">Dark Venus</div>
                <div class="total-score-box">
                  <span class="total-score-label">TotalScore</span>
                  <span class="total-score-val score-a">${scoreVal} / 100</span>
                </div>
              </div>
              
              <!-- Floating Rank Badge & Date -->
              <div class="rank-badge-area">
                <img src="images/CardDesignParts/Rank/rank_A.png" class="rank-ss-logo" alt="A Rank Logo" onerror="this.style.display='none'">
                <div class="date-badge" style="background: linear-gradient(135deg, #0284C7, #0EA5E9); border-color: #7DD3FC;">公式基準機</div>
              </div>
            </div>

            <!-- MIDDLE SECTION (Left: Mascot Thumbnail, Right: Radar Canvas) -->
            <div class="art-frame" style="background-image: url('images/CardDesignParts/Frame/frame_A.png');">
              <img src="images/administrator.png" class="ea-thumbnail admin-thumb" alt="Dark Venus 管理人実弾検証機" title="当ラボ管理人 実弾運用機">
              <div class="radar-circle">
                <canvas id="radar-benchmark"></canvas>
              </div>
            </div>

            <!-- SKILL BANNER SECTION -->
            <div class="skill-banner-container" style="background-image: url('images/CardDesignParts/Frame/frame_Skill.png');">
              <div class="skill-tags-text">完全無料 / 独自NZDCAD設定 / 実弾運用中</div>
            </div>

            <!-- BOTTOM SECTION (6-Axis Status List) -->
            <div class="stats-frame" style="background-image: url('images/CardDesignParts/Frame/frame_Under.png');">
              <div class="stat-row">
                <div class="stat-left">
                  <i class="fa-solid fa-hand-fist stat-icon"></i>
                  <span class="stat-name">月間収益率</span>
                  <span class="stat-points">${bench.score_monthly_return || 5} / 20</span>
                </div>
                <div class="stat-raw-value">${returnVal}</div>
              </div>

              <div class="stat-row">
                <div class="stat-left">
                  <i class="fa-solid fa-coins stat-icon"></i>
                  <span class="stat-name">PF</span>
                  <span class="stat-points" style="color: #FBBF24; font-weight: 900;">${bench.score_pf || 20} / 20 満点!</span>
                </div>
                <div class="stat-raw-value" style="color: #FBBF24; font-weight: 900;">${pfVal}</div>
              </div>

              <div class="stat-row">
                <div class="stat-left">
                  <i class="fa-solid fa-feather-pointed stat-icon"></i>
                  <span class="stat-name">RF</span>
                  <span class="stat-points">${bench.score_rf || 14} / 20</span>
                </div>
                <div class="stat-raw-value">${rfVal}</div>
              </div>

              <div class="stat-row">
                <div class="stat-left">
                  <i class="fa-solid fa-shield-halved stat-icon"></i>
                  <span class="stat-name">DD</span>
                  <span class="stat-points">${bench.score_dd || 12} / 15</span>
                </div>
                <div class="stat-raw-value">${ddVal}</div>
              </div>

              <div class="stat-row">
                <div class="stat-left">
                  <i class="fa-solid fa-hourglass-half stat-icon"></i>
                  <span class="stat-name">稼働期間</span>
                  <span class="stat-points">${bench.score_period || 8} / 15</span>
                </div>
                <div class="stat-raw-value">${periodVal}</div>
              </div>

              <div class="stat-row">
                <div class="stat-left">
                  <i class="fa-solid fa-heart stat-icon"></i>
                  <span class="stat-name">収益安定性</span>
                  <span class="stat-points">${bench.score_stability || 8} / 10</span>
                </div>
                <div class="stat-raw-value">${stabilityVal}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右カラム：サイドパネル -->
        <div class="side-action-column">
          <!-- 価格・口座カード -->
          <div class="side-price-card">
            <div class="side-price-item">
              <span class="price-type-text"><i class="fa-solid fa-cart-shopping"></i> 販売価格</span>
              <span class="price-amount-text" style="color: #34D399;">${bench.price_text || '完全無料 (Free)'}</span>
            </div>
            <div class="side-price-item copy">
              <span class="price-type-text"><i class="fa-solid fa-building-columns"></i> 運用口座 / 種別</span>
              <span class="price-amount-text" style="color: #38BDF8; font-size: 0.95rem;">Axiory Nano (実弾口座)</span>
            </div>
          </div>

          <!-- クイックサマリー (6項目) -->
          <div class="quick-stats-summary">
            <div class="summary-item">
              <span class="summary-label">月利</span>
              <span class="summary-val highlight">${returnVal}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">PF</span>
              <span class="summary-val" style="color: #FBBF24; font-weight: 900;">${pfVal} (満点)</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">最大DD</span>
              <span class="summary-val highlight" style="color: #34D399;">${ddVal}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">純利益</span>
              <span class="summary-val highlight" style="color: #34D399;">${gainVal} (${cleanProfit})</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">勝率</span>
              <span class="summary-val">${cleanWinRate}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">取引回数</span>
              <span class="summary-val">${tradesCount}回</span>
            </div>
          </div>

          <!-- ベンチマークの役割・解説 -->
          <div class="benchmark-role-box">
            <div class="benchmark-role-title">
              <i class="fa-solid fa-scale-balanced" style="color: #FBBF24;"></i>
              <span>当サイトにおける公式ベンチマーク（基準機）の役割</span>
            </div>
            <p class="benchmark-role-desc">
              数十万円の高額市販EAがひしめく中で、<strong>「完全無料EAでも正しく設定すればここまで戦える」という客観的な比較物差し</strong>としてAxioryリアル口座の実弾データをmyfxbookで完全透明公開しています。
            </p>
          </div>

          <!-- 管理人リアル稼働メモ -->
          <div class="admin-memo-box">
            <div class="memo-header">
              <i class="fa-solid fa-comment-dots"></i>
              <span>管理人リアル運用メモ</span>
            </div>
            <p class="memo-content">
              ${bench.notes || 'オセアニア通貨NZDCADのレンジ特性を捉え、1年10ヶ月無破綻・PF2.49（採点満点）を継続。ドローダウンも13.88%と極めて堅牢です。検証済みの設定ファイル（.set）は完全無料配布中。'}
            </p>
          </div>

          <!-- 4大アクションボタン -->
          <div class="benchmark-action-buttons">
            <a href="${forwardUrl}" target="_blank" rel="noopener noreferrer" class="action-btn btn-forward" title="myfxbook公式リアル成績（実弾口座）">
              <i class="fa-solid fa-chart-line"></i> myfxbook成績 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.7rem;"></i>
            </a>
            <a href="ea/forward-test.html" class="action-btn btn-detail-site" title="フォワード検証ラボへ">
              <i class="fa-solid fa-vial"></i> 検証詳細
            </a>
            <a href="tools/setfiles.html" class="action-btn btn-detail-site" title="検証済み.set設定一覧へ">
              <i class="fa-solid fa-folder-open"></i> .set設定
            </a>
            <a href="columns/vps.html" class="action-btn" style="background: linear-gradient(135deg, #7C3AED, #8B5CF6); color: #FFF; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);" title="Dark Venus 24時間稼働インフラ解説">
              <i class="fa-solid fa-server"></i> 稼働環境(VPS)
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    renderBenchmarkRadar('radar-benchmark', bench);
  }, 60);
}

