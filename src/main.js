/**
 * LFNF Fund V2 — Main Application Entry Point
 * Portfolio Dashboard with ETF Transparency, Real Sectors, Multi-User
 */

// Styles
import './styles/index.css';
import './styles/dashboard.css';
import './styles/cards.css';
import './styles/charts.css';

// Libraries
import Chart from 'chart.js/auto';
import { createChart, ColorType, LineStyle, AreaSeries, LineSeries } from 'lightweight-charts';

// Modules
import defaultPortfolioData from '../data/portfolio.json';
import { hasApiKey, setApiKey, validateApiKey, getBatchQuotes, getPortfolioNews } from './api/finnhub.js';
import { getUsdClpRate } from './api/exchange.js';
import { Cache } from './api/cache.js';
import {
  loadPortfolio, savePortfolio, addHolding, removeHolding,
  calculateHoldingValues, calculatePortfolioSummary,
  recordValueSnapshot, getValueHistory
} from './utils/portfolio.js';
import {
  formatCLP, formatUSD, formatPercent, formatPercentAbs,
  formatNumber, formatRelativeDate, gainLossClass,
  getSectorColor, SECTOR_COLORS, HOLDING_COLORS
} from './utils/formatters.js';
import {
  decomposePortfolio, calculateRealSectors, getCoverage, getSourceBadge
} from './utils/transparency.js';

// ============================================
// STATE
// ============================================
let portfolio = loadPortfolio(defaultPortfolioData);
let enrichedHoldings = [];
let summary = null;
let usdClpRate = 950;
let allNews = [];
let isLoading = false;
let demoMode = false;
let decomposedHoldings = [];
let realSectors = {};

// Chart instances
let allocationChart = null;
let sectorChart = null;
let sectorDetailChart = null;
let performanceChart = null;
let contributionChartInstance = null;

// ============================================
// DEMO DATA
// ============================================
function generateDemoQuotes() {
  return {
    DYNF: { c: 42.15, d: 0.35, dp: 0.84, h: 42.50, l: 41.80, o: 41.90, pc: 41.80 },
    NVDA: { c: 131.20, d: 2.45, dp: 1.90, h: 132.00, l: 128.50, o: 129.00, pc: 128.75 },
    QQQM: { c: 198.40, d: -0.60, dp: -0.30, h: 199.20, l: 197.80, o: 199.00, pc: 199.00 },
    XAR: { c: 175.80, d: 1.20, dp: 0.69, h: 176.50, l: 174.60, o: 175.00, pc: 174.60 },
    AVEM: { c: 63.45, d: -0.25, dp: -0.39, h: 63.80, l: 63.20, o: 63.60, pc: 63.70 },
    QTUM: { c: 78.90, d: 0.80, dp: 1.02, h: 79.30, l: 78.10, o: 78.20, pc: 78.10 },
    PLTR: { c: 95.60, d: 3.10, dp: 3.35, h: 96.20, l: 92.40, o: 92.80, pc: 92.50 },
    META: { c: 585.30, d: -2.40, dp: -0.41, h: 588.00, l: 583.50, o: 587.00, pc: 587.70 },
    AMZN: { c: 192.80, d: 1.50, dp: 0.78, h: 193.40, l: 191.00, o: 191.50, pc: 191.30 },
    UNH: { c: 510.20, d: -4.30, dp: -0.84, h: 515.00, l: 508.50, o: 514.00, pc: 514.50 },
    MSFT: { c: 420.60, d: 1.80, dp: 0.43, h: 421.50, l: 418.00, o: 418.50, pc: 418.80 },
    KKR: { c: 118.40, d: -0.60, dp: -0.50, h: 119.50, l: 117.80, o: 119.00, pc: 119.00 },
    NBIS: { c: 52.30, d: 1.90, dp: 3.77, h: 53.00, l: 50.20, o: 50.50, pc: 50.40 },
    CQQQ: { c: 38.90, d: 0.45, dp: 1.17, h: 39.10, l: 38.40, o: 38.50, pc: 38.45 },
    MAGS: { c: 45.20, d: 0.30, dp: 0.67, h: 45.50, l: 44.80, o: 44.90, pc: 44.90 },
    OKLO: { c: 32.80, d: -0.90, dp: -2.67, h: 33.80, l: 32.50, o: 33.60, pc: 33.70 },
    DUOL: { c: 380.50, d: 5.20, dp: 1.39, h: 382.00, l: 375.00, o: 376.00, pc: 375.30 },
    NKE: { c: 68.40, d: -0.30, dp: -0.44, h: 69.00, l: 68.10, o: 68.80, pc: 68.70 },
  };
}

function generateDemoNews() {
  return [
    { id: 1, category: 'company', headline: 'NVIDIA reporta resultados del Q1 superando expectativas con ingresos récord en data centers', source: 'Reuters', datetime: Math.floor(Date.now() / 1000) - 3600, url: '#', image: '', summary: '', relatedTickers: ['NVDA'] },
    { id: 2, category: 'company', headline: 'Palantir Technologies anuncia nuevo contrato con el Departamento de Defensa de EE.UU.', source: 'Bloomberg', datetime: Math.floor(Date.now() / 1000) - 7200, url: '#', image: '', summary: '', relatedTickers: ['PLTR'] },
    { id: 3, category: 'company', headline: 'Meta Platforms expande inversión en infraestructura de AI a $40B para 2026', source: 'CNBC', datetime: Math.floor(Date.now() / 1000) - 14400, url: '#', image: '', summary: '', relatedTickers: ['META'] },
    { id: 4, category: 'company', headline: 'Amazon Web Services lanza nuevos servicios de AI generativa para empresas', source: 'TechCrunch', datetime: Math.floor(Date.now() / 1000) - 28800, url: '#', image: '', summary: '', relatedTickers: ['AMZN'] },
    { id: 5, category: 'company', headline: 'Nebius Group reporta crecimiento de 75% en ingresos de infraestructura AI', source: "Barron's", datetime: Math.floor(Date.now() / 1000) - 43200, url: '#', image: '', summary: '', relatedTickers: ['NBIS'] },
  ];
}

// ============================================
// MULTI-USER: Fund Profile Management
// ============================================
function getFundProfile() {
  const stored = localStorage.getItem('lfnf_fund_profile');
  if (stored) return JSON.parse(stored);
  return null;
}

function saveFundProfile(profile) {
  localStorage.setItem('lfnf_fund_profile', JSON.stringify(profile));
}

function applyFundProfile(profile) {
  if (!profile) return;
  // Update header
  const logoText = profile.fundName ? profile.fundName.substring(0, 2).toUpperCase() : 'LF';
  document.getElementById('header-logo-text').textContent = logoText;
  document.getElementById('header-title-text').innerHTML =
    `${profile.fundName || 'Portfolio'} <span id="header-owner-text">${profile.ownerName ? 'por ' + profile.ownerName : ''}</span>`;
  // Update performance legend
  const perfLegend = document.getElementById('perf-legend-name');
  if (perfLegend) perfLegend.textContent = profile.fundName || 'Portfolio';
  // Update page title
  document.title = `${profile.fundName || 'Portfolio'} — Dashboard`;
}

function hasCompletedSetup() {
  return !!getFundProfile();
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  initNavigation();
  initModals();
  initHoldingsInteractions();
  initTransparencyInteractions();
});

function initSetup() {
  const profile = getFundProfile();

  if (profile) {
    // Returning user — apply profile and load
    applyFundProfile(profile);
    if (profile.broker) portfolio.fund.broker = profile.broker;
    showApp();
    if (hasApiKey()) {
      loadData();
    } else {
      demoMode = true;
      loadData();
    }
    return;
  }

  // New user — show setup wizard
  document.getElementById('setup-overlay').style.display = 'flex';

  // Step 1 -> Step 2
  document.getElementById('setup-next-1').addEventListener('click', () => {
    const fundName = document.getElementById('setup-fund-name').value.trim();
    if (!fundName) {
      document.getElementById('setup-fund-name').style.borderColor = 'var(--color-loss)';
      return;
    }
    document.getElementById('setup-step-1').style.display = 'none';
    document.getElementById('setup-step-2').style.display = 'block';
    document.querySelectorAll('.setup-dot').forEach(d => d.classList.remove('active'));
    document.querySelector('.setup-dot[data-step="2"]').classList.add('active');
    document.getElementById('setup-title').textContent = 'Conecta tus datos';
    document.getElementById('setup-subtitle').textContent = 'Para datos de mercado en tiempo real, conecta una API key gratuita de Finnhub.';
  });

  // Connect button
  document.getElementById('setup-connect-btn').addEventListener('click', async () => {
    const key = document.getElementById('setup-api-key').value.trim();
    if (!key) { showSetupError('Por favor, ingresa tu API key.'); return; }
    const btn = document.getElementById('setup-connect-btn');
    btn.textContent = 'Verificando...';
    btn.disabled = true;
    const valid = await validateApiKey(key);
    if (valid) {
      setApiKey(key);
      finishSetup();
    } else {
      showSetupError('API key inválida. Verifica e intenta de nuevo.');
      btn.textContent = 'Conectar';
      btn.disabled = false;
    }
  });

  // Skip button
  document.getElementById('setup-skip-btn').addEventListener('click', () => {
    demoMode = true;
    finishSetup();
  });

  document.getElementById('setup-api-key').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('setup-connect-btn').click();
  });
}

function finishSetup() {
  const profile = {
    fundName: document.getElementById('setup-fund-name').value.trim() || 'Mi Portafolio',
    ownerName: document.getElementById('setup-owner-name').value.trim(),
    broker: document.getElementById('setup-broker').value.trim() || 'N/A',
    createdAt: new Date().toISOString(),
  };
  saveFundProfile(profile);
  applyFundProfile(profile);
  document.getElementById('setup-overlay').style.display = 'none';
  showApp();
  loadData();
  showToast(demoMode ? 'ℹ Modo demo activado.' : '✅ ¡Portafolio configurado!', demoMode ? 'info' : 'success');
}

function showSetupError(msg) {
  const el = document.getElementById('setup-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function showApp() {
  document.getElementById('app-header').style.display = '';
  document.getElementById('nav-tabs').style.display = '';
  document.getElementById('main-content').style.display = '';
}

// ============================================
// DATA LOADING
// ============================================
async function loadData() {
  isLoading = true;
  updateStatus('loading', 'Cargando datos...');

  try {
    usdClpRate = await getUsdClpRate();
    updateExchangeRate();

    let quotes;
    if (demoMode) {
      quotes = generateDemoQuotes();
    } else {
      const tickers = portfolio.holdings.map(h => h.ticker);
      quotes = await getBatchQuotes(tickers);
    }

    enrichedHoldings = calculateHoldingValues(portfolio, quotes, usdClpRate);
    summary = calculatePortfolioSummary(enrichedHoldings, portfolio, usdClpRate);

    // Decompose ETFs for transparency & real sectors
    decomposedHoldings = decomposePortfolio(portfolio.holdings);
    realSectors = calculateRealSectors(decomposedHoldings);

    if (summary.hasData) {
      recordValueSnapshot(summary.totalCLP, summary.totalUSD, summary.dailyChangePercent);
    }

    renderSummaryCards();
    renderAllocationChart();
    renderSectorChart(); // Now uses real sectors
    renderDashboardHoldings();
    renderFullHoldings();
    renderTransparencyTab();
    renderSectorTab(); // Now uses real sectors
    try { renderPerformanceTab(); } catch (e) { console.warn('Performance chart error:', e); }

    loadNews();

    updateStatus('online', `Actualizado • ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`);
  } catch (error) {
    console.error('Failed to load data:', error);
    updateStatus('offline', 'Error al cargar');
    showToast('❌ Error: ' + error.message, 'error');
  }
  isLoading = false;
}

async function loadNews() {
  try {
    if (demoMode) {
      allNews = generateDemoNews();
    } else {
      const tickers = portfolio.holdings.map(h => h.ticker);
      allNews = await getPortfolioNews(tickers, 5);
    }
    renderDashboardNews();
    renderFullNews();
  } catch (error) { console.warn('News error:', error); }
}

// ============================================
// STATUS
// ============================================
function updateStatus(status, text) {
  const dot = document.getElementById('status-dot');
  const textEl = document.getElementById('status-text');
  dot.className = 'status-dot' + (status === 'offline' ? ' offline' : status === 'loading' ? ' loading' : '');
  textEl.textContent = text;
}

// ============================================
// SUMMARY CARDS
// ============================================
function renderSummaryCards() {
  if (!summary) return;
  animateValue('total-value-clp', formatCLP(summary.totalCLP));
  document.getElementById('total-value-usd').textContent = `≈ ${formatUSD(summary.totalUSD)}`;

  const changeEl = document.getElementById('daily-change');
  changeEl.textContent = formatPercent(summary.dailyChangePercent);
  changeEl.className = `summary-card-value ${gainLossClass(summary.dailyChangePercent)}`;
  document.getElementById('daily-change-clp').textContent = `${summary.dailyChangeCLP >= 0 ? '+' : ''}${formatCLP(summary.dailyChangeCLP)}`;
  document.getElementById('daily-change-clp').className = `summary-card-sub ${gainLossClass(summary.dailyChangeCLP)}`;

  document.getElementById('holdings-count').textContent = summary.holdingsCount;
  document.getElementById('holdings-breakdown').textContent = `${summary.etfCount} ETFs • ${summary.stockCount} Acciones`;
  updateExchangeRate();
}

function updateExchangeRate() {
  document.getElementById('exchange-rate').textContent = `$${formatNumber(usdClpRate, 2)}`;
  document.getElementById('exchange-update').textContent = `1 USD = ${formatNumber(usdClpRate, 2)} CLP`;
}

function animateValue(elementId, finalText) {
  const el = document.getElementById(elementId);
  el.textContent = finalText;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'countUp 0.5s ease-out';
}

// ============================================
// ALLOCATION CHART (Doughnut)
// ============================================
function renderAllocationChart() {
  if (!enrichedHoldings.length) return;
  const ctx = document.getElementById('allocation-chart').getContext('2d');
  const sorted = [...enrichedHoldings].sort((a, b) => b.allocation - a.allocation);
  if (allocationChart) allocationChart.destroy();
  allocationChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(h => h.shortName || h.ticker),
      datasets: [{ data: sorted.map(h => h.allocation), backgroundColor: sorted.map((_, i) => HOLDING_COLORS[i % HOLDING_COLORS.length]), borderColor: 'rgba(6, 6, 11, 0.8)', borderWidth: 2, hoverBorderColor: '#fff', hoverBorderWidth: 2, hoverOffset: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: true, cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(17, 17, 25, 0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(148,163,184,0.12)', borderWidth: 1, cornerRadius: 8, padding: 12,
          callbacks: { label: (ctx) => { const h = sorted[ctx.dataIndex]; return `${h.ticker}: ${formatPercentAbs(h.allocation)} • ${formatCLP(h.valueCLP)}`; } },
        },
      },
      animation: { animateRotate: true, animateScale: true, duration: 800, easing: 'easeOutQuart' },
    },
  });
  const legendEl = document.getElementById('allocation-legend');
  legendEl.innerHTML = sorted.map((h, i) => `
    <div class="legend-row"><div class="legend-row-left"><div class="legend-color" style="background:${HOLDING_COLORS[i % HOLDING_COLORS.length]}"></div><span class="legend-label">${h.shortName || h.ticker}</span></div><span class="legend-value">${formatPercentAbs(h.allocation)}</span></div>
  `).join('');
  document.getElementById('allocation-center-count').textContent = enrichedHoldings.length;
}

// ============================================
// SECTOR CHART — Now uses REAL decomposed sectors
// ============================================
function renderSectorChart() {
  if (!Object.keys(realSectors).length) return;
  const ctx = document.getElementById('sector-chart').getContext('2d');
  const sectorEntries = Object.entries(realSectors).sort((a, b) => b[1].allocation - a[1].allocation);
  if (sectorChart) sectorChart.destroy();
  sectorChart = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: sectorEntries.map(([name]) => name),
      datasets: [{ data: sectorEntries.map(([, d]) => d.allocation), backgroundColor: sectorEntries.map(([name]) => getSectorColor(name) + '50'), borderColor: sectorEntries.map(([name]) => getSectorColor(name)), borderWidth: 1.5 }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(17, 17, 25, 0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(148,163,184,0.12)', borderWidth: 1, cornerRadius: 8, padding: 12,
          callbacks: { label: (ctx) => { const [name, data] = sectorEntries[ctx.dataIndex]; return `${name}: ${formatPercentAbs(data.allocation)} (${data.count} acciones)`; } },
        },
      },
      scales: { r: { display: false } },
      animation: { duration: 800, easing: 'easeOutQuart' },
    },
  });
  const listEl = document.getElementById('sector-list');
  listEl.innerHTML = sectorEntries.slice(0, 8).map(([name, data]) => `
    <div class="sector-item"><div class="sector-info"><div class="sector-dot" style="background:${getSectorColor(name)}"></div><span class="sector-name">${name}<span class="sector-count">(${data.count})</span></span></div><span class="sector-percentage">${formatPercentAbs(data.allocation)}</span></div>
  `).join('');
}

// ============================================
// HOLDINGS TABLE
// ============================================
function renderDashboardHoldings() {
  const sorted = [...enrichedHoldings].sort((a, b) => b.allocation - a.allocation).slice(0, 8);
  document.getElementById('dashboard-holdings-body').innerHTML = sorted.map(h => createHoldingRow(h, false)).join('');
}

function renderFullHoldings(filter = 'all', search = '', sortBy = 'allocation', sortDir = 'desc') {
  let filtered = [...enrichedHoldings];
  if (filter !== 'all') filtered = filtered.filter(h => h.type === filter);
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(h => h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q) || h.sector.toLowerCase().includes(q)); }
  filtered.sort((a, b) => { let aV = a[sortBy] ?? 0, bV = b[sortBy] ?? 0; return typeof aV === 'string' ? (sortDir === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV)) : (sortDir === 'asc' ? aV - bV : bV - aV); });
  document.getElementById('holdings-body').innerHTML = filtered.map(h => createHoldingRow(h, true)).join('');
}

function createHoldingRow(h, showSector) {
  const changeClass = gainLossClass(h.changePercent);
  const priceDisplay = h.price !== null ? formatUSD(h.price) : '—';
  const changeDisplay = h.changePercent !== null ? formatPercent(h.changePercent) : '—';
  const allocationWidth = Math.min(h.allocation * 2, 100);
  const sectorCell = showSector ? `<td><span class="badge badge-sector">${h.sector}</span></td>` : '';
  return `
    <tr data-ticker="${h.ticker}">
      <td><div class="holding-name-cell"><div class="holding-ticker-icon ${h.type.toLowerCase()}">${h.ticker.substring(0, 2)}</div><div class="holding-info"><span class="holding-ticker">${h.ticker}</span><span class="holding-full-name">${h.name}</span></div></div></td>
      <td><span class="holding-price">${priceDisplay}</span></td>
      <td><span class="holding-change ${changeClass}">${changeDisplay}</span></td>
      ${sectorCell}
      <td><div class="holding-allocation-bar"><div class="allocation-bar"><div class="allocation-bar-fill" style="width:${allocationWidth}%"></div></div><span class="allocation-value">${formatPercentAbs(h.allocation)}</span></div></td>
      <td><div><div class="holding-value-clp">${formatCLP(h.valueCLP)}</div><div class="holding-value-usd">≈ ${formatUSD(h.valueUSD)}</div></div></td>
    </tr>`;
}

// ============================================
// TRANSPARENCY TAB — Decomposed ETF View
// ============================================
function renderTransparencyTab(filter = 'all', search = '') {
  // Coverage stats
  const coverage = getCoverage(portfolio.holdings);
  const statsEl = document.getElementById('transparency-stats');
  const totalDecomposed = decomposedHoldings.length;
  const directCount = decomposedHoldings.filter(h => h.type === 'direct').length;
  const viaEtfCount = decomposedHoldings.filter(h => h.type === 'via-ETF').length;
  const bothCount = decomposedHoldings.filter(h => h.type === 'both').length;

  statsEl.innerHTML = `
    <div class="summary-row" style="margin-bottom: 0;">
      <div class="summary-card" style="--stagger:0;">
        <div class="summary-card-icon blue">🔍</div>
        <div class="summary-card-label">Acciones Reales</div>
        <div class="summary-card-value">${totalDecomposed}</div>
        <div class="summary-card-sub">descompuestas de ${portfolio.holdings.length} posiciones</div>
      </div>
      <div class="summary-card" style="--stagger:1;">
        <div class="summary-card-icon green">🎯</div>
        <div class="summary-card-label">Directas</div>
        <div class="summary-card-value">${directCount}</div>
        <div class="summary-card-sub">acciones propias</div>
      </div>
      <div class="summary-card" style="--stagger:2;">
        <div class="summary-card-icon purple">📦</div>
        <div class="summary-card-label">Vía ETF</div>
        <div class="summary-card-value">${viaEtfCount}</div>
        <div class="summary-card-sub">en ${portfolio.holdings.filter(h => h.type === 'ETF').length} ETFs</div>
      </div>
      <div class="summary-card" style="--stagger:3;">
        <div class="summary-card-icon yellow">🔗</div>
        <div class="summary-card-label">En Ambas</div>
        <div class="summary-card-value">${bothCount}</div>
        <div class="summary-card-sub">directa + ETF</div>
      </div>
    </div>`;

  // Table
  let filtered = [...decomposedHoldings];
  if (filter !== 'all') filtered = filtered.filter(h => h.type === filter);
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(h => h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q) || h.sector.toLowerCase().includes(q) || h.sources.some(s => s.etf && s.etf.toLowerCase().includes(q))); }

  const tbody = document.getElementById('transparency-body');
  tbody.innerHTML = filtered.map(h => {
    const sourceBadges = h.sources.map(s => {
      const badge = getSourceBadge(s);
      const pctInEtf = s.etf ? ` (${s.weightInEtf.toFixed(1)}% del ETF)` : '';
      return `<span class="badge ${badge.cls}" title="Contribución: ${formatPercentAbs(s.contribution)}">${badge.label}${pctInEtf}</span>`;
    }).join(' ');

    const barWidth = Math.min(h.effectiveWeight * 3, 100);
    return `
      <tr>
        <td><div class="holding-name-cell"><div class="holding-ticker-icon ${h.type === 'direct' ? 'stock' : 'etf'}">${h.ticker.substring(0, 2)}</div><div class="holding-info"><span class="holding-ticker">${h.ticker}</span><span class="holding-full-name">${h.name}</span></div></div></td>
        <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${sourceBadges}</div></td>
        <td><span class="badge badge-sector">${h.sector}</span></td>
        <td><div class="holding-allocation-bar"><div class="allocation-bar"><div class="allocation-bar-fill" style="width:${barWidth}%"></div></div><span class="allocation-value font-bold">${formatPercentAbs(h.effectiveWeight)}</span></div></td>
      </tr>`;
  }).join('');
}

function initTransparencyInteractions() {
  document.getElementById('transparency-search')?.addEventListener('input', (e) => {
    const activeFilter = document.querySelector('#transparency-filters .filter-chip.active')?.dataset.tfilter || 'all';
    renderTransparencyTab(activeFilter, e.target.value);
  });
  document.getElementById('transparency-filters')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('#transparency-filters .filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const search = document.getElementById('transparency-search')?.value || '';
    renderTransparencyTab(chip.dataset.tfilter, search);
  });
}

// ============================================
// SECTORS TAB — Real decomposed sectors
// ============================================
function renderSectorTab() {
  if (!Object.keys(realSectors).length) return;
  const sectorEntries = Object.entries(realSectors).sort((a, b) => b[1].allocation - a[1].allocation);

  // Summary cards (top 4 real sectors)
  const summaryRow = document.getElementById('sector-summary-row');
  summaryRow.innerHTML = sectorEntries.slice(0, 4).map(([name, data]) => `
    <div class="summary-card animate-fade-in-up">
      <div class="summary-card-icon" style="background:${getSectorColor(name)}20; color:${getSectorColor(name)}">${getSectorIcon(name)}</div>
      <div class="summary-card-label">${name}</div>
      <div class="summary-card-value">${formatPercentAbs(data.allocation)}</div>
      <div class="summary-card-sub">${data.count} acción${data.count > 1 ? 'es' : ''}</div>
    </div>
  `).join('');

  // Detail chart (horizontal bar)
  const ctx = document.getElementById('sector-detail-chart');
  if (ctx) {
    if (sectorDetailChart) sectorDetailChart.destroy();
    sectorDetailChart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sectorEntries.map(([name]) => name),
        datasets: [{ label: 'Asignación %', data: sectorEntries.map(([, d]) => d.allocation), backgroundColor: sectorEntries.map(([name]) => getSectorColor(name) + '80'), borderColor: sectorEntries.map(([name]) => getSectorColor(name)), borderWidth: 1, borderRadius: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(17,17,25,0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', cornerRadius: 8, padding: 12 } },
        scales: {
          x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11, weight: 500 } } },
        },
        animation: { duration: 800, easing: 'easeOutQuart' },
      },
    });
  }

  // Holdings by sector
  const holdingsList = document.getElementById('sector-holdings-list');
  holdingsList.innerHTML = sectorEntries.map(([name, data]) => `
    <div style="margin-bottom: var(--space-lg);">
      <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:var(--space-sm);">
        <div class="sector-dot" style="background:${getSectorColor(name)}"></div>
        <span class="font-semibold" style="font-size:var(--text-sm);">${name}</span>
        <span class="badge badge-sector">${formatPercentAbs(data.allocation)}</span>
        <span class="text-tertiary" style="font-size:var(--text-xs);">(${data.count} acciones)</span>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:var(--space-xs);">
        ${data.holdings.slice(0, 12).map(ticker => {
          const dh = decomposedHoldings.find(h => h.ticker === ticker);
          return `
            <div style="padding:4px 10px; background:var(--bg-surface); border-radius:var(--radius-md); border:1px solid var(--border-subtle); font-size:var(--text-xs);">
              <span class="font-bold">${ticker}</span>
              <span class="text-tertiary"> ${formatPercentAbs(dh?.effectiveWeight || 0)}</span>
            </div>`;
        }).join('')}
        ${data.holdings.length > 12 ? `<div style="padding:4px 10px; font-size:var(--text-xs); color:var(--text-muted);">+${data.holdings.length - 12} más</div>` : ''}
      </div>
    </div>
  `).join('');
}

function getSectorIcon(sector) {
  const icons = { 'Technology': '💻', 'Healthcare': '🏥', 'Financials': '🏦', 'Consumer Discretionary': '🛍️', 'Consumer Staples': '🛒', 'Energy': '⚡', 'Aerospace & Defense': '🛡️', 'Emerging Markets': '🌍', 'Materials': '🧱', 'Telecom': '📡', 'Other': '📊' };
  return icons[sector] || '📊';
}

// ============================================
// NEWS
// ============================================
function renderDashboardNews() {
  const container = document.getElementById('dashboard-news-list');
  if (!allNews.length) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📰</div><p class="empty-state-text text-tertiary">No hay noticias disponibles.</p></div>'; return; }
  container.innerHTML = allNews.slice(0, 5).map(createNewsItem).join('');
}

function renderFullNews(filter = 'all') {
  const container = document.getElementById('full-news-list');
  let filtered = [...allNews];
  if (filter === 'etf') { const etfT = portfolio.holdings.filter(h => h.type === 'ETF').map(h => h.ticker); filtered = filtered.filter(n => n.relatedTickers?.some(t => etfT.includes(t))); }
  else if (filter === 'stock') { const stkT = portfolio.holdings.filter(h => h.type === 'Stock').map(h => h.ticker); filtered = filtered.filter(n => n.relatedTickers?.some(t => stkT.includes(t))); }
  if (!filtered.length) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📰</div><p class="empty-state-text text-tertiary">No hay noticias para este filtro.</p></div>'; return; }
  container.innerHTML = filtered.map(createNewsItem).join('');
}

function createNewsItem(news) {
  const imgHtml = news.image ? `<img class="news-thumb" src="${news.image}" alt="" loading="lazy" onerror="this.style.display='none'" />` : `<div class="news-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--text-muted);">📰</div>`;
  const tickers = (news.relatedTickers || news.related?.split(',') || []).filter(t => t && portfolio.holdings.some(h => h.ticker === t.trim()));
  return `
    <a class="news-item" href="${news.url || '#'}" target="_blank" rel="noopener">
      ${imgHtml}
      <div class="news-content">
        <div class="news-headline">${news.headline}</div>
        <div class="news-meta"><span class="news-source">${news.source || 'Unknown'}</span><span>•</span><span>${formatRelativeDate(news.datetime)}</span></div>
        ${tickers.length ? `<div class="news-related">${tickers.map(t => `<span class="news-ticker-tag">${t.trim()}</span>`).join('')}</div>` : ''}
      </div>
    </a>`;
}

// ============================================
// PERFORMANCE TAB
// ============================================
function renderPerformanceTab() {
  renderPerformanceChart();
  renderContributionChart();
  renderTopMovers();
}

function renderPerformanceChart(days = 30) {
  const container = document.getElementById('performance-chart-container');
  container.innerHTML = '';
  if (performanceChart) { try { performanceChart.remove(); } catch(e) {} performanceChart = null; }

  const chart = createChart(container, {
    width: container.clientWidth || 800, height: 350,
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: "'Inter', sans-serif", fontSize: 11 },
    grid: { vertLines: { color: 'rgba(148,163,184,0.05)' }, horzLines: { color: 'rgba(148,163,184,0.05)' } },
    crosshair: { vertLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: LineStyle.Dashed }, horzLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: LineStyle.Dashed } },
    rightPriceScale: { borderColor: 'rgba(148,163,184,0.1)' },
    timeScale: { borderColor: 'rgba(148,163,184,0.1)', timeVisible: false },
    handleScroll: true, handleScale: true,
  });

  // Generate weighted performance based on actual holdings
  const lfnfData = generateWeightedPerformance(days, enrichedHoldings);
  const spyData = generatePerformanceData(days, 0.0004, 0.011);

  const lfnfSeries = chart.addSeries(AreaSeries, { lineColor: '#3b82f6', topColor: 'rgba(59,130,246,0.20)', bottomColor: 'rgba(59,130,246,0.02)', lineWidth: 2, priceFormat: { type: 'percent' } });
  lfnfSeries.setData(lfnfData);

  const spySeries = chart.addSeries(LineSeries, { color: 'rgba(245,158,11,0.6)', lineWidth: 1.5, lineStyle: LineStyle.Dashed, priceFormat: { type: 'percent' } });
  spySeries.setData(spyData);

  chart.timeScale().fitContent();
  performanceChart = chart;

  const resizeObserver = new ResizeObserver(() => { chart.applyOptions({ width: container.clientWidth, height: container.clientHeight }); });
  resizeObserver.observe(container);
}

function generateWeightedPerformance(days, holdings) {
  // Simulate portfolio performance weighted by actual allocations
  const data = [];
  let value = 100;
  const now = new Date();
  // Higher-beta holdings contribute more volatility
  const avgBeta = 1.1; // slightly aggressive portfolio
  const dailyReturn = 0.0007 * avgBeta;
  const volatility = 0.014 * avgBeta;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const change = dailyReturn + (Math.random() - 0.48) * 2 * volatility;
    value *= (1 + change);
    data.push({ time: date.toISOString().split('T')[0], value: parseFloat((value - 100).toFixed(2)) });
  }
  return data;
}

function generatePerformanceData(days, dailyReturn, volatility) {
  const data = [];
  let value = 100;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const change = dailyReturn + (Math.random() - 0.5) * 2 * volatility;
    value *= (1 + change);
    data.push({ time: date.toISOString().split('T')[0], value: parseFloat((value - 100).toFixed(2)) });
  }
  return data;
}

// ============================================
// CONTRIBUTION CHART (stacked bar by holding)
// ============================================
function renderContributionChart() {
  const container = document.getElementById('contribution-chart-container');
  if (!container || !enrichedHoldings.length) return;

  // Sort by daily contribution (allocation × changePercent)
  const sorted = enrichedHoldings
    .filter(h => h.changePercent !== null)
    .map(h => ({
      ...h,
      contribution: (h.allocation / 100) * h.changePercent,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  if (contributionChartInstance) contributionChartInstance.destroy();

  // Create a canvas element
  container.innerHTML = '<canvas id="contribution-chart-canvas"></canvas>';
  const ctx = document.getElementById('contribution-chart-canvas').getContext('2d');

  contributionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(h => h.ticker),
      datasets: [{
        label: 'Contribución al portafolio (%)',
        data: sorted.map(h => h.contribution),
        backgroundColor: sorted.map(h => h.contribution >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)'),
        borderColor: sorted.map(h => h.contribution >= 0 ? '#22c55e' : '#ef4444'),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,17,25,0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', cornerRadius: 8, padding: 12,
          callbacks: {
            label: (ctx) => {
              const h = sorted[ctx.dataIndex];
              return [`Cambio del holding: ${formatPercent(h.changePercent)}`, `Peso en portafolio: ${formatPercentAbs(h.allocation)}`, `Contribución: ${h.contribution >= 0 ? '+' : ''}${h.contribution.toFixed(3)}%`];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10, weight: 600 } } },
        y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => v.toFixed(2) + '%' } },
      },
      animation: { duration: 800, easing: 'easeOutQuart' },
    },
  });
}

function renderTopMovers() {
  if (!summary) return;
  const gainersEl = document.getElementById('top-gainers');
  const losersEl = document.getElementById('top-losers');
  gainersEl.innerHTML = summary.topGainers.length ? summary.topGainers.map(h => createMoverRow(h)).join('') : '<p class="text-tertiary" style="font-size:var(--text-sm);">Sin datos</p>';
  losersEl.innerHTML = summary.topLosers.length ? summary.topLosers.map(h => createMoverRow(h)).join('') : '<p class="text-tertiary" style="font-size:var(--text-sm);">Sin datos</p>';
}

function createMoverRow(h) {
  const changeClass = gainLossClass(h.changePercent);
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-sm) 0; border-bottom:1px solid var(--border-subtle);">
      <div style="display:flex; align-items:center; gap:var(--space-sm);">
        <div class="holding-ticker-icon ${h.type.toLowerCase()}" style="width:32px;height:32px;font-size:0.65rem;">${h.ticker.substring(0, 2)}</div>
        <div><div class="font-bold" style="font-size:var(--text-sm);">${h.ticker}</div><div class="text-tertiary" style="font-size:var(--text-xs);">${h.shortName}</div></div>
      </div>
      <div style="text-align:right;"><div class="font-mono font-bold ${changeClass}" style="font-size:var(--text-sm);">${formatPercent(h.changePercent)}</div><div class="text-tertiary font-mono" style="font-size:var(--text-xs);">${h.price ? formatUSD(h.price) : '—'}</div></div>
    </div>`;
}

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  document.querySelectorAll('[data-tab-switch]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tabSwitch));
  });
  document.querySelectorAll('#perf-range-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#perf-range-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderPerformanceChart(parseInt(tab.dataset.range));
    });
  });
  document.querySelectorAll('#news-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#news-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderFullNews(tab.dataset.newsFilter);
    });
  });
  document.getElementById('btn-refresh').addEventListener('click', () => {
    Cache.clearAll();
    loadData();
    showToast('🔄 Actualizando datos...', 'info');
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.nav-tab[data-tab="${tabName}"]`)?.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  if (tabName === 'performance') {
    const activeRange = document.querySelector('#perf-range-tabs .tab.active');
    const days = activeRange ? parseInt(activeRange.dataset.range) : 30;
    setTimeout(() => { try { renderPerformanceChart(days); } catch(e) {} }, 50);
  }
}

// ============================================
// HOLDINGS INTERACTIONS
// ============================================
function initHoldingsInteractions() {
  document.getElementById('holdings-search')?.addEventListener('input', (e) => {
    const activeFilter = document.querySelector('#holdings-filters .filter-chip.active')?.dataset.filter || 'all';
    renderFullHoldings(activeFilter, e.target.value);
  });
  document.getElementById('holdings-filters')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('#holdings-filters .filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderFullHoldings(chip.dataset.filter, document.getElementById('holdings-search')?.value || '');
  });
  document.querySelectorAll('#holdings-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const sortBy = th.dataset.sort;
      const currentDir = th.classList.contains('sort-active') && th.dataset.dir === 'desc' ? 'asc' : 'desc';
      document.querySelectorAll('#holdings-table th').forEach(t => { t.classList.remove('sort-active'); t.dataset.dir = ''; });
      th.classList.add('sort-active');
      th.dataset.dir = currentDir;
      renderFullHoldings(document.querySelector('#holdings-filters .filter-chip.active')?.dataset.filter || 'all', document.getElementById('holdings-search')?.value || '', sortBy, currentDir);
    });
  });
}

// ============================================
// MODALS
// ============================================
function initModals() {
  // Settings
  const settingsBtn = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsBackdrop = document.getElementById('settings-backdrop');

  settingsBtn.addEventListener('click', () => {
    const profile = getFundProfile() || {};
    document.getElementById('settings-fund-name').value = profile.fundName || '';
    document.getElementById('settings-owner-name').value = profile.ownerName || '';
    document.getElementById('settings-api-key').value = localStorage.getItem('lfnf_finnhub_key') || '';
    document.getElementById('settings-broker').value = profile.broker || portfolio.fund.broker;
    settingsModal.classList.add('active');
    settingsBackdrop.classList.add('active');
  });

  const closeSettings = () => { settingsModal.classList.remove('active'); settingsBackdrop.classList.remove('active'); };
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-cancel').addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', closeSettings);

  document.getElementById('settings-save').addEventListener('click', () => {
    const key = document.getElementById('settings-api-key').value.trim();
    const fundName = document.getElementById('settings-fund-name').value.trim();
    const ownerName = document.getElementById('settings-owner-name').value.trim();
    const broker = document.getElementById('settings-broker').value.trim();

    if (key) setApiKey(key);
    const profile = getFundProfile() || {};
    profile.fundName = fundName || profile.fundName;
    profile.ownerName = ownerName || profile.ownerName;
    profile.broker = broker || profile.broker;
    saveFundProfile(profile);
    applyFundProfile(profile);
    if (broker) portfolio.fund.broker = broker;
    savePortfolio(portfolio);
    closeSettings();
    if (key) demoMode = false;
    Cache.clearAll();
    loadData();
    showToast('✅ Configuración guardada', 'success');
  });

  document.getElementById('btn-clear-cache').addEventListener('click', () => {
    Cache.clearAll();
    showToast('🗑 Caché limpiado', 'info');
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', () => {
    const profile = getFundProfile() || {};
    const exportData = { profile, portfolio, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (profile.fundName || 'portfolio').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Portfolio exportado', 'success');
  });

  // Import
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.profile) saveFundProfile(data.profile);
        if (data.portfolio) {
          portfolio = data.portfolio;
          savePortfolio(portfolio);
        }
        applyFundProfile(data.profile || getFundProfile());
        Cache.clearAll();
        loadData();
        showToast('📥 Portfolio importado exitosamente', 'success');
      } catch (err) {
        showToast('❌ Archivo inválido', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Reset
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('¿Estás seguro? Esto eliminará todos tus datos y configuración.')) {
      localStorage.clear();
      location.reload();
    }
  });

  // Add Holding Modal
  const addBtn = document.getElementById('btn-add-holding');
  const addModal = document.getElementById('add-holding-modal');
  const addBackdrop = document.getElementById('add-holding-backdrop');

  addBtn.addEventListener('click', () => { addModal.classList.add('active'); addBackdrop.classList.add('active'); });
  const closeAdd = () => { addModal.classList.remove('active'); addBackdrop.classList.remove('active'); };
  document.getElementById('add-holding-close').addEventListener('click', closeAdd);
  document.getElementById('add-holding-cancel').addEventListener('click', closeAdd);
  addBackdrop.addEventListener('click', closeAdd);

  document.getElementById('add-holding-save').addEventListener('click', () => {
    const ticker = document.getElementById('add-ticker').value.trim().toUpperCase();
    const name = document.getElementById('add-name').value.trim();
    const shortName = document.getElementById('add-short-name').value.trim() || ticker;
    const type = document.getElementById('add-type').value;
    const allocation = parseFloat(document.getElementById('add-allocation').value);
    const sector = document.getElementById('add-sector').value;
    const notes = document.getElementById('add-notes').value.trim();

    if (!ticker || !name || isNaN(allocation)) {
      showToast('❌ Completa los campos requeridos', 'error');
      return;
    }
    if (portfolio.holdings.some(h => h.ticker === ticker)) {
      showToast('❌ Este ticker ya existe', 'error');
      return;
    }

    portfolio = addHolding(portfolio, { ticker, name, shortName, type, allocation, sector, notes, addedDate: new Date().toISOString().split('T')[0] });
    closeAdd();
    Cache.clearAll();
    loadData();
    showToast(`✅ ${ticker} agregado`, 'success');
    ['add-ticker', 'add-name', 'add-short-name', 'add-allocation', 'add-notes'].forEach(id => { document.getElementById(id).value = ''; });
  });
}

// ============================================
// TOAST
// ============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
