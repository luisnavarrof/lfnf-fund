/**
 * Generate fund-management.xlsx — Standalone Portfolio Management Workbook
 * Run: node scripts/generate-excel.js
 *
 * Creates a rich Excel file with:
 *   1. Dashboard  — Key metrics, sector breakdown, formulas
 *   2. Holdings   — Full holdings list with allocation, sector, notes
 *   3. ETF_Holdings — Underlying ETF composition for transparency
 *   4. Análisis   — Sector aggregation, type breakdown, concentration metrics
 *   5. Changelog  — Manual change log
 */
import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

const portfolio = JSON.parse(readFileSync(join(dataDir, 'portfolio.json'), 'utf8'));
const etfHoldings = JSON.parse(readFileSync(join(dataDir, 'etf-holdings.json'), 'utf8'));

const wb = XLSX.utils.book_new();

// ═══════════════════════════════════════════
// SHEET 1: Dashboard
// ═══════════════════════════════════════════
const fund = portfolio.fund;
const holdings = portfolio.holdings;
const totalAlloc = holdings.reduce((s, h) => s + h.allocation, 0);
const etfCount = holdings.filter(h => h.type === 'ETF').length;
const stockCount = holdings.filter(h => h.type === 'Stock').length;

// Sector aggregation
const sectors = {};
holdings.forEach(h => {
  if (!sectors[h.sector]) sectors[h.sector] = { count: 0, allocation: 0, tickers: [] };
  sectors[h.sector].count++;
  sectors[h.sector].allocation += h.allocation;
  sectors[h.sector].tickers.push(h.ticker);
});
const sectorEntries = Object.entries(sectors).sort((a, b) => b[1].allocation - a[1].allocation);

// Top 5 holdings
const topHoldings = [...holdings].sort((a, b) => b.allocation - a.allocation).slice(0, 5);

// HHI (Herfindahl–Hirschman Index) — concentration metric
const hhi = holdings.reduce((sum, h) => sum + Math.pow(h.allocation, 2), 0);
const effectiveN = 10000 / hhi; // Effective number of holdings

const dashboardData = [
  // Header
  ['', '', '', '', ''],
  ['  LFNF FUND — PORTFOLIO DASHBOARD', '', '', '', ''],
  ['', '', '', '', ''],
  // Fund Info
  ['  INFORMACIÓN DEL FONDO', '', '', '  MÉTRICAS CLAVE', ''],
  ['  Nombre', fund.name, '', '  Total Holdings', holdings.length],
  ['  Propietario', fund.fullName, '', '  ETFs', etfCount],
  ['  Moneda', fund.currency, '', '  Acciones', stockCount],
  ['  Valor Total (CLP)', fund.totalValueCLP, '', '  Asignación Total', `${totalAlloc.toFixed(1)}%`],
  ['  Broker', fund.broker, '', '  Concentración (HHI)', Math.round(hhi)],
  ['  Fecha Inicio', fund.inceptionDate, '', '  Nro. Efectivo Holdings', effectiveN.toFixed(1)],
  ['  Benchmark', fund.benchmark, '', '', ''],
  ['', '', '', '', ''],
  // Top 5
  ['  TOP 5 HOLDINGS', '', 'Asignación', '', ''],
  ...topHoldings.map((h, i) => [`  ${i + 1}. ${h.ticker}`, h.name, `${h.allocation}%`, '', '']),
  ['', '', '', '', ''],
  // Sector Breakdown
  ['  DISTRIBUCIÓN SECTORIAL', '', '', '', ''],
  ['  Sector', '# Holdings', 'Asignación', 'Tickers', ''],
  ...sectorEntries.map(([name, data]) => [
    `  ${name}`, data.count, `${data.allocation.toFixed(1)}%`, data.tickers.join(', '), ''
  ]),
  ['', '', '', '', ''],
  // Type Breakdown
  ['  DISTRIBUCIÓN POR TIPO', '', '', '', ''],
  ['  Tipo', '# Holdings', 'Asignación', '', ''],
  ['  ETF', etfCount, `${holdings.filter(h => h.type === 'ETF').reduce((s, h) => s + h.allocation, 0).toFixed(1)}%`, '', ''],
  ['  Stock', stockCount, `${holdings.filter(h => h.type === 'Stock').reduce((s, h) => s + h.allocation, 0).toFixed(1)}%`, '', ''],
  ['', '', '', '', ''],
  ['  Última actualización:', new Date().toISOString().split('T')[0], '', '', ''],
];

const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardData);
wsDashboard['!cols'] = [{ wch: 28 }, { wch: 45 }, { wch: 16 }, { wch: 25 }, { wch: 20 }];

// Merge header cell
wsDashboard['!merges'] = [
  { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Title
];
XLSX.utils.book_append_sheet(wb, wsDashboard, 'Dashboard');

// ═══════════════════════════════════════════
// SHEET 2: Holdings
// ═══════════════════════════════════════════
const holdingsHeader = [
  'Ticker', 'Nombre', 'Nombre Corto', 'Tipo', 'Asignación (%)',
  'Sector', 'Fecha Agregado', 'URL Oficial', 'Notas'
];
const holdingsRows = holdings.map(h => [
  h.ticker,
  h.name,
  h.shortName || h.ticker,
  h.type,
  h.allocation,
  h.sector,
  h.addedDate || '',
  h.officialUrl || '',
  h.notes || '',
]);

// Add summary row at the bottom
const summaryRow = [
  'TOTAL', `${holdings.length} holdings`, '', '', totalAlloc,
  `${Object.keys(sectors).length} sectores`, '', '', ''
];

const wsHoldings = XLSX.utils.aoa_to_sheet([holdingsHeader, ...holdingsRows, [], summaryRow]);
wsHoldings['!cols'] = [
  { wch: 8 },  // Ticker
  { wch: 45 }, // Nombre
  { wch: 14 }, // Nombre Corto
  { wch: 7 },  // Tipo
  { wch: 14 }, // Asignación
  { wch: 24 }, // Sector
  { wch: 14 }, // Fecha
  { wch: 60 }, // URL
  { wch: 45 }, // Notas
];

// Autofilter on holdings
wsHoldings['!autofilter'] = { ref: `A1:I${holdingsRows.length + 1}` };
XLSX.utils.book_append_sheet(wb, wsHoldings, 'Holdings');

// ═══════════════════════════════════════════
// SHEET 3: ETF_Holdings
// ═══════════════════════════════════════════
const etfHeader = [
  'ETF Ticker', 'ETF Nombre', 'Stock Ticker', 'Stock Nombre',
  'Peso en ETF (%)', 'Sector', 'Peso Real en Portfolio (%)'
];
const etfRows = [];

// Calculate ETF allocation map
const etfAllocMap = {};
holdings.filter(h => h.type === 'ETF').forEach(h => { etfAllocMap[h.ticker] = h.allocation; });

for (const [etfTicker, etfData] of Object.entries(etfHoldings)) {
  if (etfTicker === '_meta') continue;
  const etfAlloc = etfAllocMap[etfTicker] || 0;
  for (const sub of etfData.holdings) {
    const realWeight = (sub.weight / 100) * etfAlloc;
    etfRows.push([
      etfTicker,
      etfData.name,
      sub.ticker,
      sub.name,
      sub.weight,
      sub.sector,
      parseFloat(realWeight.toFixed(3)),
    ]);
  }
}

// Sort by real portfolio weight descending
etfRows.sort((a, b) => b[6] - a[6]);

const wsEtf = XLSX.utils.aoa_to_sheet([etfHeader, ...etfRows]);
wsEtf['!cols'] = [
  { wch: 10 }, { wch: 45 }, { wch: 12 }, { wch: 35 },
  { wch: 16 }, { wch: 24 }, { wch: 22 },
];
wsEtf['!autofilter'] = { ref: `A1:G${etfRows.length + 1}` };
XLSX.utils.book_append_sheet(wb, wsEtf, 'ETF_Holdings');

// ═══════════════════════════════════════════
// SHEET 4: Análisis — Decomposed real exposure
// ═══════════════════════════════════════════
// Consolidate all holdings (direct + via ETF) into real stocks
const consolidated = new Map();

for (const h of holdings) {
  if (h.type === 'Stock') {
    const key = h.ticker;
    if (consolidated.has(key)) {
      consolidated.get(key).directAlloc += h.allocation;
    } else {
      consolidated.set(key, {
        ticker: h.ticker,
        name: h.name,
        sector: h.sector,
        directAlloc: h.allocation,
        viaEtfAlloc: 0,
        etfSources: [],
      });
    }
  }
}

for (const [etfTicker, etfData] of Object.entries(etfHoldings)) {
  if (etfTicker === '_meta') continue;
  const etfAlloc = etfAllocMap[etfTicker] || 0;
  if (etfAlloc === 0) continue;

  for (const sub of etfData.holdings) {
    const effectiveWeight = (sub.weight / 100) * etfAlloc;
    const key = sub.ticker === 'GOOG' ? 'GOOGL' : sub.ticker.split('.')[0];

    if (consolidated.has(key)) {
      consolidated.get(key).viaEtfAlloc += effectiveWeight;
      consolidated.get(key).etfSources.push(etfTicker);
    } else {
      consolidated.set(key, {
        ticker: sub.ticker,
        name: sub.name,
        sector: sub.sector,
        directAlloc: 0,
        viaEtfAlloc: effectiveWeight,
        etfSources: [etfTicker],
      });
    }
  }
}

const analysisHeader = [
  'Ticker', 'Nombre', 'Sector', 'Exposición Directa (%)',
  'Exposición vía ETF (%)', 'Exposición Total (%)', 'Fuente(s)',
  'Tipo Exposición'
];

const analysisRows = Array.from(consolidated.values())
  .map(h => {
    const total = h.directAlloc + h.viaEtfAlloc;
    const type = h.directAlloc > 0 && h.viaEtfAlloc > 0 ? 'Ambas'
               : h.directAlloc > 0 ? 'Directa'
               : 'Vía ETF';
    const sources = h.directAlloc > 0 ? ['Directa', ...new Set(h.etfSources)].join(', ')
                  : [...new Set(h.etfSources)].join(', ');
    return [
      h.ticker, h.name, h.sector,
      parseFloat(h.directAlloc.toFixed(2)),
      parseFloat(h.viaEtfAlloc.toFixed(3)),
      parseFloat(total.toFixed(3)),
      sources,
      type,
    ];
  })
  .sort((a, b) => b[5] - a[5]);

// Sector summary for analysis
const realSectors = {};
for (const row of analysisRows) {
  const sector = row[2];
  if (!realSectors[sector]) realSectors[sector] = { count: 0, allocation: 0 };
  realSectors[sector].count++;
  realSectors[sector].allocation += row[5];
}
const realSectorEntries = Object.entries(realSectors).sort((a, b) => b[1].allocation - a[1].allocation);

const analysisSummary = [
  [],
  ['RESUMEN SECTORIAL REAL (ETFs descompuestos)', '', '', '', '', '', '', ''],
  ['Sector', '# Acciones', 'Exposición Total (%)', '', '', '', '', ''],
  ...realSectorEntries.map(([name, data]) => [
    name, data.count, parseFloat(data.allocation.toFixed(2)), '', '', '', '', ''
  ]),
  [],
  ['ESTADÍSTICAS', '', '', '', '', '', '', ''],
  ['Total acciones reales (únicas)', analysisRows.length, '', '', '', '', '', ''],
  ['Acciones con exposición directa', analysisRows.filter(r => r[3] > 0).length, '', '', '', '', '', ''],
  ['Acciones sólo vía ETF', analysisRows.filter(r => r[7] === 'Vía ETF').length, '', '', '', '', '', ''],
  ['Acciones en ambas', analysisRows.filter(r => r[7] === 'Ambas').length, '', '', '', '', '', ''],
];

const wsAnalysis = XLSX.utils.aoa_to_sheet([analysisHeader, ...analysisRows, ...analysisSummary]);
wsAnalysis['!cols'] = [
  { wch: 10 }, { wch: 35 }, { wch: 24 }, { wch: 20 },
  { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 14 },
];
wsAnalysis['!autofilter'] = { ref: `A1:H${analysisRows.length + 1}` };
XLSX.utils.book_append_sheet(wb, wsAnalysis, 'Análisis');

// ═══════════════════════════════════════════
// SHEET 5: Changelog
// ═══════════════════════════════════════════
const changelogHeader = ['Fecha', 'Acción', 'Ticker', 'Detalle'];
const changelogRows = [
  [new Date().toISOString().split('T')[0], 'INIT', 'ALL', 'Portafolio inicial generado automáticamente'],
  ['', '', '', ''],
  ['', '', '', ''],
  ['', '', '', ''],
  ['', '', '', ''],
  // Leave empty rows for the user to fill
];

const wsChangelog = XLSX.utils.aoa_to_sheet([changelogHeader, ...changelogRows]);
wsChangelog['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, wsChangelog, 'Changelog');

// ═══════════════════════════════════════════
// Write file
// ═══════════════════════════════════════════
const outputPath = join(__dirname, '..', 'fund-management.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`✅ Excel generado: ${outputPath}`);
console.log(`   📊 Dashboard: métricas clave, top 5, sectores, tipo`);
console.log(`   💼 Holdings: ${holdingsRows.length} activos (con autofiltro)`);
console.log(`   📦 ETF_Holdings: ${etfRows.length} posiciones subyacentes (con peso real en portfolio)`);
console.log(`   🔍 Análisis: ${analysisRows.length} acciones reales únicas, ${realSectorEntries.length} sectores`);
console.log(`   📝 Changelog: listo para registrar cambios`);
