const SUPABASE_URL = 'https://tskpfaqxqiqegwezovce.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWlxZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", async () => {
  await fetchAndRenderTop3();
});

// Helper functions (same logic as ranking.js)
function parsePeriodMonths(rawPeriod) {
  if (!rawPeriod) return 0;
  const mWeek = rawPeriod.match(/(\d+)\s*週/);
  if (mWeek) return Math.floor(parseInt(mWeek[1], 10) * 7 / 30.4375);
  const mYear = rawPeriod.match(/([\d\.]+)\s*年/);
  if (mYear) return Math.floor(parseFloat(mYear[1]) * 12);
  const mMonth = rawPeriod.match(/(\d+)\s*か?月/);
  if (mMonth) return parseInt(mMonth[1], 10);
  return 0;
}

function getMonthDiff(ymFrom, ymTo) {
  if (!ymFrom || !ymTo) return 0;
  const [y1, m1] = ymFrom.replace('.', '-').split('-').map(Number);
  const [y2, m2] = ymTo.replace('.', '-').split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

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
  return 0;
}

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

function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const match = String(val).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : 0;
}

async function fetchAndRenderTop3() {
  try {
    const { data: eaData, error: eaErr } = await _supabase.from('ea_master').select('*').eq('is_active', true);
    if (eaErr) throw eaErr;

    const { data: mData, error: mErr } = await _supabase.from('ea_monthly_summaries').select('*').order('year_month', { ascending: true });
    
    let monthlyHistoryMap = {};
    let allMonthsSet = new Set();
    
    if (!mErr && mData) {
      mData.forEach(item => {
        if (!monthlyHistoryMap[item.ea_id]) {
          monthlyHistoryMap[item.ea_id] = [];
        }
        monthlyHistoryMap[item.ea_id].push(item);
        if (item.year_month) allMonthsSet.add(item.year_month);
      });
    }

    const availableMonths = Array.from(allMonthsSet).sort((a, b) => b.localeCompare(a));
    const latestMonth = availableMonths.length > 0 ? availableMonths[0] : '2026-08';

    // Update the title month dynamically
    const titleMonthElem = document.querySelector('.showcase-title-month');
    if (titleMonthElem) {
      const parts = latestMonth.replace('.', '-').split('-');
      if (parts.length >= 2) {
        titleMonthElem.textContent = `（${parts[0]}年${parseInt(parts[1], 10)}月度）`;
      }
    }

    const targetEAs = [];
    eaData.forEach(ea => {
      const clone = { ...ea };
      const monthData = (monthlyHistoryMap[ea.id] || []).find(m => m.year_month === latestMonth);
      if (!monthData) return;

      const retVal = parseFloat(monthData.monthly_return_percent) || 0;
      clone.raw_monthly_return = (retVal >= 0 ? '+' : '') + retVal.toFixed(2) + '%';
      if (parseFloat(monthData.profit_factor) > 0) clone.raw_pf = String(monthData.profit_factor);
      if (parseFloat(monthData.max_drawdown_percent) > 0) clone.raw_dd = String(monthData.max_drawdown_percent) + '%';
      clone.raw_win_rate = monthData.win_rate_percent ? String(monthData.win_rate_percent) + '%' : '-';

      clone.score_monthly_return = calcMonthlyReturnScore(retVal);

      const baseMonths = parsePeriodMonths(ea.raw_period);
      const elapsedMonths = baseMonths; // Because we're at latestMonth, diff is 0
      clone.score_period = calcPeriodScore(elapsedMonths);

      const past12 = (monthlyHistoryMap[ea.id] || []).slice(-12);
      const winMonths = past12.filter(m => (parseFloat(m.monthly_return_percent) || 0) > 0).length;
      clone.score_stability = calcStabilityScore(winMonths);

      const fixedScores = (ea.score_pf || 0) + (ea.score_rf || 0) + (ea.score_dd || 0);
      clone.total_score = clone.score_monthly_return + fixedScores + clone.score_period + clone.score_stability;
      clone.rank_badge = calcRankBadge(clone.total_score);

      targetEAs.push(clone);
    });

    const sorted = [...targetEAs].sort((a, b) => {
      const diffScore = (b.total_score || 0) - (a.total_score || 0);
      if (diffScore !== 0) return diffScore;
      const diffReturn = parseNum(b.raw_monthly_return) - parseNum(a.raw_monthly_return);
      if (diffReturn !== 0) return diffReturn;
      const diffPF = parseNum(b.raw_pf) - parseNum(a.raw_pf);
      if (diffPF !== 0) return diffPF;
      return parseNum(a.raw_dd) - parseNum(b.raw_dd);
    });

    const top3 = sorted.slice(0, 3);
    const container = document.querySelector('.top3-grid');
    if (container && top3.length > 0) {
      container.innerHTML = '';
      
      const rankClasses = ['rank-1-card', 'rank-2-card', 'rank-3-card'];
      const crowns = [
        { class: 'gold', icon: 'fa-crown', text: '総合第1位' },
        { class: 'silver', icon: 'fa-medal', text: '総合第2位' },
        { class: 'bronze', icon: 'fa-award', text: '総合第3位' }
      ];

      top3.forEach((ea, index) => {
        const thumbnail = ea.image_url || 'images/administrator.png';
        const rankClass = rankClasses[index] || 'rank-3-card';
        const crown = crowns[index] || crowns[2];
        const rankBadgeClass = ea.rank_badge ? ea.rank_badge.toLowerCase() : 's';
        
        const cardHtml = `
          <div class="podium-card ${rankClass}">
            <div class="podium-crown ${crown.class}">
              <i class="fa-solid ${crown.icon}"></i> ${crown.text} (${ea.rank_badge}ランク)
            </div>
            <div class="podium-ea-header">
              <img src="${thumbnail}" alt="${ea.name}" class="podium-thumb" onerror="this.src='images/administrator.png'">
              <div class="podium-ea-info">
                <span class="podium-rank-badge ${rankBadgeClass}">${ea.rank_badge} RANK</span>
                <div class="podium-ea-name" title="${ea.name}">${ea.name}</div>
                <div class="podium-pair-tag"><i class="fa-solid fa-coins"></i> ${ea.currency_pair || 'XAUUSD'} / ${ea.timeframe || 'H1'}</div>
              </div>
            </div>
            <div class="podium-score-row">
              <span class="podium-score-label">総合AIスコア</span>
              <span class="podium-score-val ${crown.class}">${ea.total_score} <span class="max-pts">/ 100 pt</span></span>
            </div>
            <div class="podium-stats-mini">
              <div class="mini-stat">
                <span class="mini-label">当月利回り</span>
                <span class="mini-val green">${ea.raw_monthly_return}</span>
              </div>
              <div class="mini-stat">
                <span class="mini-label">最大DD</span>
                <span class="mini-val">${ea.raw_dd}</span>
              </div>
              <div class="mini-stat">
                <span class="mini-label">PF</span>
                <span class="mini-val">${ea.raw_pf}</span>
              </div>
              <div class="mini-stat">
                <span class="mini-label">勝率</span>
                <span class="mini-val">${ea.raw_win_rate}</span>
              </div>
            </div>
            <a href="detail.html?ea=${ea.ea_key || ea.id}&month=${latestMonth}" class="btn-podium-action ${crown.class}">
              <span>詳細検証データを見る</span>
              <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);
      });
    }

  } catch (error) {
    console.error('Error fetching top 3 EAs:', error);
  }
}
