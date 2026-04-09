/**
 * LFNF Fund — ETF Transparency / Decomposition Logic
 * Decomposes ETFs into their underlying holdings to show the "raw" portfolio
 */

import etfHoldingsData from '../../data/etf-holdings.json';

/**
 * Decompose the portfolio: expand each ETF into its underlying holdings,
 * then consolidate duplicate tickers across multiple ETFs and direct holdings.
 *
 * @param {Array} holdings - Portfolio holdings array
 * @returns {Array} Array of decomposed holdings, sorted by effectiveWeight desc
 */
export function decomposePortfolio(holdings) {
  // Map to accumulate real weight per ticker
  const consolidated = new Map();

  for (const holding of holdings) {
    if (holding.type === 'ETF' && etfHoldingsData[holding.ticker]) {
      // Decompose ETF
      const etfData = etfHoldingsData[holding.ticker];
      const etfAllocation = holding.allocation; // % of LFNF

      for (const sub of etfData.holdings) {
        const effectiveWeight = (sub.weight / 100) * etfAllocation;
        const key = normalizeTickerKey(sub.ticker);

        if (consolidated.has(key)) {
          const existing = consolidated.get(key);
          existing.effectiveWeight += effectiveWeight;
          existing.sources.push({
            etf: holding.ticker,
            etfName: holding.name,
            weightInEtf: sub.weight,
            contribution: effectiveWeight,
          });
        } else {
          consolidated.set(key, {
            ticker: sub.ticker,
            name: sub.name,
            sector: sub.sector,
            effectiveWeight,
            type: 'via-ETF',
            sources: [{
              etf: holding.ticker,
              etfName: holding.name,
              weightInEtf: sub.weight,
              contribution: effectiveWeight,
            }],
          });
        }
      }
    } else if (holding.type === 'Stock') {
      // Direct holding
      const key = normalizeTickerKey(holding.ticker);

      if (consolidated.has(key)) {
        const existing = consolidated.get(key);
        existing.effectiveWeight += holding.allocation;
        existing.sources.push({
          etf: null,
          etfName: 'Inversión Directa',
          weightInEtf: 100,
          contribution: holding.allocation,
        });
        // If it was only via-ETF before, now it's "both"
        if (existing.type === 'via-ETF') existing.type = 'both';
      } else {
        consolidated.set(key, {
          ticker: holding.ticker,
          name: holding.name,
          sector: holding.sector,
          effectiveWeight: holding.allocation,
          type: 'direct',
          sources: [{
            etf: null,
            etfName: 'Inversión Directa',
            weightInEtf: 100,
            contribution: holding.allocation,
          }],
        });
      }
    } else if (holding.type === 'ETF' && !etfHoldingsData[holding.ticker]) {
      // ETF without decomposition data — show as-is
      consolidated.set(holding.ticker, {
        ticker: holding.ticker,
        name: holding.name,
        sector: holding.sector || 'Other',
        effectiveWeight: holding.allocation,
        type: 'etf-undecomposed',
        sources: [{
          etf: holding.ticker,
          etfName: holding.name,
          weightInEtf: 100,
          contribution: holding.allocation,
        }],
      });
    }
  }

  // Sort by effective weight descending
  return Array.from(consolidated.values())
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight);
}

/**
 * Calculate real sector exposure from decomposed holdings
 * @param {Array} decomposed - Result from decomposePortfolio
 * @returns {Object} sectors map { sectorName: { allocation, count, holdings } }
 */
export function calculateRealSectors(decomposed) {
  const sectors = {};

  for (const h of decomposed) {
    const sector = h.sector || 'Other';
    if (!sectors[sector]) {
      sectors[sector] = { allocation: 0, count: 0, holdings: [] };
    }
    sectors[sector].allocation += h.effectiveWeight;
    sectors[sector].count++;
    sectors[sector].holdings.push(h.ticker);
  }

  return sectors;
}

/**
 * Get the total coverage percentage — what portion of the portfolio is decomposed
 * @param {Array} holdings
 * @returns {{ covered: number, uncovered: number }}
 */
export function getCoverage(holdings) {
  let covered = 0;
  let uncovered = 0;

  for (const h of holdings) {
    if (h.type === 'Stock') {
      covered += h.allocation;
    } else if (h.type === 'ETF') {
      const etfData = etfHoldingsData[h.ticker];
      if (etfData) {
        covered += h.allocation * (etfData.coverage / 100);
        uncovered += h.allocation * (1 - etfData.coverage / 100);
      } else {
        uncovered += h.allocation;
      }
    }
  }

  return { covered, uncovered };
}

/**
 * Get source badge info for display
 */
export function getSourceBadge(source) {
  if (!source.etf) {
    return { label: '🎯 Directa', cls: 'badge-stock' };
  }
  return { label: `📦 ${source.etf}`, cls: 'badge-etf' };
}

/**
 * Normalize ticker keys so duplicates match (e.g., GOOGL and GOOG → GOOGL)
 */
function normalizeTickerKey(ticker) {
  // Treat GOOG and GOOGL as the same
  if (ticker === 'GOOG') return 'GOOGL';
  // Remove exchange suffixes for display consolidation
  return ticker.split('.')[0];
}

/**
 * Get ETF holdings data for display
 */
export function getEtfHoldingsData() {
  return etfHoldingsData;
}
