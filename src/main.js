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
import { hasApiKey, setApiKey, validateApiKey, getBatchQuotes, getPortfolioNews, searchSymbols, getCandles } from './api/finnhub.js';
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
let displayCurrency = localStorage.getItem('lfnf_display_currency') || 'CLP'; // 'CLP' or 'USD'

// Chart instances
let allocationChart = null;
let sectorChart = null;
let sectorDetailChart = null;
let performanceChart = null;
let allHoldingsPerfChart = null;
let contributionChartInstance = null;
let holdingPerfChart = null;
let selectedHoldingPerfTicker = null;

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

// ============================================
// UTILITIES
// ============================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Temporary holdings list for onboarding wizard step 3
let setupHoldings = [];

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
    goToSetupStep(2);
  });

  // Step 2 -> Step 3 via Connect
  document.getElementById('setup-connect-btn').addEventListener('click', async () => {
    const key = document.getElementById('setup-api-key').value.trim();
    if (!key) { showSetupError('Por favor, ingresa tu API key.'); return; }
    const btn = document.getElementById('setup-connect-btn');
    btn.textContent = 'Verificando...';
    btn.disabled = true;
    const valid = await validateApiKey(key);
    if (valid) {
      setApiKey(key);
      goToSetupStep(3);
    } else {
      showSetupError('API key inválida. Verifica e intenta de nuevo.');
      btn.textContent = 'Conectar';
      btn.disabled = false;
    }
  });

  // Step 2 -> Step 3 via Skip
  document.getElementById('setup-skip-btn').addEventListener('click', () => {
    demoMode = true;
    goToSetupStep(3);
  });

  document.getElementById('setup-api-key').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('setup-connect-btn').click();
  });

  // Step 3: Add holdings (via symbol search)
  initSymbolSearch(
    'setup-symbol-search',
    'setup-symbol-results',
    'setup-selected-symbol',
    'setup-holding-ticker',
    'setup-holding-name',
    'setup-holding-type'
  );

  document.getElementById('setup-add-holding-btn').addEventListener('click', () => {
    const ticker = document.getElementById('setup-holding-ticker').value.trim().toUpperCase();
    const name = document.getElementById('setup-holding-name').value.trim();
    const type = document.getElementById('setup-holding-type').value || 'Stock';
    const allocation = parseFloat(document.getElementById('setup-holding-allocation').value);
    const sector = document.getElementById('setup-holding-sector').value;
    if (!ticker || !name || isNaN(allocation) || allocation <= 0) {
      showToast('❌ Selecciona un activo y escribe un % válido', 'error');
      return;
    }
    if (setupHoldings.some(h => h.ticker === ticker)) {
      showToast('❌ Este ticker ya fue agregado', 'error');
      return;
    }
    setupHoldings.push({ ticker, name, shortName: ticker, type, allocation, sector });
    renderSetupHoldingsList();
    // Clear search
    document.getElementById('setup-symbol-search').value = '';
    document.getElementById('setup-holding-ticker').value = '';
    document.getElementById('setup-holding-name').value = '';
    document.getElementById('setup-holding-type').value = 'Stock';
    document.getElementById('setup-selected-symbol').style.display = 'none';
    document.getElementById('setup-holding-allocation').value = '';
    document.getElementById('setup-holding-allocation').focus();
  });

  // Step 3: Finish
  document.getElementById('setup-finish-btn').addEventListener('click', () => {
    finishSetup();
  });

  // Step 3: Use default LFNF portfolio
  document.getElementById('setup-use-default-btn')?.addEventListener('click', () => {
    setupHoldings = defaultPortfolioData.holdings.map(h => ({...h}));
    renderSetupHoldingsList();
  });
}

function goToSetupStep(step) {
  document.querySelectorAll('.setup-step-content').forEach(el => el.style.display = 'none');
  document.getElementById(`setup-step-${step}`).style.display = 'block';
  document.querySelectorAll('.setup-dot').forEach(d => d.classList.remove('active'));
  document.querySelector(`.setup-dot[data-step="${step}"]`)?.classList.add('active');

  const titles = {
    1: ['Configura tu Portafolio', 'Bienvenido. Configura tu fondo personal para comenzar a monitorear tus inversiones en tiempo real.'],
    2: ['Conecta tus datos', 'Para datos de mercado en tiempo real, conecta una API key gratuita de Finnhub.'],
    3: ['Agrega tus Holdings', 'Ingresa las acciones y ETFs de tu portafolio con sus respectivos porcentajes de asignación.'],
  };
  document.getElementById('setup-title').textContent = titles[step][0];
  document.getElementById('setup-subtitle').textContent = titles[step][1];
}

function renderSetupHoldingsList() {
  const list = document.getElementById('setup-holdings-list');
  const totalPct = setupHoldings.reduce((sum, h) => sum + h.allocation, 0);
  const countEl = document.getElementById('setup-holdings-count');
  if (countEl) countEl.textContent = `${setupHoldings.length} holdings • ${totalPct.toFixed(1)}% total`;

  if (!setupHoldings.length) {
    list.innerHTML = '<div class="text-tertiary" style="text-align:center; padding:var(--space-md); font-size:var(--text-sm);">Aún no has agregado holdings.</div>';
    return;
  }
  list.innerHTML = setupHoldings.map((h, i) => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-subtle);">
      <div style="display:flex; align-items:center; gap:var(--space-sm);">
        <span class="badge ${h.type === 'ETF' ? 'badge-etf' : h.type === 'Fund' ? 'badge-fund' : 'badge-stock'}">${escHtml(h.type)}</span>
        <span class="font-bold" style="font-size:var(--text-sm);">${escHtml(h.ticker)}</span>
        <span class="text-tertiary" style="font-size:var(--text-xs);">${escHtml(h.name)}</span>
      </div>
      <div style="display:flex; align-items:center; gap:var(--space-sm);">
        <span class="font-mono font-bold" style="font-size:var(--text-sm);">${h.allocation.toFixed(1)}%</span>
        <button class="btn btn-ghost btn-icon" style="font-size:0.7rem; width:24px; height:24px;" onclick="document.dispatchEvent(new CustomEvent('remove-setup-holding', {detail:${i}}))">✕</button>
      </div>
    </div>
  `).join('');
}

// Listen for remove events from setup holdings list
document.addEventListener('remove-setup-holding', (e) => {
  setupHoldings.splice(e.detail, 1);
  renderSetupHoldingsList();
});

function finishSetup() {
  const profile = {
    fundName: document.getElementById('setup-fund-name').value.trim() || 'Mi Portafolio',
    ownerName: document.getElementById('setup-owner-name').value.trim(),
    broker: document.getElementById('setup-broker').value.trim() || 'N/A',
    createdAt: new Date().toISOString(),
  };
  saveFundProfile(profile);
  applyFundProfile(profile);

  // If user added holdings in step 3, use those
  if (setupHoldings.length > 0) {
    portfolio.holdings = setupHoldings.map(h => ({
      ...h,
      addedDate: new Date().toISOString().split('T')[0],
    }));
    savePortfolio(portfolio);
  }

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
  const liveTotal = summary.liveTotalCLP;
  const liveTotalUSD = summary.liveTotalUSD;

  if (displayCurrency === 'USD') {
    animateValue('total-value-primary', formatUSD(liveTotalUSD));
    document.getElementById('total-value-secondary').textContent = `≈ ${formatCLP(liveTotal)}`;
  } else {
    animateValue('total-value-primary', formatCLP(liveTotal));
    document.getElementById('total-value-secondary').textContent = `≈ ${formatUSD(liveTotalUSD)}`;
  }

  // Show base value if it differs from live total
  const baseEl = document.getElementById('total-value-base');
  if (Math.abs(liveTotal - summary.totalCLP) > 1) {
    baseEl.textContent = displayCurrency === 'USD'
      ? `Base: ${formatUSD(summary.totalUSD)}`
      : `Base: ${formatCLP(summary.totalCLP)}`;
    baseEl.style.display = '';
  } else {
    baseEl.style.display = 'none';
  }

  const changeEl = document.getElementById('daily-change');
  changeEl.textContent = formatPercent(summary.dailyChangePercent);
  changeEl.className = `summary-card-value ${gainLossClass(summary.dailyChangePercent)}`;

  const changeAmount = displayCurrency === 'USD' ? summary.dailyChangeUSD : summary.dailyChangeCLP;
  const changeFormatted = displayCurrency === 'USD'
    ? `${changeAmount >= 0 ? '+' : ''}${formatUSD(changeAmount)}`
    : `${changeAmount >= 0 ? '+' : ''}${formatCLP(changeAmount)}`;
  document.getElementById('daily-change-amount').textContent = changeFormatted;
  document.getElementById('daily-change-amount').className = `summary-card-sub ${gainLossClass(changeAmount)}`;

  document.getElementById('holdings-count').textContent = summary.holdingsCount;
  const fundCount = enrichedHoldings.filter(h => h.type === 'Fund').length;
  const parts = [`${summary.etfCount} ETFs`, `${summary.stockCount} Acciones`];
  if (fundCount > 0) parts.push(`${fundCount} Fondos`);
  document.getElementById('holdings-breakdown').textContent = parts.join(' • ');
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
    <div class="legend-row"><div class="legend-row-left"><div class="legend-color" style="background:${HOLDING_COLORS[i % HOLDING_COLORS.length]}"></div><span class="legend-label"><strong>${escHtml(h.ticker)}</strong> <span class="text-tertiary" style="font-size:var(--text-xs);">${escHtml(h.name)}</span></span></div><span class="legend-value">${formatPercentAbs(h.allocation)}</span></div>
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
    type: 'bar',
    data: {
      labels: sectorEntries.map(([name]) => name),
      datasets: [{
        data: sectorEntries.map(([, d]) => d.allocation),
        backgroundColor: sectorEntries.map(([name]) => getSectorColor(name) + '80'),
        borderColor: sectorEntries.map(([name]) => getSectorColor(name)),
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.85,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(17, 17, 25, 0.95)', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(148,163,184,0.12)', borderWidth: 1, cornerRadius: 8, padding: 12,
          callbacks: { label: (ctx) => { const [name, data] = sectorEntries[ctx.dataIndex]; return `${name}: ${formatPercentAbs(data.allocation)} (${data.count} acciones)`; } },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 10 }, callback: (v) => v.toFixed(0) + '%' }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11, weight: 500 } } },
      },
      animation: { duration: 800, easing: 'easeOutQuart' },
    },
  });
  const listEl = document.getElementById('sector-list');
  listEl.innerHTML = sectorEntries.map(([name, data]) => `
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
  const actionsCell = showSector ? `<td style="text-align:center;"><div style="display:flex;gap:4px;justify-content:center;"><button class="btn btn-ghost btn-icon holding-edit-btn" data-ticker="${h.ticker}" title="Editar" style="font-size:0.75rem;width:28px;height:28px;">✏️</button><button class="btn btn-ghost btn-icon holding-delete-btn" data-ticker="${h.ticker}" title="Eliminar" style="font-size:0.75rem;width:28px;height:28px;color:var(--color-loss);">🗑</button></div></td>` : '';
  const typeClass = h.type === 'ETF' ? 'etf' : h.type === 'Fund' ? 'fund' : 'stock';
  const badgeClass = h.type === 'ETF' ? 'badge-etf' : h.type === 'Fund' ? 'badge-fund' : 'badge-stock';
  return `
    <tr data-ticker="${h.ticker}">
      <td><div class="holding-name-cell"><div class="holding-ticker-icon ${typeClass}">${h.ticker.substring(0, 2)}</div><div class="holding-info"><span class="holding-ticker">${h.ticker}</span><span class="holding-full-name">${h.name}</span></div></div></td>
      <td><span class="holding-price">${priceDisplay}</span></td>
      <td><span class="holding-change ${changeClass}">${changeDisplay}</span></td>
      ${sectorCell}
      <td><div class="holding-allocation-bar"><div class="allocation-bar"><div class="allocation-bar-fill" style="width:${allocationWidth}%"></div></div><span class="allocation-value">${formatPercentAbs(h.allocation)}</span></div></td>
      <td><div><div class="holding-value-clp">${displayCurrency === 'USD' ? formatUSD(h.valueUSD) : formatCLP(h.valueCLP)}</div><div class="holding-value-usd">≈ ${displayCurrency === 'USD' ? formatCLP(h.valueCLP) : formatUSD(h.valueUSD)}</div></div></td>
      ${actionsCell}
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
  try { renderPerformanceChart(); } catch(e) { console.warn('Perf chart:', e); }
  try { renderAllHoldingsPerfChart(); } catch(e) { console.warn('All holdings perf chart:', e); }
  renderContributionChart();
  renderTopMovers();
  renderHoldingPerfSelector();
}

// Seeded PRNG for deterministic performance data
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function renderPerformanceChart() {
  const container = document.getElementById('performance-chart-container');
  container.innerHTML = '';
  if (performanceChart) { try { performanceChart.remove(); } catch(e) {} performanceChart = null; }

  const chart = createChart(container, {
    width: container.clientWidth || 800, height: 400,
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: "'Inter', sans-serif", fontSize: 11 },
    grid: { vertLines: { color: 'rgba(148,163,184,0.05)' }, horzLines: { color: 'rgba(148,163,184,0.05)' } },
    crosshair: { vertLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: LineStyle.Dashed }, horzLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: LineStyle.Dashed } },
    rightPriceScale: { borderColor: 'rgba(148,163,184,0.1)' },
    timeScale: { borderColor: 'rgba(148,163,184,0.1)', timeVisible: false },
    handleScroll: true, handleScale: true,
  });

  // Find the earliest holding addedDate as fund inception
  const holdingDates = portfolio.holdings
    .map(h => h.addedDate)
    .filter(d => d)
    .sort();
  const inceptionDate = holdingDates.length > 0 ? holdingDates[0] : (portfolio.fund.inceptionDate || '2026-04-09');

  const lfnfData = generateDeterministicPerformance(42, 0.0007, 0.015, inceptionDate);
  const spyData = generateDeterministicPerformance(123, 0.0004, 0.012, inceptionDate);

  const lfnfSeries = chart.addSeries(AreaSeries, { lineColor: '#3b82f6', topColor: 'rgba(59,130,246,0.20)', bottomColor: 'rgba(59,130,246,0.02)', lineWidth: 2, priceFormat: { type: 'percent' } });
  lfnfSeries.setData(lfnfData);

  const spySeries = chart.addSeries(LineSeries, { color: 'rgba(245,158,11,0.6)', lineWidth: 1.5, lineStyle: LineStyle.Dashed, priceFormat: { type: 'percent' } });
  spySeries.setData(spyData);

  // Add markers for when holdings were added (group by date)
  const holdingsByDate = {};
  for (const h of portfolio.holdings) {
    const d = h.addedDate || inceptionDate;
    if (!holdingsByDate[d]) holdingsByDate[d] = [];
    holdingsByDate[d].push(h.ticker);
  }
  const markers = Object.entries(holdingsByDate)
    .filter(([date]) => date >= inceptionDate)
    .map(([date, tickers]) => ({
      time: date,
      position: 'belowBar',
      color: '#f59e0b',
      shape: 'arrowUp',
      text: tickers.length <= 3 ? tickers.join(', ') : `${tickers.slice(0,3).join(', ')} +${tickers.length-3}`,
      size: 1,
    }));
  if (markers.length > 0) {
    try { lfnfSeries.setMarkers(markers); } catch(e) { /* markers not supported in this version */ }
  }

  chart.timeScale().fitContent();
  performanceChart = chart;

  const resizeObserver = new ResizeObserver(() => { chart.applyOptions({ width: container.clientWidth, height: container.clientHeight }); });
  resizeObserver.observe(container);
}

/**
 * Render all holdings performance lines on a single chart.
 * Each holding starts from its addedDate, showing % return normalized to 0%.
 */
function renderAllHoldingsPerfChart() {
  const container = document.getElementById('all-holdings-perf-container');
  const legendEl = document.getElementById('all-holdings-perf-legend');
  if (!container) return;

  container.innerHTML = '';
  if (allHoldingsPerfChart) { try { allHoldingsPerfChart.remove(); } catch(e) {} allHoldingsPerfChart = null; }

  const chart = createChart(container, {
    width: container.clientWidth || 800, height: 350,
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: "'Inter', sans-serif", fontSize: 11 },
    grid: { vertLines: { color: 'rgba(148,163,184,0.05)' }, horzLines: { color: 'rgba(148,163,184,0.05)' } },
    crosshair: { vertLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: LineStyle.Dashed }, horzLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: LineStyle.Dashed } },
    rightPriceScale: { borderColor: 'rgba(148,163,184,0.1)' },
    timeScale: { borderColor: 'rgba(148,163,184,0.1)', timeVisible: false },
    handleScroll: true, handleScale: true,
  });

  const inceptionDate = portfolio.fund.inceptionDate || '2026-04-09';
  const sorted = [...portfolio.holdings].sort((a, b) => (a.addedDate || inceptionDate).localeCompare(b.addedDate || inceptionDate));

  // Generate a line for each holding
  const legendParts = [];
  sorted.forEach((h, i) => {
    const color = HOLDING_COLORS[i % HOLDING_COLORS.length];
    const startDate = h.addedDate || inceptionDate;
    const seed = h.ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const enriched = enrichedHoldings.find(eh => eh.ticker === h.ticker);
    const dailyReturn = (enriched?.changePercent || 0) * 0.0001 + 0.0003;
    const volatility = 0.018;

    const data = generateDeterministicPerformance(seed, dailyReturn, volatility, startDate);

    const series = chart.addSeries(LineSeries, {
      color: color,
      lineWidth: 1.5,
      priceFormat: { type: 'percent' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    series.setData(data);

    legendParts.push(`<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:var(--bg-surface);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:var(--text-xs);">
      <div style="width:10px;height:3px;background:${color};border-radius:2px;"></div>
      <span class="font-bold">${escHtml(h.ticker)}</span>
    </div>`);
  });

  if (legendEl) legendEl.innerHTML = legendParts.join('');

  chart.timeScale().fitContent();
  allHoldingsPerfChart = chart;

  const resizeObserver = new ResizeObserver(() => { chart.applyOptions({ width: container.clientWidth, height: container.clientHeight }); });
  resizeObserver.observe(container);
}

function generateDeterministicPerformance(seed, dailyReturn, volatility, startDateStr) {
  const rng = seededRandom(seed);
  const data = [];
  let value = 100;
  const start = startDateStr ? new Date(startDateStr) : new Date('2019-01-02');
  const now = new Date();

  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = dailyReturn + (rng() - 0.48) * 2 * volatility;
    value *= (1 + change);
    const m = d.getMonth(), y = d.getFullYear();
    // Simulate COVID crash (March 2020) — only relevant if fund started before this period
    if (start <= new Date('2020-03-01')) {
      if (y === 2020 && m === 2) value *= (1 - rng() * 0.025);
      if (y === 2020 && m === 3) value *= (1 + rng() * 0.02);
    }
    // Simulate 2022 bear — only relevant if fund started before mid-2022
    if (start <= new Date('2022-06-01')) {
      if (y === 2022 && m >= 0 && m <= 5) value *= (1 - rng() * 0.003);
    }
    data.push({ time: d.toISOString().split('T')[0], value: parseFloat((value - 100).toFixed(2)) });
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
// INDIVIDUAL HOLDING PERFORMANCE
// ============================================
function renderHoldingPerfSelector() {
  const selector = document.getElementById('holding-perf-selector');
  if (!selector || !enrichedHoldings.length) return;
  selector.innerHTML = enrichedHoldings
    .sort((a, b) => b.allocation - a.allocation)
    .map(h => {
      return `<button class="holding-perf-chip ${selectedHoldingPerfTicker === h.ticker ? 'active' : ''}" data-ticker="${escHtml(h.ticker)}">
        ${escHtml(h.ticker)}
      </button>`;
    }).join('');

  selector.addEventListener('click', (e) => {
    const chip = e.target.closest('.holding-perf-chip');
    if (!chip) return;
    const ticker = chip.dataset.ticker;
    selector.querySelectorAll('.holding-perf-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedHoldingPerfTicker = ticker;
    renderHoldingPerfChart(ticker);
  });
}

async function renderHoldingPerfChart(ticker) {
  const container = document.getElementById('holding-perf-chart-container');
  const emptyEl = document.getElementById('holding-perf-empty');
  const infoEl = document.getElementById('holding-perf-info');
  if (!container) return;

  emptyEl.style.display = 'none';
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div><p class="text-tertiary" style="margin-top:var(--space-sm);">Cargando datos...</p></div>';

  const holding = portfolio.holdings.find(h => h.ticker === ticker);
  const enriched = enrichedHoldings.find(h => h.ticker === ticker);

  // Try to get real candle data (1 year lookback)
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 3600;
  let candleData = null;

  if (!demoMode) {
    try {
      candleData = await getCandles(ticker, 'D', oneYearAgo, now);
    } catch (e) { /* fall through to demo */ }
  }

  // Build chart data
  let chartData = [];
  if (candleData && candleData.s === 'ok' && candleData.c && candleData.c.length > 0) {
    chartData = candleData.t.map((t, i) => ({
      time: new Date(t * 1000).toISOString().split('T')[0],
      value: parseFloat(candleData.c[i].toFixed(2)),
    }));
  } else {
    // Generate demo price data (seeded by ticker)
    const seed = ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rng = seededRandom(seed);
    const basePrice = enriched?.price || (50 + rng() * 200);
    let price = basePrice * 0.7; // start 30% below current
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      price *= (1 + (rng() - 0.49) * 0.04);
      chartData.push({ time: d.toISOString().split('T')[0], value: parseFloat(price.toFixed(2)) });
    }
    // End at the actual price if available
    if (enriched?.price && chartData.length > 0) {
      const lastPrice = chartData[chartData.length - 1].value;
      const scale = enriched.price / lastPrice;
      chartData = chartData.map(d => ({ ...d, value: parseFloat((d.value * scale).toFixed(2)) }));
    }
  }

  if (!chartData.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p class="empty-state-text text-tertiary">Sin datos históricos disponibles</p></div>';
    return;
  }

  container.innerHTML = '';
  if (holdingPerfChart) { try { holdingPerfChart.remove(); } catch(e) {} holdingPerfChart = null; }

  const chart = createChart(container, {
    width: container.clientWidth || 800, height: 320,
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontFamily: "'Inter', sans-serif", fontSize: 11 },
    grid: { vertLines: { color: 'rgba(148,163,184,0.05)' }, horzLines: { color: 'rgba(148,163,184,0.05)' } },
    crosshair: { vertLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: LineStyle.Dashed }, horzLine: { color: 'rgba(59,130,246,0.3)', width: 1, style: LineStyle.Dashed } },
    rightPriceScale: { borderColor: 'rgba(148,163,184,0.1)' },
    timeScale: { borderColor: 'rgba(148,163,184,0.1)', timeVisible: false },
    handleScroll: true, handleScale: true,
  });

  // Price series
  const firstVal = chartData[0].value;
  const lastVal = chartData[chartData.length - 1].value;
  const isUp = lastVal >= firstVal;
  const lineColor = isUp ? '#10b981' : '#ef4444';
  const topColor = isUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
  const bottomColor = isUp ? 'rgba(16,185,129,0.02)' : 'rgba(239,68,68,0.02)';

  const series = chart.addSeries(AreaSeries, { lineColor, topColor, bottomColor, lineWidth: 2 });
  series.setData(chartData);

  // Mark when holding was added to the fund
  if (holding?.addedDate) {
    const addedData = chartData.find(d => d.time >= holding.addedDate);
    if (addedData) {
      try {
        series.setMarkers([{
          time: addedData.time,
          position: 'belowBar',
          color: '#f59e0b',
          shape: 'arrowUp',
          text: `Ingresó al fondo (${holding.addedDate})`,
          size: 1,
        }]);
      } catch(e) { /* markers may not be supported */ }
    }
  }

  chart.timeScale().fitContent();
  holdingPerfChart = chart;

  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
  });
  resizeObserver.observe(container);

  // Show info bar
  if (infoEl && enriched) {
    infoEl.style.display = '';
    document.getElementById('hp-ticker').textContent = ticker;
    document.getElementById('hp-added').textContent = holding?.addedDate || '—';
    document.getElementById('hp-price').textContent = enriched.price ? formatUSD(enriched.price) : '—';
    const changeEl = document.getElementById('hp-change');
    if (enriched.changePercent !== null) {
      changeEl.textContent = formatPercent(enriched.changePercent);
      changeEl.className = `font-mono font-bold ${gainLossClass(enriched.changePercent)}`;
    } else {
      changeEl.textContent = '—';
    }
    document.getElementById('hp-alloc').textContent = formatPercentAbs(enriched.allocation);
  }
}

// ============================================
// SYMBOL SEARCH (Autocomplete)
// ============================================

// Fallback list of common symbols for demo mode
const DEMO_SYMBOLS = [
  { symbol: 'AAPL', description: 'Apple Inc.', type: 'Common Stock' },
  { symbol: 'MSFT', description: 'Microsoft Corporation', type: 'Common Stock' },
  { symbol: 'NVDA', description: 'NVIDIA Corporation', type: 'Common Stock' },
  { symbol: 'AMZN', description: 'Amazon.com, Inc.', type: 'Common Stock' },
  { symbol: 'GOOGL', description: 'Alphabet Inc. Class A', type: 'Common Stock' },
  { symbol: 'META', description: 'Meta Platforms, Inc.', type: 'Common Stock' },
  { symbol: 'TSLA', description: 'Tesla, Inc.', type: 'Common Stock' },
  { symbol: 'JPM', description: 'JPMorgan Chase & Co.', type: 'Common Stock' },
  { symbol: 'V', description: 'Visa Inc.', type: 'Common Stock' },
  { symbol: 'UNH', description: 'UnitedHealth Group Inc.', type: 'Common Stock' },
  { symbol: 'XOM', description: 'Exxon Mobil Corporation', type: 'Common Stock' },
  { symbol: 'JNJ', description: 'Johnson & Johnson', type: 'Common Stock' },
  { symbol: 'WMT', description: 'Walmart Inc.', type: 'Common Stock' },
  { symbol: 'MA', description: 'Mastercard Inc.', type: 'Common Stock' },
  { symbol: 'PG', description: 'Procter & Gamble Co.', type: 'Common Stock' },
  { symbol: 'AVGO', description: 'Broadcom Inc.', type: 'Common Stock' },
  { symbol: 'HD', description: 'The Home Depot, Inc.', type: 'Common Stock' },
  { symbol: 'COST', description: 'Costco Wholesale Corp.', type: 'Common Stock' },
  { symbol: 'NFLX', description: 'Netflix, Inc.', type: 'Common Stock' },
  { symbol: 'AMD', description: 'Advanced Micro Devices', type: 'Common Stock' },
  { symbol: 'ADBE', description: 'Adobe Inc.', type: 'Common Stock' },
  { symbol: 'ORCL', description: 'Oracle Corporation', type: 'Common Stock' },
  { symbol: 'CRM', description: 'Salesforce, Inc.', type: 'Common Stock' },
  { symbol: 'INTU', description: 'Intuit Inc.', type: 'Common Stock' },
  { symbol: 'QCOM', description: 'QUALCOMM Inc.', type: 'Common Stock' },
  { symbol: 'BAC', description: 'Bank of America Corp.', type: 'Common Stock' },
  { symbol: 'WFC', description: 'Wells Fargo & Company', type: 'Common Stock' },
  { symbol: 'GS', description: 'Goldman Sachs Group', type: 'Common Stock' },
  { symbol: 'MS', description: 'Morgan Stanley', type: 'Common Stock' },
  { symbol: 'ABBV', description: 'AbbVie Inc.', type: 'Common Stock' },
  { symbol: 'LIN', description: 'Linde plc', type: 'Common Stock' },
  { symbol: 'ISRG', description: 'Intuitive Surgical, Inc.', type: 'Common Stock' },
  { symbol: 'IBM', description: 'IBM Corporation', type: 'Common Stock' },
  { symbol: 'IONQ', description: 'IonQ, Inc.', type: 'Common Stock' },
  { symbol: 'BA', description: 'The Boeing Company', type: 'Common Stock' },
  { symbol: 'LMT', description: 'Lockheed Martin Corp.', type: 'Common Stock' },
  { symbol: 'RTX', description: 'RTX Corporation', type: 'Common Stock' },
  { symbol: 'NOC', description: 'Northrop Grumman Corp.', type: 'Common Stock' },
  { symbol: 'GD', description: 'General Dynamics Corp.', type: 'Common Stock' },
  { symbol: 'PLTR', description: 'Palantir Technologies Inc.', type: 'Common Stock' },
  { symbol: 'KKR', description: 'KKR & Co. Inc.', type: 'Common Stock' },
  { symbol: 'NBIS', description: 'Nebius Group N.V.', type: 'Common Stock' },
  { symbol: 'DUOL', description: 'Duolingo, Inc.', type: 'Common Stock' },
  { symbol: 'OKLO', description: 'Oklo Inc.', type: 'Common Stock' },
  { symbol: 'NKE', description: 'Nike, Inc.', type: 'Common Stock' },
  { symbol: 'TSM', description: 'Taiwan Semiconductor Mfg.', type: 'Common Stock' },
  { symbol: 'BABA', description: 'Alibaba Group Holding', type: 'Common Stock' },
  { symbol: 'PDD', description: 'PDD Holdings Inc.', type: 'Common Stock' },
  { symbol: 'TCEHY', description: 'Tencent Holdings Ltd.', type: 'Common Stock' },
  { symbol: 'INFY', description: 'Infosys Limited', type: 'Common Stock' },
  { symbol: 'MELI', description: 'MercadoLibre, Inc.', type: 'Common Stock' },
  { symbol: 'VALE', description: 'Vale S.A.', type: 'Common Stock' },
  { symbol: 'SPY', description: 'SPDR S&P 500 ETF Trust', type: 'ETP' },
  { symbol: 'QQQ', description: 'Invesco QQQ Trust', type: 'ETP' },
  { symbol: 'VTI', description: 'Vanguard Total Stock Market ETF', type: 'ETP' },
  { symbol: 'QQQM', description: 'Invesco NASDAQ 100 ETF', type: 'ETP' },
  { symbol: 'VOO', description: 'Vanguard S&P 500 ETF', type: 'ETP' },
  { symbol: 'IVV', description: 'iShares Core S&P 500 ETF', type: 'ETP' },
  { symbol: 'DYNF', description: 'iShares U.S. Equity Factor Rotation Active ETF', type: 'ETP' },
  { symbol: 'XAR', description: 'SPDR S&P Aerospace & Defense ETF', type: 'ETP' },
  { symbol: 'AVEM', description: 'Avantis Emerging Markets Equity ETF', type: 'ETP' },
  { symbol: 'QTUM', description: 'Defiance Quantum ETF', type: 'ETP' },
  { symbol: 'CQQQ', description: 'Invesco China Technology ETF', type: 'ETP' },
  { symbol: 'MAGS', description: 'Roundhill Magnificent Seven ETF', type: 'ETP' },
  { symbol: 'VWO', description: 'Vanguard FTSE Emerging Markets ETF', type: 'ETP' },
  { symbol: 'GLD', description: 'SPDR Gold Shares', type: 'ETP' },
  { symbol: 'TLT', description: 'iShares 20+ Year Treasury Bond ETF', type: 'ETP' },
  { symbol: 'ARKK', description: 'ARK Innovation ETF', type: 'ETP' },
  { symbol: 'SOXX', description: 'iShares Semiconductor ETF', type: 'ETP' },
  { symbol: 'SMH', description: 'VanEck Semiconductor ETF', type: 'ETP' },
  { symbol: 'XLK', description: 'Technology Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLF', description: 'Financial Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLV', description: 'Health Care Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLE', description: 'Energy Select Sector SPDR', type: 'ETP' },
  { symbol: 'TSEM', description: 'Tower Semiconductor Ltd.', type: 'Common Stock' },
  { symbol: 'MU', description: 'Micron Technology, Inc.', type: 'Common Stock' },
  { symbol: 'EEM', description: 'iShares MSCI Emerging Markets ETF', type: 'ETP' },
  { symbol: 'IEMG', description: 'iShares Core MSCI Emerging Markets ETF', type: 'ETP' },
  { symbol: 'VEA', description: 'Vanguard FTSE Developed Markets ETF', type: 'ETP' },
  { symbol: 'EFA', description: 'iShares MSCI EAFE ETF', type: 'ETP' },
  { symbol: 'VXUS', description: 'Vanguard Total International Stock ETF', type: 'ETP' },
  { symbol: 'BND', description: 'Vanguard Total Bond Market ETF', type: 'ETP' },
  { symbol: 'AGG', description: 'iShares Core U.S. Aggregate Bond ETF', type: 'ETP' },
  { symbol: 'TIP', description: 'iShares TIPS Bond ETF', type: 'ETP' },
  { symbol: 'LQD', description: 'iShares iBoxx $ Investment Grade Corporate Bond ETF', type: 'ETP' },
  { symbol: 'HYG', description: 'iShares iBoxx $ High Yield Corporate Bond ETF', type: 'ETP' },
  { symbol: 'VNQ', description: 'Vanguard Real Estate ETF', type: 'ETP' },
  { symbol: 'SCHD', description: 'Schwab U.S. Dividend Equity ETF', type: 'ETP' },
  { symbol: 'JEPI', description: 'JPMorgan Equity Premium Income ETF', type: 'ETP' },
  { symbol: 'JEPQ', description: 'JPMorgan Nasdaq Equity Premium Income ETF', type: 'ETP' },
  { symbol: 'DIA', description: 'SPDR Dow Jones Industrial Average ETF', type: 'ETP' },
  { symbol: 'IWM', description: 'iShares Russell 2000 ETF', type: 'ETP' },
  { symbol: 'IWF', description: 'iShares Russell 1000 Growth ETF', type: 'ETP' },
  { symbol: 'IWD', description: 'iShares Russell 1000 Value ETF', type: 'ETP' },
  { symbol: 'VIG', description: 'Vanguard Dividend Appreciation ETF', type: 'ETP' },
  { symbol: 'VYM', description: 'Vanguard High Dividend Yield ETF', type: 'ETP' },
  { symbol: 'DVY', description: 'iShares Select Dividend ETF', type: 'ETP' },
  { symbol: 'VT', description: 'Vanguard Total World Stock ETF', type: 'ETP' },
  { symbol: 'ACWI', description: 'iShares MSCI ACWI ETF', type: 'ETP' },
  { symbol: 'EWJ', description: 'iShares MSCI Japan ETF', type: 'ETP' },
  { symbol: 'EWZ', description: 'iShares MSCI Brazil ETF', type: 'ETP' },
  { symbol: 'FXI', description: 'iShares China Large-Cap ETF', type: 'ETP' },
  { symbol: 'INDA', description: 'iShares MSCI India ETF', type: 'ETP' },
  { symbol: 'EWT', description: 'iShares MSCI Taiwan ETF', type: 'ETP' },
  { symbol: 'KRE', description: 'SPDR S&P Regional Banking ETF', type: 'ETP' },
  { symbol: 'XLI', description: 'Industrial Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLU', description: 'Utilities Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLP', description: 'Consumer Staples Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLY', description: 'Consumer Discretionary Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLB', description: 'Materials Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLC', description: 'Communication Services Select Sector SPDR', type: 'ETP' },
  { symbol: 'XLRE', description: 'Real Estate Select Sector SPDR', type: 'ETP' },
  { symbol: 'IYR', description: 'iShares U.S. Real Estate ETF', type: 'ETP' },
  { symbol: 'ARKG', description: 'ARK Genomic Revolution ETF', type: 'ETP' },
  { symbol: 'ARKW', description: 'ARK Next Generation Internet ETF', type: 'ETP' },
  { symbol: 'ARKQ', description: 'ARK Autonomous Technology & Robotics ETF', type: 'ETP' },
  { symbol: 'ICLN', description: 'iShares Global Clean Energy ETF', type: 'ETP' },
  { symbol: 'TAN', description: 'Invesco Solar ETF', type: 'ETP' },
  { symbol: 'PBW', description: 'Invesco WilderHill Clean Energy ETF', type: 'ETP' },
  { symbol: 'KWEB', description: 'KraneShares CSI China Internet ETF', type: 'ETP' },
  { symbol: 'MCHI', description: 'iShares MSCI China ETF', type: 'ETP' },
  { symbol: 'BITO', description: 'ProShares Bitcoin Strategy ETF', type: 'ETP' },
  { symbol: 'IBIT', description: 'iShares Bitcoin Trust ETF', type: 'ETP' },
  { symbol: 'GBTC', description: 'Grayscale Bitcoin Trust', type: 'ETP' },
  { symbol: 'SLV', description: 'iShares Silver Trust', type: 'ETP' },
  { symbol: 'IAU', description: 'iShares Gold Trust', type: 'ETP' },
  { symbol: 'DBA', description: 'Invesco DB Agriculture Fund', type: 'ETP' },
  { symbol: 'USO', description: 'United States Oil Fund', type: 'ETP' },
  { symbol: 'UNG', description: 'United States Natural Gas Fund', type: 'ETP' },
  { symbol: 'SOXL', description: 'Direxion Daily Semiconductor Bull 3X Shares', type: 'ETP' },
  { symbol: 'TQQQ', description: 'ProShares UltraPro QQQ', type: 'ETP' },
  { symbol: 'QLD', description: 'ProShares Ultra QQQ', type: 'ETP' },
  { symbol: 'SPXL', description: 'Direxion Daily S&P 500 Bull 3X Shares', type: 'ETP' },
  { symbol: 'VGT', description: 'Vanguard Information Technology ETF', type: 'ETP' },
  { symbol: 'FTEC', description: 'Fidelity MSCI Information Technology Index ETF', type: 'ETP' },
  { symbol: 'BOTZ', description: 'Global X Robotics & Artificial Intelligence ETF', type: 'ETP' },
  { symbol: 'ROBO', description: 'ROBO Global Robotics and Automation Index ETF', type: 'ETP' },
  { symbol: 'AIQ', description: 'Global X Artificial Intelligence & Technology ETF', type: 'ETP' },
  { symbol: 'HACK', description: 'ETFMG Prime Cyber Security ETF', type: 'ETP' },
  { symbol: 'CIBR', description: 'First Trust NASDAQ Cybersecurity ETF', type: 'ETP' },
  { symbol: 'SKYY', description: 'First Trust Cloud Computing ETF', type: 'ETP' },
  { symbol: 'CLOU', description: 'Global X Cloud Computing ETF', type: 'ETP' },
  { symbol: 'WCLD', description: 'WisdomTree Cloud Computing Fund', type: 'ETP' },
  { symbol: 'ESGU', description: 'iShares ESG Aware MSCI USA ETF', type: 'ETP' },
  { symbol: 'ESGV', description: 'Vanguard ESG U.S. Stock ETF', type: 'ETP' },
  { symbol: 'GOOG', description: 'Alphabet Inc. Class C', type: 'Common Stock' },
  { symbol: 'INTC', description: 'Intel Corporation', type: 'Common Stock' },
  { symbol: 'MRK', description: 'Merck & Co., Inc.', type: 'Common Stock' },
  { symbol: 'PFE', description: 'Pfizer Inc.', type: 'Common Stock' },
  { symbol: 'LLY', description: 'Eli Lilly and Company', type: 'Common Stock' },
  { symbol: 'TMO', description: 'Thermo Fisher Scientific Inc.', type: 'Common Stock' },
  { symbol: 'ABT', description: 'Abbott Laboratories', type: 'Common Stock' },
  { symbol: 'DHR', description: 'Danaher Corporation', type: 'Common Stock' },
  { symbol: 'BMY', description: 'Bristol-Myers Squibb Co.', type: 'Common Stock' },
  { symbol: 'GE', description: 'GE Aerospace', type: 'Common Stock' },
  { symbol: 'CAT', description: 'Caterpillar Inc.', type: 'Common Stock' },
  { symbol: 'HON', description: 'Honeywell International Inc.', type: 'Common Stock' },
  { symbol: 'DE', description: 'Deere & Company', type: 'Common Stock' },
  { symbol: 'MMM', description: '3M Company', type: 'Common Stock' },
  { symbol: 'UPS', description: 'United Parcel Service, Inc.', type: 'Common Stock' },
  { symbol: 'FDX', description: 'FedEx Corporation', type: 'Common Stock' },
  { symbol: 'DIS', description: 'The Walt Disney Company', type: 'Common Stock' },
  { symbol: 'CMCSA', description: 'Comcast Corporation', type: 'Common Stock' },
  { symbol: 'T', description: 'AT&T Inc.', type: 'Common Stock' },
  { symbol: 'VZ', description: 'Verizon Communications Inc.', type: 'Common Stock' },
  { symbol: 'PYPL', description: 'PayPal Holdings, Inc.', type: 'Common Stock' },
  { symbol: 'SQ', description: 'Block, Inc.', type: 'Common Stock' },
  { symbol: 'SHOP', description: 'Shopify Inc.', type: 'Common Stock' },
  { symbol: 'SNOW', description: 'Snowflake Inc.', type: 'Common Stock' },
  { symbol: 'NET', description: 'Cloudflare, Inc.', type: 'Common Stock' },
  { symbol: 'DDOG', description: 'Datadog, Inc.', type: 'Common Stock' },
  { symbol: 'ZS', description: 'Zscaler, Inc.', type: 'Common Stock' },
  { symbol: 'CRWD', description: 'CrowdStrike Holdings, Inc.', type: 'Common Stock' },
  { symbol: 'PANW', description: 'Palo Alto Networks, Inc.', type: 'Common Stock' },
  { symbol: 'MDB', description: 'MongoDB, Inc.', type: 'Common Stock' },
  { symbol: 'COIN', description: 'Coinbase Global, Inc.', type: 'Common Stock' },
  { symbol: 'MARA', description: 'MARA Holdings, Inc.', type: 'Common Stock' },
  { symbol: 'RIOT', description: 'Riot Platforms, Inc.', type: 'Common Stock' },
  { symbol: 'RIVN', description: 'Rivian Automotive, Inc.', type: 'Common Stock' },
  { symbol: 'LCID', description: 'Lucid Group, Inc.', type: 'Common Stock' },
  { symbol: 'F', description: 'Ford Motor Company', type: 'Common Stock' },
  { symbol: 'GM', description: 'General Motors Company', type: 'Common Stock' },
  { symbol: 'UBER', description: 'Uber Technologies, Inc.', type: 'Common Stock' },
  { symbol: 'LYFT', description: 'Lyft, Inc.', type: 'Common Stock' },
  { symbol: 'ABNB', description: 'Airbnb, Inc.', type: 'Common Stock' },
  { symbol: 'DASH', description: 'DoorDash, Inc.', type: 'Common Stock' },
  { symbol: 'RBLX', description: 'Roblox Corporation', type: 'Common Stock' },
  { symbol: 'U', description: 'Unity Software Inc.', type: 'Common Stock' },
  { symbol: 'TTWO', description: 'Take-Two Interactive Software', type: 'Common Stock' },
  { symbol: 'EA', description: 'Electronic Arts Inc.', type: 'Common Stock' },
  { symbol: 'MTCH', description: 'Match Group, Inc.', type: 'Common Stock' },
  { symbol: 'ZM', description: 'Zoom Video Communications', type: 'Common Stock' },
  { symbol: 'DOCU', description: 'DocuSign, Inc.', type: 'Common Stock' },
  { symbol: 'TWLO', description: 'Twilio Inc.', type: 'Common Stock' },
  { symbol: 'SPOT', description: 'Spotify Technology S.A.', type: 'Common Stock' },
  { symbol: 'SNAP', description: 'Snap Inc.', type: 'Common Stock' },
  { symbol: 'PINS', description: 'Pinterest, Inc.', type: 'Common Stock' },
  { symbol: 'ROKU', description: 'Roku, Inc.', type: 'Common Stock' },
  { symbol: 'CHWY', description: 'Chewy, Inc.', type: 'Common Stock' },
  { symbol: 'W', description: 'Wayfair Inc.', type: 'Common Stock' },
  { symbol: 'ETSY', description: 'Etsy, Inc.', type: 'Common Stock' },
  { symbol: 'TGT', description: 'Target Corporation', type: 'Common Stock' },
  { symbol: 'KO', description: 'The Coca-Cola Company', type: 'Common Stock' },
  { symbol: 'PEP', description: 'PepsiCo, Inc.', type: 'Common Stock' },
  { symbol: 'MCD', description: 'McDonald\'s Corporation', type: 'Common Stock' },
  { symbol: 'SBUX', description: 'Starbucks Corporation', type: 'Common Stock' },
  { symbol: 'CMG', description: 'Chipotle Mexican Grill, Inc.', type: 'Common Stock' },
  { symbol: 'YUM', description: 'Yum! Brands, Inc.', type: 'Common Stock' },
  { symbol: 'CL', description: 'Colgate-Palmolive Company', type: 'Common Stock' },
  { symbol: 'EL', description: 'The Estee Lauder Companies', type: 'Common Stock' },
  { symbol: 'KHC', description: 'The Kraft Heinz Company', type: 'Common Stock' },
  { symbol: 'GIS', description: 'General Mills, Inc.', type: 'Common Stock' },
  { symbol: 'SYY', description: 'Sysco Corporation', type: 'Common Stock' },
  { symbol: 'STZ', description: 'Constellation Brands, Inc.', type: 'Common Stock' },
  { symbol: 'DEO', description: 'Diageo plc', type: 'Common Stock' },
  { symbol: 'BUD', description: 'Anheuser-Busch InBev SA/NV', type: 'Common Stock' },
  { symbol: 'PM', description: 'Philip Morris International', type: 'Common Stock' },
  { symbol: 'MO', description: 'Altria Group, Inc.', type: 'Common Stock' },
  { symbol: 'CARR', description: 'Carrier Global Corporation', type: 'Common Stock' },
  { symbol: 'JCI', description: 'Johnson Controls International', type: 'Common Stock' },
  { symbol: 'EMR', description: 'Emerson Electric Co.', type: 'Common Stock' },
  { symbol: 'ROK', description: 'Rockwell Automation, Inc.', type: 'Common Stock' },
  { symbol: 'APH', description: 'Amphenol Corporation', type: 'Common Stock' },
  { symbol: 'TEL', description: 'TE Connectivity Ltd.', type: 'Common Stock' },
  { symbol: 'GLW', description: 'Corning Incorporated', type: 'Common Stock' },
  { symbol: 'SHW', description: 'The Sherwin-Williams Company', type: 'Common Stock' },
  { symbol: 'ECL', description: 'Ecolab Inc.', type: 'Common Stock' },
  { symbol: 'APD', description: 'Air Products and Chemicals', type: 'Common Stock' },
  { symbol: 'NUE', description: 'Nucor Corporation', type: 'Common Stock' },
  { symbol: 'FCX', description: 'Freeport-McMoRan Inc.', type: 'Common Stock' },
  { symbol: 'GOLD', description: 'Barrick Gold Corporation', type: 'Common Stock' },
  { symbol: 'NEM', description: 'Newmont Corporation', type: 'Common Stock' },
  { symbol: 'AEM', description: 'Agnico Eagle Mines Limited', type: 'Common Stock' },
  { symbol: 'BIDU', description: 'Baidu, Inc.', type: 'Common Stock' },
  { symbol: 'JD', description: 'JD.com, Inc.', type: 'Common Stock' },
  { symbol: 'SE', description: 'Sea Limited', type: 'Common Stock' },
  { symbol: 'GRAB', description: 'Grab Holdings Limited', type: 'Common Stock' },
  { symbol: 'CPNG', description: 'Coupang, Inc.', type: 'Common Stock' },
  { symbol: 'ASML', description: 'ASML Holding N.V.', type: 'Common Stock' },
  { symbol: 'SAP', description: 'SAP SE', type: 'Common Stock' },
  { symbol: 'TCOM', description: 'Trip.com Group Limited', type: 'Common Stock' },
  { symbol: 'LULU', description: 'Lululemon Athletica Inc.', type: 'Common Stock' },
  { symbol: 'ON', description: 'ON Semiconductor Corporation', type: 'Common Stock' },
  { symbol: 'TER', description: 'Teradyne, Inc.', type: 'Common Stock' },
  { symbol: 'AMAT', description: 'Applied Materials, Inc.', type: 'Common Stock' },
  { symbol: 'KLAC', description: 'KLA Corporation', type: 'Common Stock' },
  { symbol: 'MRVL', description: 'Marvell Technology, Inc.', type: 'Common Stock' },
  { symbol: 'SNPS', description: 'Synopsys, Inc.', type: 'Common Stock' },
  { symbol: 'CDNS', description: 'Cadence Design Systems, Inc.', type: 'Common Stock' },
  { symbol: 'FTNT', description: 'Fortinet, Inc.', type: 'Common Stock' },
  { symbol: 'SSNLF', description: 'Samsung Electronics Co., Ltd.', type: 'Common Stock' },
  { symbol: 'SONY', description: 'Sony Group Corporation', type: 'Common Stock' },
  { symbol: 'TM', description: 'Toyota Motor Corporation', type: 'Common Stock' },
  { symbol: 'NVO', description: 'Novo Nordisk A/S', type: 'Common Stock' },
  { symbol: 'AZN', description: 'AstraZeneca PLC', type: 'Common Stock' },
  { symbol: 'GSK', description: 'GSK plc', type: 'Common Stock' },
  { symbol: 'SHEL', description: 'Shell plc', type: 'Common Stock' },
  { symbol: 'BP', description: 'BP p.l.c.', type: 'Common Stock' },
  { symbol: 'RIO', description: 'Rio Tinto Group', type: 'Common Stock' },
  { symbol: 'BHP', description: 'BHP Group Limited', type: 'Common Stock' },
  { symbol: 'SAN', description: 'Banco Santander, S.A.', type: 'Common Stock' },
  { symbol: 'UBS', description: 'UBS Group AG', type: 'Common Stock' },
  { symbol: 'DB', description: 'Deutsche Bank AG', type: 'Common Stock' },
  { symbol: 'ING', description: 'ING Groep N.V.', type: 'Common Stock' },
  { symbol: 'HSBC', description: 'HSBC Holdings plc', type: 'Common Stock' },
  { symbol: 'BBVA', description: 'Banco Bilbao Vizcaya Argentaria', type: 'Common Stock' },
  { symbol: 'NIO', description: 'NIO Inc.', type: 'Common Stock' },
  { symbol: 'XPEV', description: 'XPeng Inc.', type: 'Common Stock' },
  { symbol: 'LI', description: 'Li Auto Inc.', type: 'Common Stock' },
  { symbol: 'WBD', description: 'Warner Bros. Discovery, Inc.', type: 'Common Stock' },
  { symbol: 'LOGI', description: 'Logitech International S.A.', type: 'Common Stock' },
  { symbol: 'ABB', description: 'ABB Ltd.', type: 'Common Stock' },
  { symbol: 'SIEGY', description: 'Siemens AG', type: 'Common Stock' },
  { symbol: 'NSRGY', description: 'Nestlé S.A.', type: 'Common Stock' },
  { symbol: 'RHHBY', description: 'Roche Holding AG', type: 'Common Stock' },
  { symbol: 'VOD', description: 'Vodafone Group plc', type: 'Common Stock' },
  { symbol: 'BTI', description: 'British American Tobacco plc', type: 'Common Stock' },
  { symbol: 'ARM', description: 'Arm Holdings plc', type: 'Common Stock' },
  { symbol: 'SWK', description: 'Stanley Black & Decker, Inc.', type: 'Common Stock' },
];

const SECTOR_LOOKUP = {
  // Technology
  'AAPL': 'Technology',
  'ADBE': 'Technology',
  'AMAT': 'Technology',
  'AMD': 'Technology',
  'APH': 'Technology',
  'ARM': 'Technology',
  'ASML': 'Technology',
  'AVGO': 'Technology',
  'BIDU': 'Technology',
  'CDNS': 'Technology',
  'CRM': 'Technology',
  'CRWD': 'Technology',
  'DDOG': 'Technology',
  'DOCU': 'Technology',
  'DUOL': 'Technology',
  'FTNT': 'Technology',
  'GLW': 'Technology',
  'GOOG': 'Technology',
  'GOOGL': 'Technology',
  'IBM': 'Technology',
  'INFY': 'Technology',
  'INTC': 'Technology',
  'INTU': 'Technology',
  'IONQ': 'Technology',
  'KLAC': 'Technology',
  'LOGI': 'Technology',
  'MDB': 'Technology',
  'META': 'Technology',
  'MRVL': 'Technology',
  'MSFT': 'Technology',
  'MU': 'Technology',
  'NBIS': 'Technology',
  'NET': 'Technology',
  'NFLX': 'Technology',
  'NVDA': 'Technology',
  'ON': 'Technology',
  'ORCL': 'Technology',
  'PANW': 'Technology',
  'PLTR': 'Technology',
  'QCOM': 'Technology',
  'SAP': 'Technology',
  'SHOP': 'Technology',
  'SIEGY': 'Technology',
  'SNOW': 'Technology',
  'SNPS': 'Technology',
  'SONY': 'Technology',
  'SPOT': 'Technology',
  'SSNLF': 'Technology',
  'TCEHY': 'Technology',
  'TEL': 'Technology',
  'TER': 'Technology',
  'TSEM': 'Technology',
  'TSM': 'Technology',
  'TWLO': 'Technology',
  'ZM': 'Technology',
  'ZS': 'Technology',
  // Healthcare
  'ABBV': 'Healthcare',
  'ABT': 'Healthcare',
  'AZN': 'Healthcare',
  'BMY': 'Healthcare',
  'DHR': 'Healthcare',
  'GSK': 'Healthcare',
  'ISRG': 'Healthcare',
  'JNJ': 'Healthcare',
  'LLY': 'Healthcare',
  'MRK': 'Healthcare',
  'NVO': 'Healthcare',
  'PFE': 'Healthcare',
  'RHHBY': 'Healthcare',
  'TMO': 'Healthcare',
  'UNH': 'Healthcare',
  // Financials
  'BAC': 'Financials',
  'BBVA': 'Financials',
  'COIN': 'Financials',
  'DB': 'Financials',
  'GS': 'Financials',
  'HSBC': 'Financials',
  'ING': 'Financials',
  'JPM': 'Financials',
  'KKR': 'Financials',
  'MA': 'Financials',
  'MS': 'Financials',
  'PYPL': 'Financials',
  'SAN': 'Financials',
  'SQ': 'Financials',
  'UBS': 'Financials',
  'V': 'Financials',
  'WFC': 'Financials',
  // Consumer Discretionary
  'ABNB': 'Consumer Discretionary',
  'AMZN': 'Consumer Discretionary',
  'BABA': 'Consumer Discretionary',
  'CHWY': 'Consumer Discretionary',
  'CMG': 'Consumer Discretionary',
  'COST': 'Consumer Discretionary',
  'CPNG': 'Consumer Discretionary',
  'DASH': 'Consumer Discretionary',
  'DIS': 'Consumer Discretionary',
  'EA': 'Consumer Discretionary',
  'ETSY': 'Consumer Discretionary',
  'F': 'Consumer Discretionary',
  'GM': 'Consumer Discretionary',
  'GRAB': 'Consumer Discretionary',
  'HD': 'Consumer Discretionary',
  'JD': 'Consumer Discretionary',
  'LCID': 'Consumer Discretionary',
  'LI': 'Consumer Discretionary',
  'LULU': 'Consumer Discretionary',
  'LYFT': 'Consumer Discretionary',
  'MCD': 'Consumer Discretionary',
  'MELI': 'Consumer Discretionary',
  'MTCH': 'Consumer Discretionary',
  'NIO': 'Consumer Discretionary',
  'NKE': 'Consumer Discretionary',
  'PDD': 'Consumer Discretionary',
  'PINS': 'Consumer Discretionary',
  'RBLX': 'Consumer Discretionary',
  'RIVN': 'Consumer Discretionary',
  'ROKU': 'Consumer Discretionary',
  'SBUX': 'Consumer Discretionary',
  'SE': 'Consumer Discretionary',
  'SNAP': 'Consumer Discretionary',
  'TCOM': 'Consumer Discretionary',
  'TGT': 'Consumer Discretionary',
  'TM': 'Consumer Discretionary',
  'TSLA': 'Consumer Discretionary',
  'TTWO': 'Consumer Discretionary',
  'U': 'Consumer Discretionary',
  'UBER': 'Consumer Discretionary',
  'W': 'Consumer Discretionary',
  'WBD': 'Consumer Discretionary',
  'XPEV': 'Consumer Discretionary',
  'YUM': 'Consumer Discretionary',
  // Consumer Staples
  'BTI': 'Consumer Staples',
  'BUD': 'Consumer Staples',
  'CL': 'Consumer Staples',
  'DEO': 'Consumer Staples',
  'EL': 'Consumer Staples',
  'GIS': 'Consumer Staples',
  'KHC': 'Consumer Staples',
  'KO': 'Consumer Staples',
  'MO': 'Consumer Staples',
  'NSRGY': 'Consumer Staples',
  'PEP': 'Consumer Staples',
  'PG': 'Consumer Staples',
  'PM': 'Consumer Staples',
  'STZ': 'Consumer Staples',
  'SYY': 'Consumer Staples',
  'WMT': 'Consumer Staples',
  // Energy
  'BP': 'Energy',
  'MARA': 'Energy',
  'OKLO': 'Energy',
  'RIOT': 'Energy',
  'SHEL': 'Energy',
  'XOM': 'Energy',
  // Aerospace & Defense
  'BA': 'Aerospace & Defense',
  'GD': 'Aerospace & Defense',
  'LMT': 'Aerospace & Defense',
  'NOC': 'Aerospace & Defense',
  'RTX': 'Aerospace & Defense',
  // Materials
  'AEM': 'Materials',
  'APD': 'Materials',
  'BHP': 'Materials',
  'ECL': 'Materials',
  'FCX': 'Materials',
  'GOLD': 'Materials',
  'LIN': 'Materials',
  'NEM': 'Materials',
  'NUE': 'Materials',
  'RIO': 'Materials',
  'SHW': 'Materials',
  'VALE': 'Materials',
  // Telecom
  'CMCSA': 'Telecom',
  'T': 'Telecom',
  'VOD': 'Telecom',
  'VZ': 'Telecom',
  // Other
  'ABB': 'Other',
  'CARR': 'Other',
  'CAT': 'Other',
  'DE': 'Other',
  'EMR': 'Other',
  'FDX': 'Other',
  'GE': 'Other',
  'HON': 'Other',
  'JCI': 'Other',
  'MMM': 'Other',
  'ROK': 'Other',
  'SWK': 'Other',
  'UPS': 'Other',
};

function mapFinnhubType(type) {
  if (!type) return 'Stock';
  const t = type.toUpperCase();
  if (t === 'ETP' || t === 'ETF') return 'ETF';
  return 'Stock';
}

/**
 * Initialize a symbol search autocomplete widget.
 * @param {string} searchId - ID of the search input element
 * @param {string} resultsId - ID of the results dropdown element
 * @param {string} chipId - ID of the selected symbol chip element
 * @param {string} tickerHiddenId - ID of the hidden ticker input
 * @param {string} nameHiddenId - ID of the hidden name input
 * @param {string} typeHiddenId - ID of the hidden type input
 */
function initSymbolSearch(searchId, resultsId, chipId, tickerHiddenId, nameHiddenId, typeHiddenId) {
  const searchEl = document.getElementById(searchId);
  const resultsEl = document.getElementById(resultsId);
  const chipEl = document.getElementById(chipId);
  if (!searchEl || !resultsEl || !chipEl) return;

  let debounceTimer = null;
  let currentResults = [];

  function selectSymbol(item) {
    const ticker = item.symbol || item.displaySymbol;
    const name = item.description;
    const type = mapFinnhubType(item.type);
    document.getElementById(tickerHiddenId).value = ticker;
    document.getElementById(nameHiddenId).value = name;
    document.getElementById(typeHiddenId).value = type;

    const typeLabel = type === 'ETF' ? 'ETF' : type === 'Fund' ? 'Fund' : 'Stock';
    const typeClass = type === 'ETF' ? 'badge-etf' : type === 'Fund' ? 'badge-fund' : 'badge-stock';
    chipEl.innerHTML = `
      <span class="badge ${typeClass}" style="font-size:0.6rem;">${escHtml(typeLabel)}</span>
      <span class="chip-ticker">${escHtml(ticker)}</span>
      <span class="chip-name">${escHtml(name)}</span>
      <button class="chip-clear" type="button">✕</button>
    `;
    chipEl.style.display = 'flex';
    searchEl.value = '';
    resultsEl.style.display = 'none';

    // Auto-set sector if we have a lookup
    const sectorLookup = SECTOR_LOOKUP[ticker];
    if (sectorLookup) {
      const setupSector = document.getElementById('setup-holding-sector');
      const addSector = document.getElementById('add-sector');
      if (setupSector) setupSector.value = sectorLookup;
      if (addSector) addSector.value = sectorLookup;
    }

    chipEl.querySelector('.chip-clear').addEventListener('click', () => {
      chipEl.style.display = 'none';
      document.getElementById(tickerHiddenId).value = '';
      document.getElementById(nameHiddenId).value = '';
      document.getElementById(typeHiddenId).value = 'Stock';
      searchEl.value = '';
      searchEl.focus();
    });
  }

  function showResults(items) {
    currentResults = items;
    if (!items.length) {
      resultsEl.style.display = 'none';
      return;
    }
    resultsEl.innerHTML = items.map((item, idx) => {
      const type = mapFinnhubType(item.type);
      const typeLabel = type === 'ETF' ? 'ETF' : type === 'Fund' ? 'Fund' : 'Stock';
      const typeClass = type === 'ETF' ? 'etf' : type === 'Fund' ? 'fund' : 'stock';
      return `<div class="symbol-result-item" data-idx="${idx}">
        <span class="symbol-result-ticker">${escHtml(item.displaySymbol || item.symbol)}</span>
        <span class="symbol-result-name">${escHtml(item.description)}</span>
        <span class="symbol-result-type ${typeClass}">${escHtml(typeLabel)}</span>
      </div>`;
    }).join('');
    resultsEl.style.display = 'block';

    resultsEl.querySelectorAll('.symbol-result-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectSymbol(currentResults[parseInt(el.dataset.idx)]);
      });
    });
  }

  searchEl.addEventListener('input', () => {
    const query = searchEl.value.trim();
    clearTimeout(debounceTimer);
    if (query.length < 1) { resultsEl.style.display = 'none'; return; }

    debounceTimer = setTimeout(async () => {
      let results;
      if (!demoMode && hasApiKey()) {
        results = await searchSymbols(query);
      } else {
        const q = query.toLowerCase();
        results = DEMO_SYMBOLS.filter(s =>
          s.symbol.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
        ).slice(0, 12);
      }
      showResults(results);
    }, 280);
  });

  searchEl.addEventListener('keydown', (e) => {
    const items = resultsEl.querySelectorAll('.symbol-result-item');
    const highlighted = resultsEl.querySelector('.symbol-result-item.highlighted');
    let idx = highlighted ? parseInt(highlighted.dataset.idx) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(idx + 1, items.length - 1);
      items.forEach(el => el.classList.remove('highlighted'));
      if (items[idx]) items[idx].classList.add('highlighted');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(idx - 1, 0);
      items.forEach(el => el.classList.remove('highlighted'));
      if (items[idx]) items[idx].classList.add('highlighted');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted) selectSymbol(currentResults[parseInt(highlighted.dataset.idx)]);
      else if (currentResults.length > 0) selectSymbol(currentResults[0]);
    } else if (e.key === 'Escape') {
      resultsEl.style.display = 'none';
    }
  });

  searchEl.addEventListener('blur', () => {
    setTimeout(() => { resultsEl.style.display = 'none'; }, 200);
  });
}
function initNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  document.querySelectorAll('[data-tab-switch]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tabSwitch));
  });
  // Performance range tabs removed — single full-history chart
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
    setTimeout(() => {
      try { renderPerformanceChart(); } catch(e) {}
      try { renderAllHoldingsPerfChart(); } catch(e) {}
      renderHoldingPerfSelector();
    }, 50);
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

  // Edit & Delete — delegated event listeners on the holdings table
  document.getElementById('holdings-body')?.closest('table')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.holding-edit-btn');
    const deleteBtn = e.target.closest('.holding-delete-btn');

    if (editBtn) {
      const ticker = editBtn.dataset.ticker;
      const holding = portfolio.holdings.find(h => h.ticker === ticker);
      if (!holding) return;
      const newAlloc = prompt(`Nuevo porcentaje para ${ticker} (actual: ${holding.allocation}%):`, holding.allocation);
      if (newAlloc === null) return;
      const parsed = parseFloat(newAlloc);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) { showToast('❌ Porcentaje inválido', 'error'); return; }
      holding.allocation = parsed;
      savePortfolio(portfolio);
      Cache.clearAll();
      loadData();
      showToast(`✅ ${ticker} actualizado a ${parsed}%`, 'success');
    }

    if (deleteBtn) {
      const ticker = deleteBtn.dataset.ticker;
      if (!confirm(`¿Eliminar ${ticker} del portafolio?`)) return;
      portfolio = removeHolding(portfolio, ticker);
      Cache.clearAll();
      loadData();
      showToast(`🗑 ${ticker} eliminado`, 'info');
    }
  });
}

// ============================================
// MODALS
// ============================================
function initModals() {
  // Currency toggle
  document.getElementById('btn-toggle-currency')?.addEventListener('click', () => {
    displayCurrency = displayCurrency === 'CLP' ? 'USD' : 'CLP';
    localStorage.setItem('lfnf_display_currency', displayCurrency);
    renderSummaryCards();
    renderFullHoldings();
    showToast(`💱 Moneda cambiada a ${displayCurrency}`, 'info');
  });

  // Edit Total Value
  document.getElementById('btn-edit-total')?.addEventListener('click', () => {
    const editInline = document.getElementById('total-edit-inline');
    const input = document.getElementById('total-edit-input');
    const currencySelect = document.getElementById('total-edit-currency');
    editInline.style.display = editInline.style.display === 'none' ? 'flex' : 'none';
    if (editInline.style.display !== 'none') {
      currencySelect.value = 'CLP';
      input.value = portfolio.fund.totalValueCLP;
      input.focus();
      input.select();
    }
  });
  // When currency changes in the edit, convert the displayed value
  document.getElementById('total-edit-currency')?.addEventListener('change', () => {
    const curr = document.getElementById('total-edit-currency').value;
    const input = document.getElementById('total-edit-input');
    if (curr === 'USD') {
      input.value = (portfolio.fund.totalValueCLP / usdClpRate).toFixed(2);
    } else {
      input.value = portfolio.fund.totalValueCLP;
    }
    input.focus();
    input.select();
  });
  document.getElementById('total-edit-cancel')?.addEventListener('click', () => {
    document.getElementById('total-edit-inline').style.display = 'none';
  });
  document.getElementById('total-edit-save')?.addEventListener('click', () => {
    const curr = document.getElementById('total-edit-currency').value;
    const raw = document.getElementById('total-edit-input').value.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(raw);
    if (isNaN(val) || val <= 0) { showToast('❌ Valor inválido', 'error'); return; }
    // Convert to CLP if entered in USD
    const clpVal = curr === 'USD' ? Math.round(val * usdClpRate) : Math.round(val);
    portfolio.fund.totalValueCLP = clpVal;
    savePortfolio(portfolio);
    document.getElementById('total-edit-inline').style.display = 'none';
    Cache.clearAll();
    loadData();
    showToast(`✅ Valor base actualizado a ${formatCLP(clpVal)}`, 'success');
  });
  document.getElementById('total-edit-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('total-edit-save').click();
    if (e.key === 'Escape') document.getElementById('total-edit-cancel').click();
  });

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

  addBtn.addEventListener('click', () => {
    addModal.classList.add('active');
    addBackdrop.classList.add('active');
    // Init symbol search for the modal
    initSymbolSearch(
      'add-symbol-search',
      'add-symbol-results',
      'add-selected-symbol',
      'add-ticker',
      'add-name',
      'add-type'
    );
  });
  const closeAdd = () => {
    addModal.classList.remove('active');
    addBackdrop.classList.remove('active');
  };
  document.getElementById('add-holding-close').addEventListener('click', closeAdd);
  document.getElementById('add-holding-cancel').addEventListener('click', closeAdd);
  addBackdrop.addEventListener('click', closeAdd);

  document.getElementById('add-holding-save').addEventListener('click', () => {
    const ticker = document.getElementById('add-ticker').value.trim().toUpperCase();
    const name = document.getElementById('add-name').value.trim();
    const shortName = document.getElementById('add-short-name').value.trim() || ticker;
    const type = document.getElementById('add-type').value || 'Stock';
    const allocation = parseFloat(document.getElementById('add-allocation').value);
    const sector = document.getElementById('add-sector').value;
    const notes = document.getElementById('add-notes').value.trim();

    if (!ticker || !name || isNaN(allocation)) {
      showToast('❌ Selecciona un activo y completa el %', 'error');
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
    // Reset search UI
    const searchEl = document.getElementById('add-symbol-search');
    if (searchEl) searchEl.value = '';
    const selEl = document.getElementById('add-selected-symbol');
    if (selEl) selEl.style.display = 'none';
    document.getElementById('add-ticker').value = '';
    document.getElementById('add-name').value = '';
    document.getElementById('add-short-name').value = '';
    document.getElementById('add-type').value = 'Stock';
    document.getElementById('add-allocation').value = '';
    document.getElementById('add-notes').value = '';
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
