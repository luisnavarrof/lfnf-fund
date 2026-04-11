/**
 * LFNF Fund — Premium Excel Generator
 * Generates a highly stylized, professional, standalone Excel file.
 */
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

const portfolio = JSON.parse(readFileSync(join(dataDir, 'portfolio.json'), 'utf8'));
const etfHoldings = JSON.parse(readFileSync(join(dataDir, 'etf-holdings.json'), 'utf8'));

// Modern Professional Design Palette
const PALETTE = {
  headerBg: 'FF0F172A',     // Slate 900
  headerBgAccent: 'FF3B82F6', // Blue 500
  headerText: 'FFFFFFFF',   // White
  rowAltBg: 'FFF8FAFC',     // Slate 50
  borderLight: 'FFE2E8F0',  // Slate 200
  positive: 'FF10B981',     // Emerald 500
  negative: 'FFEF4444',     // Red 500
};

const BORDER_STYLE = {
  top: { style: 'thin', color: { argb: PALETTE.borderLight } },
  left: { style: 'thin', color: { argb: PALETTE.borderLight } },
  bottom: { style: 'thin', color: { argb: PALETTE.borderLight } },
  right: { style: 'thin', color: { argb: PALETTE.borderLight } }
};

const STYLE = {
  header: {
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: PALETTE.headerText } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBg } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: BORDER_STYLE
  },
  title: {
    font: { name: 'Calibri', size: 16, bold: true, color: { argb: PALETTE.headerText } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.headerBgAccent } },
    alignment: { vertical: 'middle', horizontal: 'left' }
  },
  cellNormal: {
    font: { name: 'Calibri', size: 11, color: { argb: 'FF334155' } }, // Slate 700
    alignment: { vertical: 'middle' },
    border: BORDER_STYLE
  },
  cellAlt: {
    font: { name: 'Calibri', size: 11, color: { argb: 'FF334155' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.rowAltBg } },
    alignment: { vertical: 'middle' },
    border: BORDER_STYLE
  },
  cellBold: {
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } },
    alignment: { vertical: 'middle' },
    border: BORDER_STYLE
  }
};

async function generateExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LFNF Fund Manager';
  wb.created = new Date();

  // ═══════════════════════════════════════════
  // DATA PREP
  // ═══════════════════════════════════════════
  const fund = portfolio.fund;
  const holdings = portfolio.holdings;
  
  // Consolidate ETFs and Stocks
  let maxAllocationObj = { ticker: '-', allocation: 0, name: '-' };
  let etfCount = 0;
  let stockCount = 0;
  const sectors = {};
  
  holdings.forEach(h => {
    if (h.type === 'ETF') etfCount++;
    if (h.type === 'Stock') stockCount++;
    if (!sectors[h.sector]) sectors[h.sector] = { count: 0, allocation: 0 };
    sectors[h.sector].count++;
    sectors[h.sector].allocation += h.allocation;
    if (h.allocation > maxAllocationObj.allocation) {
      maxAllocationObj = h;
    }
  });
  
  const sectorEntries = Object.entries(sectors).sort((a, b) => b[1].allocation - a[1].allocation);

  // ═══════════════════════════════════════════
  // SHEET 1: DASHBOARD
  // ═══════════════════════════════════════════
  const wsDash = wb.addWorksheet('📊 Dashboard', { views: [{ showGridLines: false }] });
  
  wsDash.columns = [
    { width: 4 },   // A - Spacer
    { width: 28 },  // B - Metric Label
    { width: 28 },  // C - Metric Value
    { width: 4 },   // D - Spacer
    { width: 33 },  // E - Analytics Label
    { width: 14 }   // F - Analytics Value
  ];

  // Header
  wsDash.mergeCells('B2:F3');
  const titleCell = wsDash.getCell('B2');
  titleCell.value = ' LFNF FUND — PORTAFOLIO DASHBOARD';
  titleCell.style = STYLE.title;

  // Fund Info Block
  const createSubheader = (cellRef, text) => {
    const c = wsDash.getCell(cellRef);
    c.value = text;
    c.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  };

  wsDash.mergeCells('B5:C5'); createSubheader('B5', 'INFORMACIÓN DEL FONDO');
  wsDash.mergeCells('E5:F5'); createSubheader('E5', 'MÉTRICAS CLAVE');

  const addDashRow = (rowNum, label1, val1, format1, label2, val2, format2) => {
    const r = wsDash.getRow(rowNum);
    // Left Metric
    r.getCell('B').value = `  ${label1}`;
    r.getCell('B').style = STYLE.cellBold;
    r.getCell('C').value = val1;
    r.getCell('C').style = STYLE.cellNormal;
    if (format1) r.getCell('C').numFmt = format1;
    
    // Right Metric
    r.getCell('E').value = `  ${label2}`;
    r.getCell('E').style = STYLE.cellBold;
    r.getCell('F').value = val2;
    r.getCell('F').style = STYLE.cellNormal;
    r.getCell('F').alignment = { horizontal: 'center' };
    if (format2) r.getCell('F').numFmt = format2;
    r.height = 20;
  };

  addDashRow(6, 'Nombre', fund.name, null, 'Total Holdings', holdings.length, null);
  addDashRow(7, 'Propietario', fund.fullName, null, 'Total ETFs', etfCount, null);
  addDashRow(8, 'Moneda', fund.currency, null, 'Total Acciones', stockCount, null);
  addDashRow(9, 'Valor Total (Estimado)', fund.totalValueCLP, '"$"#,##0', 'Asignación Total', holdings.reduce((s, h) => s + h.allocation, 0) / 100, '0.0%');
  addDashRow(10, 'Broker', fund.broker, null, 'Top Holding', maxAllocationObj.ticker, null);
  addDashRow(11, 'Benchmark', fund.benchmark, null, 'Mayor Sector', sectorEntries.length > 0 ? sectorEntries[0][0] : '-', null);
  
  // Sectors Breakdown
  wsDash.mergeCells('B14:C14'); createSubheader('B14', 'DISTRIBUCIÓN SECTORIAL');
  wsDash.getRow(15).values = ['', 'Sector', 'Asignación'];
  wsDash.getCell('B15').style = STYLE.header; wsDash.getCell('C15').style = STYLE.header;
  
  let rowIdx = 16;
  for (const [sector, d] of sectorEntries) {
    wsDash.getRow(rowIdx).values = ['', sector, d.allocation / 100];
    wsDash.getCell(`B${rowIdx}`).style = (rowIdx%2===0)? STYLE.cellAlt:STYLE.cellNormal;
    wsDash.getCell(`C${rowIdx}`).style = (rowIdx%2===0)? STYLE.cellAlt:STYLE.cellNormal;
    wsDash.getCell(`C${rowIdx}`).numFmt = '0.00%';
    rowIdx++;
  }

  // ═══════════════════════════════════════════
  // SHEET 2: HOLDINGS
  // ═══════════════════════════════════════════
  const wsHold = wb.addWorksheet('💼 Holdings');
  
  wsHold.columns = [
    { header: 'Ticker', key: 'ticker', width: 10 },
    { header: 'Nombre / Empresa', key: 'name', width: 35 },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Sector', key: 'sector', width: 25 },
    { header: 'Asignación (%)', key: 'alloc', width: 15 },
    { header: 'Valor Est. (CLP)', key: 'val', width: 18 },
    { header: 'Notas', key: 'notes', width: 40 },
  ];

  // Apply Header Style
  wsHold.getRow(1).eachCell(cell => { cell.style = STYLE.header; });
  wsHold.getRow(1).height = 25;

  let hRow = 2;
  const totalValueRef = fund.totalValueCLP;
  
  holdings.forEach(h => {
    const row = wsHold.addRow({
      ticker: h.ticker,
      name: h.name,
      type: h.type,
      sector: h.sector,
      alloc: h.allocation / 100, // Excel % format needs decimal
      notes: h.notes || ''
    });
    
    // Formula for Estimated Value based on %
    row.getCell('val').value = { formula: `E${hRow}*${totalValueRef}` };
    
    // Styling
    const styleToUse = (hRow % 2 === 0) ? STYLE.cellAlt : STYLE.cellNormal;
    row.eachCell(cell => { cell.style = Object.assign({}, styleToUse); });
    
    // Formatting
    row.getCell('alloc').numFmt = '0.00%';
    row.getCell('val').numFmt = '"$"#,##0';
    
    hRow++;
  });

  wsHold.autoFilter = `A1:G${hRow - 1}`;

  // ═══════════════════════════════════════════
  // SHEET 3: ETF TRANSPARENCIA
  // ═══════════════════════════════════════════
  const wsEtf = wb.addWorksheet('🔍 ETF_Holdings');
  
  wsEtf.columns = [
    { header: 'ETF Padre', key: 'etf', width: 12 },
    { header: 'Nombre del Fondo', key: 'etfName', width: 35 },
    { header: 'Ticker Real', key: 'stock', width: 12 },
    { header: 'Nombre Empresa', key: 'stockName', width: 35 },
    { header: 'Sector', key: 'sector', width: 25 },
    { header: 'Peso en ETF', key: 'weight', width: 15 },
    { header: 'Exposición Total (% en Portafolio)', key: 'realWeight', width: 28 },
  ];

  wsEtf.getRow(1).eachCell(cell => { cell.style = STYLE.header; });
  wsEtf.getRow(1).height = 25;

  let eRow = 2;
  const etfAllocMap = {};
  holdings.filter(h => h.type === 'ETF').forEach(h => { etfAllocMap[h.ticker] = h.allocation; });

  const customEtfRows = [];
  for (const [etfTicker, etfData] of Object.entries(etfHoldings)) {
    if (etfTicker === '_meta') continue;
    const etfAlloc = etfAllocMap[etfTicker] || 0;
    
    for (const sub of etfData.holdings) {
      const realWeight = (sub.weight / 100) * etfAlloc;
      customEtfRows.push({
        etf: etfTicker,
        etfName: etfData.name,
        stock: sub.ticker,
        stockName: sub.name,
        sector: sub.sector,
        weight: sub.weight / 100,
        realWeight: realWeight / 100
      });
    }
  }

  // Sort by real portfolio weight descending
  customEtfRows.sort((a, b) => b.realWeight - a.realWeight);

  customEtfRows.forEach(data => {
    const row = wsEtf.addRow(data);
    const styleToUse = (eRow % 2 === 0) ? STYLE.cellAlt : STYLE.cellNormal;
    row.eachCell(cell => { cell.style = Object.assign({}, styleToUse); });
    
    row.getCell('weight').numFmt = '0.00%';
    row.getCell('realWeight').numFmt = '0.00%';
    
    if (data.realWeight >= 0.01) {
      row.getCell('realWeight').font = { ...styleToUse.font, bold: true, color: { argb: PALETTE.headerBgAccent } };
    }
    
    eRow++;
  });
  
  wsEtf.autoFilter = `A1:G${eRow - 1}`;

  // ═══════════════════════════════════════════
  // WRITE FILE
  // ═══════════════════════════════════════════
  const outputPath = join(__dirname, '..', 'fund-management.xlsx');
  await wb.xlsx.writeFile(outputPath);
  
  console.log(`✅ Excel PREMIUM generado exitosamente en: ${outputPath}`);
}

generateExcel().catch(err => {
    console.error('Error generating Premium Excel:', err);
});
