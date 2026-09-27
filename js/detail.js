const SUPABASE_URL = 'https://tskpfaqxqiqegwezovce.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWlxZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentEA = null;
let monthlyRecords = [];
let chartInstance = null;

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

function formatMonthLabel(ym) {
  if (!ym) return '';
  const parts = ym.replace('.', '-').split('-');
  if (parts.length >= 2) {
    return `${parts[0]}年${parseInt(parts[1], 10)}月度`;
  }
  return ym;
}

document.addEventListener("DOMContentLoaded", async () => {
  initCriteriaModal();
  await fetchEADetailData();
});

async function fetchEADetailData() {
  const urlParams = new URLSearchParams(window.location.search);
  const eaParam = urlParams.get('ea') || urlParams.get('id');

  try {
    let query = _supabase.from('ea_master').select('*');

    if (eaParam) {
      const isNum = /^\d+$/.test(eaParam);
      if (isNum) {
        query = query.eq('id', parseInt(eaParam, 10));
      } else {
        query = query.eq('ea_key', eaParam);
      }
    } else {
      // 指定がない場合は1件目（デフォルト）を表示
      query = query.eq('is_active', true).order('total_score', { ascending: false }).limit(1);
    }

    const { data: eaData, error: eaErr } = await query.maybeSingle();

    if (eaErr || !eaData) {
      // fallback: try finding by name if ea_key didn't match
      if (eaParam) {
        const { data: fallbackData } = await _supabase
          .from('ea_master')
          .select('*')
          .ilike('name', `%${eaParam}%`)
          .limit(1)
          .maybeSingle();
        if (fallbackData) {
          currentEA = fallbackData;
        } else {
          showError("指定されたEAが見つかりませんでした。URLをご確認ください。");
          return;
        }
      } else {
        showError("表示可能なEAデータがありません。");
        return;
      }
    } else {
      currentEA = eaData;
    }

    // 月次推移データを全件取得（降順：新しい順）
    try {
      const { data: mData, error: mErr } = await _supabase
        .from('ea_monthly_summaries')
        .select('*')
        .eq('ea_id', currentEA.id)
        .order('year_month', { ascending: false });

      if (!mErr && mData) {
        monthlyRecords = mData;
      }
    } catch (mErr) {
      console.warn("月次推移の取得に失敗しました:", mErr);
    }

    // レンダリング実行
    renderDetailPage();

    document.getElementById("loading-state").style.display = "none";
    document.getElementById("detail-content").style.display = "block";

  } catch (err) {
    console.error("データ取得エラー:", err);
    showError("データの読み込み中にエラーが発生しました: " + err.message);
  }
}

function showError(msg) {
  document.getElementById("loading-state").style.display = "none";
  const errEl = document.getElementById("error-state");
  if (errEl) {
    errEl.style.display = "block";
    document.getElementById("error-message").textContent = msg;
  }
}

function renderDetailPage() {
  const ea = currentEA;
  const rankBadge = (ea.rank_badge || 'C').toUpperCase();
  const isSRankOrHigher = ['S', 'SS', 'SSS'].includes(rankBadge);

  // 1. タイトル & メタタグ
  document.title = `【詳細検証】${ea.name} | リアル稼働EA総合ランキング | Dark Venus ラボ`;
  document.getElementById("breadcrumb-ea-name").textContent = ea.name;
  document.getElementById("ea-main-name").textContent = ea.name;

  // ヘッダー部スコア・ランク
  let scoreColorClass = 'score-other';
  if (isSRankOrHigher) scoreColorClass = 'score-s';
  else if (['A', 'B'].includes(rankBadge)) scoreColorClass = 'score-a';

  const headerRankPill = document.getElementById("header-rank-pill");
  if (headerRankPill) {
    if (rankBadge === 'SS' || rankBadge === 'SSS') headerRankPill.className = 'rank-badge-pill rank-pill-ss';
    else if (rankBadge === 'S') headerRankPill.className = 'rank-badge-pill rank-pill-s';
    else headerRankPill.className = 'rank-badge-pill rank-pill-other';
  }
  document.getElementById("header-rank-badge-text").textContent = `総合評価ランク: ${rankBadge} (確定)`;

  const headerTotalScore = document.getElementById("header-total-score");
  headerTotalScore.className = `score-main-val ${scoreColorClass}`;
  headerTotalScore.innerHTML = `★ ${ea.total_score || 0} <span class="score-max-text">/ 100</span>`;

  document.getElementById("header-rank-letter").textContent = `${rankBadge}ランク`;

  // ヘッダーメタタグ
  const platformStr = Array.isArray(ea.platform) ? ea.platform.join(', ') : (ea.platform || 'MT4');
  const metaTagsHtml = `
    <span class="tag-badge currency"><i class="fa-solid fa-coins"></i> ${ea.currency_pair || 'EURUSD'}</span>
    <span class="tag-badge"><i class="fa-solid fa-clock"></i> ${ea.timeframe || 'H1'}</span>
    <span class="tag-badge">${platformStr}</span>
    ${ea.broker ? `<span class="tag-badge broker"><i class="fa-solid fa-building-columns"></i> ${ea.broker}</span>` : ''}
    ${ea.recommended_margin ? `<span class="tag-badge"><i class="fa-solid fa-wallet"></i> 推奨: ${ea.recommended_margin}</span>` : ''}
  `;
  document.getElementById("header-meta-tags").innerHTML = metaTagsHtml;

  // 2. TCGカード生成
  renderTCGCard(ea, rankBadge, isSRankOrHigher);

  // 3. サイド情報パネル
  const priceText = ea.price_text || (ea.price_value ? `$${ea.price_value}` : '無料');
  document.getElementById("detail-price-text").textContent = priceText;

  const copyPriceBox = document.getElementById("detail-copy-price-box");
  if (ea.copy_price_text || ea.copy_price_value) {
    copyPriceBox.style.display = 'flex';
    document.getElementById("detail-copy-price-text").textContent = ea.copy_price_text || `$${ea.copy_price_value} / 月`;
  } else {
    copyPriceBox.style.display = 'none';
  }

  // クイックサマリー (6項目)
  document.getElementById("summary-monthly-return").textContent = ea.raw_monthly_return || '0%';
  document.getElementById("summary-pf").textContent = ea.raw_pf || '0.0';
  document.getElementById("summary-dd").textContent = ea.raw_dd || '0%';
  document.getElementById("summary-win-rate").textContent = ea.raw_win_rate || '-';
  document.getElementById("summary-period").textContent = ea.raw_period || '0ヶ月';
  document.getElementById("summary-stability").textContent = ea.raw_stability || '0ヶ月';

  // 管理人解説 (notes)
  const notesText = ea.notes && ea.notes.trim() !== ''
    ? ea.notes.replace(/\n/g, '<br>')
    : 'リアル口座での安定運用実績を継続モニタリング中。リスク管理ロジックとドローダウン許容度に注目して検証を進めています。';
  document.getElementById("detail-admin-notes").innerHTML = notesText;

  // 3大アクションボタンのリンク
  const mql5Link = document.getElementById("btn-mql5-link");
  if (ea.product_url) {
    mql5Link.href = ea.product_url;
  } else {
    mql5Link.style.display = 'none';
  }

  const forwardLink = document.getElementById("btn-forward-link");
  if (ea.forward_url) {
    forwardLink.href = ea.forward_url;
  } else {
    forwardLink.style.display = 'none';
  }

  // 4. 6軸総合評価ブレイクダウン表
  renderBreakdownTable(ea, rankBadge);

  // 5. 詳細フォワード実績＆取引スペック（カードA, B, C）
  renderSpecsGrid(ea);

  // 6. 全期間 確定月次推移 ＆ ランク履歴バックナンバー
  renderAllHistory(ea);
}

function renderTCGCard(ea, rankBadge, isSRankOrHigher) {
  const container = document.getElementById("card-column-container");
  
  const rankIcon = `images/CardDesignParts/Rank/rank_${rankBadge}.png`;
  const frameImagePath = `images/CardDesignParts/Frame/frame_${rankBadge}.png`;
  const artFrameStyle = `background-image: url('${frameImagePath}');`;
  const targetMonth = ea.target_month || '2026.08';
  const thumbnail = ea.image_url || 'images/default-ea.jpg';

  let tagsStr = 'N/A';
  if (Array.isArray(ea.tags) && ea.tags.length > 0) {
    tagsStr = ea.tags.join(' / ');
  } else if (typeof ea.tags === 'string' && ea.tags.trim() !== '') {
    tagsStr = ea.tags;
  }

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

  let scoreColorClass = 'score-other';
  if (isSRankOrHigher) scoreColorClass = 'score-s';
  else if (['A', 'B'].includes(rankBadge)) scoreColorClass = 'score-a';

  container.innerHTML = `
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
          <canvas id="detail-radar-canvas"></canvas>
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
  `;

  // レーダーチャート描画
  setTimeout(() => {
    renderRadarChart('detail-radar-canvas', ea);
  }, 50);
}

function renderRadarChart(canvasId, ea) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (chartInstance) {
    try { chartInstance.destroy(); } catch (e) {}
    chartInstance = null;
  }
  const ctx = canvas.getContext('2d');

  const valReturn = Math.min(100, Math.round(((ea.score_monthly_return || 0) / 20) * 100));
  const valPF = Math.min(100, Math.round(((ea.score_pf || 0) / 20) * 100));
  const valRF = Math.min(100, Math.round(((ea.score_rf || 0) / 20) * 100));
  const valDD = Math.min(100, Math.round(((ea.score_dd || 0) / 15) * 100));
  const valPeriod = Math.min(100, Math.round(((ea.score_period || 0) / 15) * 100));
  const valStability = Math.min(100, Math.round(((ea.score_stability || 0) / 10) * 100));

  chartInstance = new Chart(ctx, {
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

function renderBreakdownTable(ea, rankBadge) {
  const tbody = document.getElementById("breakdown-tbody");
  
  const axes = [
    {
      name: '月間収益率',
      icon: 'fa-solid fa-hand-fist',
      maxScore: 20,
      score: ea.score_monthly_return || 0,
      raw: ea.raw_monthly_return || '0%',
      criteria: '直近確定月の月利（%）。20%以上=20点、15%以上=18点、10%以上=16点 … 0%未満=0点'
    },
    {
      name: 'プロフィットファクター (PF)',
      icon: 'fa-solid fa-coins',
      maxScore: 20,
      score: ea.score_pf || 0,
      raw: ea.raw_pf || '0.0',
      criteria: '総利益 ÷ 総損失。2.00以上=20点、1.80以上=18点、1.60以上=16点 … 1.10未満=0点'
    },
    {
      name: 'リカバリーファクター (RF)',
      icon: 'fa-solid fa-feather-pointed',
      maxScore: 20,
      score: ea.score_rf || 0,
      raw: ea.raw_rf || '0.0',
      criteria: '累積純利益 ÷ 最大ドローダウン額。10.0以上=20点、7.0以上=18点、5.0以上=16点 … 1.0未満=0点'
    },
    {
      name: '最大ドローダウン (DD)',
      icon: 'fa-solid fa-shield-halved',
      maxScore: 15,
      score: ea.score_dd || 0,
      raw: ea.raw_dd || '0%',
      criteria: 'エクイティ基準の資産最大下落率（%）。5%未満=15点、10%未満=14点、15%未満=12点 … 50%以上=0点'
    },
    {
      name: '稼働期間 (運用トラックレコード)',
      icon: 'fa-solid fa-hourglass-half',
      maxScore: 15,
      score: ea.score_period || 0,
      raw: ea.raw_period || '0ヶ月',
      criteria: '累積フォワード期間。5年以上=15点、4年以上=14点、3年以上=13点、1年以上=8点 … 3ヶ月未満=0点'
    },
    {
      name: '収益安定性',
      icon: 'fa-solid fa-heart',
      maxScore: 10,
      score: ea.score_stability || 0,
      raw: ea.raw_stability || '0ヶ月',
      criteria: '直近12か月の月別リターン表でプラスだった月数。12ヶ月=10点、11ヶ月=9点、10ヶ月=8点 … 0〜2ヶ月=0点'
    }
  ];

  tbody.innerHTML = axes.map(a => {
    const pct = Math.min(100, Math.round((a.score / a.maxScore) * 100));
    return `
      <tr>
        <td>
          <div class="axis-col">
            <i class="${a.icon}"></i>
            <span>${a.name}</span>
          </div>
        </td>
        <td>
          <span class="score-badge-detail">${a.score}</span> <span style="font-size: 0.8rem; color:#64748B;">/ ${a.maxScore}点</span>
        </td>
        <td class="bar-col">
          <div class="progress-track" title="達成率: ${pct}%">
            <div class="progress-fill" style="width: ${pct}%;"></div>
          </div>
        </td>
        <td>
          <span class="raw-val-detail">${a.raw}</span>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById("breakdown-total-score").textContent = ea.total_score || 0;
  document.getElementById("breakdown-rank-badge").textContent = `${rankBadge}ランク`;
}

function renderSpecsGrid(ea) {
  // カードA: 口座・資金状況
  document.getElementById("spec-total-profit").textContent = ea.total_profit || '-';
  document.getElementById("spec-balance").textContent = ea.balance || '-';
  document.getElementById("spec-total-deposits").textContent = ea.total_deposits || '-';
  document.getElementById("spec-total-withdrawals").textContent = ea.total_withdrawals || '-';
  document.getElementById("spec-recommended-margin").textContent = ea.recommended_margin || '推奨設定なし';
  document.getElementById("spec-broker").textContent = ea.broker || '公式フォワード口座';

  // カードB: トレード勝率・損益比
  document.getElementById("spec-win-rate").textContent = ea.raw_win_rate || '-';
  document.getElementById("spec-total-trades").textContent = ea.raw_trade_count ? `${ea.raw_trade_count} 回` : '-';
  document.getElementById("spec-win-trades").textContent = ea.win_trades ? `${ea.win_trades} 勝` : '-';
  document.getElementById("spec-loss-trades").textContent = ea.loss_trades ? `${ea.loss_trades} 敗` : '-';
  document.getElementById("spec-best-trade").textContent = ea.best_trade ? `+${ea.best_trade}` : '-';
  document.getElementById("spec-worst-trade").textContent = ea.worst_trade || '-';
  document.getElementById("spec-expected-payoff").textContent = ea.expected_payoff ? `$${ea.expected_payoff}` : '-';

  // カードC: リスク・運用アクティビティ
  document.getElementById("spec-max-deposit-load").textContent = ea.max_deposit_load || '-';
  document.getElementById("spec-trading-activity").textContent = ea.trading_activity || '-';
  document.getElementById("spec-trades-per-week").textContent = ea.trades_per_week ? `${ea.trades_per_week} 回 / 週` : '-';
  document.getElementById("spec-avg-holding-time").textContent = ea.avg_holding_time || '-';
  document.getElementById("spec-sharpe-ratio").textContent = ea.sharpe_ratio || '-';
  const platformStr = Array.isArray(ea.platform) ? ea.platform.join(', ') : (ea.platform || 'MT4');
  document.getElementById("spec-platform").textContent = platformStr;
}

function renderAllHistory(ea) {
  const timelineContainer = document.getElementById("timeline-badge-container");
  const tbody = document.getElementById("monthly-history-tbody");

  if (!monthlyRecords || monthlyRecords.length === 0) {
    timelineContainer.innerHTML = '<span style="color:#64748B; font-size:0.85rem;">月次確定推移データは収集中です</span>';
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748B;">確定済みの月次推移レコードはありません</td></tr>';
    return;
  }

  // 他の5軸の合計点
  const otherScores = (ea.score_pf || 0) + (ea.score_rf || 0) + (ea.score_dd || 0) + (ea.score_period || 0) + (ea.score_stability || 0);

  // パート1: 全期間タイムラインバッジ（古い順で左から右へ流れるように表示）
  const chronoRecords = [...monthlyRecords].reverse();
  timelineContainer.innerHTML = chronoRecords.map((m, idx) => {
    const val = parseFloat(m.monthly_return_percent) || 0;
    const mReturnScore = calcMonthlyReturnScore(val);
    const mTotalScore = otherScores + mReturnScore;
    const mRank = calcRankBadge(mTotalScore);
    const rankClass = `rank-bg-${mRank.toLowerCase()}`;
    const retColor = val >= 0 ? '#34D399' : '#F87171';
    const retSign = val >= 0 ? '+' : '';

    const parts = m.year_month.split('-');
    const monthLabel = parts.length > 1 ? `${parts[0]}.${parts[1]}` : m.year_month;
    const arrow = idx < chronoRecords.length - 1 ? '<i class="fa-solid fa-arrow-right timeline-arrow"></i>' : '';

    return `
      <div class="timeline-badge-card">
        <span class="timeline-month">${monthLabel}</span>
        <span class="timeline-rank ${rankClass}">${mRank}</span>
        <span class="timeline-score">${mTotalScore}点</span>
        <span class="timeline-return" style="color: ${retColor};">${retSign}${val.toFixed(2)}%</span>
      </div>
      ${arrow}
    `;
  }).join('');

  // パート2: 月次確定実績＆採点一覧テーブル（新しい順で表示）
  tbody.innerHTML = monthlyRecords.map(m => {
    const val = parseFloat(m.monthly_return_percent) || 0;
    const mReturnScore = calcMonthlyReturnScore(val);
    const mTotalScore = otherScores + mReturnScore;
    const mRank = calcRankBadge(mTotalScore);
    const rankClass = `rank-bg-${mRank.toLowerCase()}`;
    const isPositive = val >= 0;
    const retColor = isPositive ? '#34D399' : '#F87171';
    const retBg = isPositive ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)';
    const retBorder = isPositive ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)';

    // ビジュアルバー (最大50%を100%幅換算)
    const barWidth = Math.min(100, Math.round((Math.abs(val) / 40) * 100));
    const barColor = isPositive ? '#10B981' : '#EF4444';

    const monthLabel = formatMonthLabel(m.year_month);

    return `
      <tr>
        <td style="font-weight: 800; color: #F8FAFC; font-family: 'Outfit', sans-serif;">
          ${monthLabel}
        </td>
        <td>
          <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: 'Outfit', sans-serif; color: ${retColor}; background: ${retBg}; border: 1px solid ${retBorder};">
            ${isPositive ? '+' : ''}${val.toFixed(2)}%
          </span>
        </td>
        <td>
          <span style="font-weight: 800; color: #38BDF8; font-family: 'Outfit', sans-serif;">${mReturnScore}</span>
          <span style="font-size: 0.78rem; color: #64748B;">/ 20点</span>
        </td>
        <td>
          <span style="font-weight: 900; font-size: 1.05rem; color: #F59E0B; font-family: 'Outfit', sans-serif;">${mTotalScore}</span>
          <span style="font-size: 0.8rem; color: #64748B;">/ 100点</span>
        </td>
        <td>
          <span class="timeline-rank ${rankClass}" style="display: inline-block; font-size: 0.85rem; padding: 3px 10px;">${mRank}</span>
        </td>
        <td>
          <div style="background: rgba(255,255,255,0.08); height: 8px; border-radius: 4px; overflow: hidden; width: 100px;">
            <div style="width: ${barWidth}%; height: 100%; background: ${barColor}; border-radius: 4px;"></div>
          </div>
        </td>
        <td style="text-align: right;">
          <a href="ranking.html?month=${m.year_month}" class="btn-view-month-ranking" title="${monthLabel}の全体ランキングを表示">
            <i class="fa-solid fa-trophy"></i> この月の順位
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

function initCriteriaModal() {
  const modal = document.getElementById("criteria-modal");
  const openBtn = document.getElementById("btn-open-criteria");
  const closeBtn = document.getElementById("modal-close-btn");
  const closeBottomBtn = document.getElementById("modal-close-bottom-btn");

  if (!modal || !openBtn) return;

  const openModal = (e) => {
    if (e) e.preventDefault();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    modal.style.display = "none";
    document.body.style.overflow = "";
  };

  openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (closeBottomBtn) closeBottomBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") {
      closeModal();
    }
  });
}

