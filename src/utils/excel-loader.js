/**
 * LFNF Fund — Excel Loader
 * Parses fund-management.xlsx and converts it to the JSON format
 * used internally by the application.
 */

import * as XLSX from 'xlsx';

/**
 * Parse an Excel ArrayBuffer into portfolio data
 * @param {ArrayBuffer} buffer - Excel file contents
 * @returns {{ portfolio: Object, etfHoldings: Object, changelog: Array }}
 */
export function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });

  const result = {
    portfolio: null,
    etfHoldings: null,
    changelog: [],
  };

  // ── Parse Portfolio sheet ──
  if (wb.SheetNames.includes('Portfolio')) {
    result.portfolio = parsePortfolioSheet(wb.Sheets['Portfolio']);
  }

  // ── Parse Holdings sheet ──
  if (wb.SheetNames.includes('Holdings') && result.portfolio) {
    result.portfolio.holdings = parseHoldingsSheet(wb.Sheets['Holdings']);
  }

  // ── Parse ETF_Holdings sheet ──
  if (wb.SheetNames.includes('ETF_Holdings')) {
    result.etfHoldings = parseEtfHoldingsSheet(wb.Sheets['ETF_Holdings']);
  }

  // ── Parse Changelog sheet ──
  if (wb.SheetNames.includes('Changelog')) {
    result.changelog = parseChangelogSheet(wb.Sheets['Changelog']);
  }

  return result;
}

/**
 * Parse the Portfolio sheet (key-value pairs)
 */
function parsePortfolioSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const data = {};

  for (const row of rows) {
    if (!row[0] || row[0] === 'Campo') continue;
    const key = String(row[0]).trim();
    const value = row[1];

    switch (key) {
      case 'Nombre del Fondo':
        data.name = value;
        break;
      case 'Nombre Completo':
        data.fullName = value;
        break;
      case 'Moneda':
        data.currency = value;
        break;
      case 'Valor Total (CLP)':
        data.totalValueCLP = Number(value) || 0;
        break;
      case 'Fecha de Inicio':
        data.inceptionDate = formatExcelDate(value);
        break;
      case 'Broker':
        data.broker = value;
        break;
      case 'Benchmark':
        data.benchmark = value;
        break;
    }
  }

  return { fund: data, holdings: [] };
}

/**
 * Parse the Holdings sheet
 */
function parseHoldingsSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  return rows.map(row => ({
    ticker: String(row['Ticker'] || '').trim().toUpperCase(),
    name: String(row['Nombre'] || '').trim(),
    shortName: String(row['Nombre Corto'] || row['Ticker'] || '').trim(),
    type: normalizeType(String(row['Tipo'] || 'Stock').trim()),
    allocation: parseFloat(row['Asignación (%)'] || row['Asignacion (%)'] || 0),
    sector: String(row['Sector'] || 'Other').trim(),
    addedDate: formatExcelDate(row['Fecha Agregado'] || row['Fecha']),
    officialUrl: String(row['URL Oficial'] || row['URL'] || '').trim(),
    notes: String(row['Notas'] || '').trim(),
  })).filter(h => h.ticker && h.allocation > 0);
}

/**
 * Parse the ETF_Holdings sheet into the etfHoldingsData format
 */
function parseEtfHoldingsSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const etfMap = {};

  for (const row of rows) {
    const etfTicker = String(row['ETF Ticker'] || '').trim().toUpperCase();
    const etfName = String(row['ETF Nombre'] || '').trim();
    const stockTicker = String(row['Stock Ticker'] || '').trim();
    const stockName = String(row['Stock Nombre'] || '').trim();
    const weight = parseFloat(row['Peso en ETF (%)'] || row['Peso (%)'] || 0);
    const sector = String(row['Sector'] || 'Other').trim();

    if (!etfTicker || !stockTicker || weight <= 0) continue;

    if (!etfMap[etfTicker]) {
      etfMap[etfTicker] = {
        name: etfName,
        source: 'Excel Import',
        coverage: 0,
        holdings: [],
      };
    }

    etfMap[etfTicker].holdings.push({
      ticker: stockTicker,
      name: stockName,
      weight,
      sector,
    });
  }

  // Calculate coverage as sum of weights for each ETF
  for (const etf of Object.values(etfMap)) {
    etf.coverage = Math.min(
      100,
      Math.round(etf.holdings.reduce((sum, h) => sum + h.weight, 0))
    );
  }

  return etfMap;
}

/**
 * Parse the Changelog sheet
 */
function parseChangelogSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows.map(row => ({
    date: formatExcelDate(row['Fecha']),
    action: String(row['Acción'] || row['Accion'] || '').trim(),
    ticker: String(row['Ticker'] || '').trim(),
    detail: String(row['Detalle'] || '').trim(),
  }));
}

/**
 * Normalize holding type
 */
function normalizeType(type) {
  const upper = type.toUpperCase();
  if (upper === 'ETF') return 'ETF';
  if (upper === 'STOCK' || upper === 'ACCIÓN' || upper === 'ACCION') return 'Stock';
  return 'Stock';
}

/**
 * Format Excel date to YYYY-MM-DD string
 * Excel dates can be numbers (serial dates) or strings
 */
function formatExcelDate(value) {
  if (!value) return '';

  // If it's already a string in date format, return it
  if (typeof value === 'string') {
    // Try to normalize common date formats
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
    // Try parsing
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return trimmed;
  }

  // If it's an Excel serial date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  return String(value);
}

/**
 * Generate an Excel workbook from the current application state
 * @param {Object} portfolio - Current portfolio data
 * @param {Object} etfHoldings - Current ETF holdings data
 * @param {Array} enrichedHoldings - Holdings with current prices
 * @returns {ArrayBuffer} Excel file as ArrayBuffer
 */
export function generateExcelFromState(portfolio, etfHoldings, enrichedHoldings = []) {
  const wb = XLSX.utils.book_new();

  // ── Portfolio sheet ──
  const portfolioData = [
    ['Campo', 'Valor'],
    ['Nombre del Fondo', portfolio.fund.name || ''],
    ['Nombre Completo', portfolio.fund.fullName || ''],
    ['Moneda', portfolio.fund.currency || 'CLP'],
    ['Valor Total (CLP)', portfolio.fund.totalValueCLP || 0],
    ['Fecha de Inicio', portfolio.fund.inceptionDate || ''],
    ['Broker', portfolio.fund.broker || ''],
    ['Benchmark', portfolio.fund.benchmark || 'SPY'],
  ];
  const wsPortfolio = XLSX.utils.aoa_to_sheet(portfolioData);
  wsPortfolio['!cols'] = [{ wch: 20 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsPortfolio, 'Portfolio');

  // ── Holdings sheet ──
  const holdingsHeader = ['Ticker', 'Nombre', 'Nombre Corto', 'Tipo', 'Asignación (%)', 'Sector', 'Fecha Agregado', 'URL Oficial', 'Notas'];
  const holdingsData = portfolio.holdings.map(h => {
    const enriched = enrichedHoldings.find(e => e.ticker === h.ticker);
    return [
      h.ticker,
      h.name,
      h.shortName || h.ticker,
      h.type,
      h.allocation,
      h.sector,
      h.addedDate || '',
      h.officialUrl || '',
      h.notes || '',
    ];
  });
  const wsHoldings = XLSX.utils.aoa_to_sheet([holdingsHeader, ...holdingsData]);
  wsHoldings['!cols'] = [
    { wch: 8 }, { wch: 45 }, { wch: 14 }, { wch: 6 },
    { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 60 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsHoldings, 'Holdings');

  // ── ETF_Holdings sheet ──
  const etfHeader = ['ETF Ticker', 'ETF Nombre', 'Stock Ticker', 'Stock Nombre', 'Peso en ETF (%)', 'Sector'];
  const etfRows = [];
  for (const [etfTicker, etfData] of Object.entries(etfHoldings)) {
    if (etfTicker === '_meta') continue;
    for (const sub of etfData.holdings) {
      etfRows.push([etfTicker, etfData.name, sub.ticker, sub.name, sub.weight, sub.sector]);
    }
  }
  const wsEtf = XLSX.utils.aoa_to_sheet([etfHeader, ...etfRows]);
  wsEtf['!cols'] = [
    { wch: 10 }, { wch: 45 }, { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsEtf, 'ETF_Holdings');

  // ── Prices sheet (bonus: current market data) ──
  if (enrichedHoldings.length > 0) {
    const pricesHeader = ['Ticker', 'Precio USD', 'Cambio %', 'Alta', 'Baja', 'Valor CLP', 'Valor USD', 'Fecha'];
    const pricesData = enrichedHoldings.map(h => [
      h.ticker,
      h.price || '',
      h.changePercent || '',
      h.high || '',
      h.low || '',
      Math.round(h.valueCLP) || '',
      h.valueUSD ? parseFloat(h.valueUSD.toFixed(2)) : '',
      new Date().toISOString().split('T')[0],
    ]);
    const wsPrices = XLSX.utils.aoa_to_sheet([pricesHeader, ...pricesData]);
    wsPrices['!cols'] = [
      { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPrices, 'Precios');
  }

  // ── Changelog sheet ──
  const changelogHeader = ['Fecha', 'Acción', 'Ticker', 'Detalle'];
  const changelogRows = [
    [new Date().toISOString().split('T')[0], 'EXPORT', 'ALL', 'Exportación desde dashboard'],
  ];
  const wsChangelog = XLSX.utils.aoa_to_sheet([changelogHeader, ...changelogRows]);
  wsChangelog['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsChangelog, 'Changelog');

  // Generate binary
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

/**
 * Validate Excel structure — check that required sheets and columns exist
 * @param {ArrayBuffer} buffer
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateExcelStructure(buffer) {
  const errors = [];
  const warnings = [];

  try {
    const wb = XLSX.read(buffer, { type: 'array' });

    // Check required sheets
    if (!wb.SheetNames.includes('Holdings')) {
      errors.push('Falta la hoja "Holdings" — es obligatoria.');
    }

    if (!wb.SheetNames.includes('Portfolio')) {
      warnings.push('Falta la hoja "Portfolio" — se usarán valores por defecto.');
    }

    if (!wb.SheetNames.includes('ETF_Holdings')) {
      warnings.push('Falta la hoja "ETF_Holdings" — se usará la data de ETFs por defecto.');
    }

    // Check Holdings columns
    if (wb.SheetNames.includes('Holdings')) {
      const ws = wb.Sheets['Holdings'];
      const rows = XLSX.utils.sheet_to_json(ws);
      if (rows.length === 0) {
        errors.push('La hoja "Holdings" está vacía.');
      } else {
        const firstRow = rows[0];
        const requiredCols = ['Ticker', 'Nombre', 'Asignación (%)'];
        for (const col of requiredCols) {
          // Also check alternative column names
          const altCol = col === 'Asignación (%)' ? 'Asignacion (%)' : null;
          if (!(col in firstRow) && !(altCol && altCol in firstRow)) {
            errors.push(`Falta la columna "${col}" en la hoja Holdings.`);
          }
        }

        // Check total allocation
        const totalAlloc = rows.reduce((sum, r) => sum + (parseFloat(r['Asignación (%)'] || r['Asignacion (%)'] || 0)), 0);
        if (totalAlloc < 90 || totalAlloc > 110) {
          warnings.push(`La asignación total es ${totalAlloc.toFixed(1)}% — debería ser ~100%.`);
        }
      }
    }
  } catch (e) {
    errors.push(`Error al leer el archivo: ${e.message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
