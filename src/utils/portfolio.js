/**
 * LFNF Fund — Portfolio Calculations & Data Management
 */

const PORTFOLIO_STORAGE_KEY = 'lfnf_portfolio';
const HISTORY_STORAGE_KEY = 'lfnf_value_history';

/**
 * Load portfolio from localStorage, falling back to the bundled JSON
 * @param {Object} defaultData - Default portfolio data from JSON import
 * @returns {Object}
 */
export function loadPortfolio(defaultData) {
  try {
    const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Fall through to default
  }
  // Initialize with default data
  savePortfolio(defaultData);
  return defaultData;
}

/**
 * Save portfolio to localStorage
 */
export function savePortfolio(data) {
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Add a new holding
 */
export function addHolding(portfolio, holding) {
  portfolio.holdings.push(holding);
  normalizeAllocations(portfolio);
  savePortfolio(portfolio);
  return portfolio;
}

/**
 * Remove a holding by ticker
 */
export function removeHolding(portfolio, ticker) {
  portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
  normalizeAllocations(portfolio);
  savePortfolio(portfolio);
  return portfolio;
}

/**
 * Update a holding's allocation
 */
export function updateHolding(portfolio, ticker, updates) {
  const holding = portfolio.holdings.find(h => h.ticker === ticker);
  if (holding) {
    Object.assign(holding, updates);
    savePortfolio(portfolio);
  }
  return portfolio;
}

/**
 * Normalize allocations to sum to ~100%
 */
export function normalizeAllocations(portfolio) {
  const total = portfolio.holdings.reduce((sum, h) => sum + h.allocation, 0);
  if (total > 0 && Math.abs(total - 100) > 0.5) {
    portfolio.holdings.forEach(h => {
      h.allocation = parseFloat(((h.allocation / total) * 100).toFixed(1));
    });
  }
}

/**
 * Calculate holding values based on total portfolio value
 * @param {Object} portfolio 
 * @param {Object} quotes - Map of ticker -> quote data
 * @param {number} usdClpRate 
 * @returns {Array} enriched holdings with calculated values
 */
export function calculateHoldingValues(portfolio, quotes, usdClpRate) {
  const totalCLP = portfolio.fund.totalValueCLP;
  const totalUSD = totalCLP / usdClpRate;

  return portfolio.holdings.map(holding => {
    const quote = quotes[holding.ticker];
    const valueCLP = (holding.allocation / 100) * totalCLP;
    const valueUSD = valueCLP / usdClpRate;

    return {
      ...holding,
      price: quote ? quote.c : null,
      change: quote ? quote.d : null,
      changePercent: quote ? quote.dp : null,
      high: quote ? quote.h : null,
      low: quote ? quote.l : null,
      open: quote ? quote.o : null,
      prevClose: quote ? quote.pc : null,
      valueCLP,
      valueUSD,
      hasData: !!quote && quote.c > 0,
    };
  });
}

/**
 * Calculate portfolio summary metrics
 */
export function calculatePortfolioSummary(enrichedHoldings, portfolio, usdClpRate) {
  const totalCLP = portfolio.fund.totalValueCLP;
  const totalUSD = totalCLP / usdClpRate;

  // Weighted average daily change
  let weightedChange = 0;
  let hasAnyData = false;

  enrichedHoldings.forEach(h => {
    if (h.changePercent !== null) {
      weightedChange += (h.allocation / 100) * h.changePercent;
      hasAnyData = true;
    }
  });

  const dailyChangeCLP = hasAnyData ? (weightedChange / 100) * totalCLP : 0;
  const dailyChangeUSD = hasAnyData ? (weightedChange / 100) * totalUSD : 0;

  // Count by type
  const etfCount = enrichedHoldings.filter(h => h.type === 'ETF').length;
  const stockCount = enrichedHoldings.filter(h => h.type === 'Stock').length;

  // Sector breakdown
  const sectors = {};
  enrichedHoldings.forEach(h => {
    if (!sectors[h.sector]) {
      sectors[h.sector] = { allocation: 0, count: 0, holdings: [] };
    }
    sectors[h.sector].allocation += h.allocation;
    sectors[h.sector].count++;
    sectors[h.sector].holdings.push(h.ticker);
  });

  // Top gainers and losers
  const withData = enrichedHoldings.filter(h => h.changePercent !== null);
  const topGainers = [...withData].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
  const topLosers = [...withData].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

  return {
    totalCLP,
    totalUSD,
    dailyChangePercent: weightedChange,
    dailyChangeCLP,
    dailyChangeUSD,
    holdingsCount: enrichedHoldings.length,
    etfCount,
    stockCount,
    sectors,
    topGainers,
    topLosers,
    hasData: hasAnyData,
    usdClpRate,
  };
}

/**
 * Record portfolio value snapshot for historical tracking
 */
export function recordValueSnapshot(totalCLP, totalUSD, dailyChangePercent) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    const today = new Date().toISOString().split('T')[0];
    
    // Only one snapshot per day
    const existing = history.findIndex(h => h.date === today);
    const snapshot = {
      date: today,
      totalCLP,
      totalUSD,
      changePercent: dailyChangePercent,
      timestamp: Date.now(),
    };

    if (existing >= 0) {
      history[existing] = snapshot;
    } else {
      history.push(snapshot);
    }

    // Keep last 365 days
    const trimmed = history.slice(-365);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // silently fail
  }
}

/**
 * Get value history
 */
export function getValueHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Reset portfolio to default
 */
export function resetPortfolio(defaultData) {
  localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  savePortfolio(defaultData);
  return defaultData;
}
