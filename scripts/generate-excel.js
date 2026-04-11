/**
 * LFNF Fund — Premium Smart Excel Generator
 * Generates an interactive, formula-driven Excel template connecting to Finnhub via WEBSERVICE.
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
  inputBg: 'FFFFFBEB',      // Amber 50 (Input indication)
  inputBorder: 'FFF59E0B',  // Amber 500
  rowAltBg: 'FFF8FAFC',     // Slate 50
  borderLight: 'FFE2E8F0',  // Slate 200
  formulaBg: 'FFF0FDF4',    // Green 50 (Calculated fields)
};

const BORDER_STYLE = {
  top: { style: 'thin', color: { argb: PALETTE.borderLight } },
  left: { style: 'thin', color: { argb: PALETTE.borderLight } },
  bottom: { style: 'thin', color: { argb: PALETTE.borderLight } },
  right: { style: 'thin', color: { argb: PALETTE.borderLight } }
};

const BORDER_INPUT = {
  top: { style: 'medium', color: { argb: PALETTE.inputBorder } },
  left: { style: 'medium', color: { argb: PALETTE.inputBorder } },
  bottom: { style: 'medium', color: { argb: PALETTE.inputBorder } },
  right: { style: 'medium', color: { argb: PALETTE.inputBorder } }
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
    font: { name: 'Calibri', size: 11, color: { argb: 'FF334155' } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: BORDER_STYLE
  },
  cellAlt: {
    font: { name: 'Calibri', size: 11, color: { argb: 'FF334155' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.rowAltBg } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: BORDER_STYLE
  },
  cellInput: {
    font: { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.inputBg } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: BORDER_INPUT
  },
  cellFormula: {
    font: { name: 'Calibri', size: 11, color: { argb: 'FF334155' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.formulaBg } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: BORDER_STYLE
  },
  cellBold: {
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } },
    alignment: { vertical: 'middle', horizontal: 'left' },
    border: BORDER_STYLE
  }
};

/**
 * Returns a robust WEBSERVICE formula for Finnhub to extract the current price ("c")
 */
function getFinnhubFormula(cellRef) {
  const token = 'd7c0pe1r01quh9fc4230d7c0pe1r01quh9fc423g';
  // Use exact references. Since Excel parses strings, we wrap it properly.
  // Formula logic: Extracts "c" property value from JSON string response.
  return `IF(${cellRef}="","", NUMBERVALUE(MID(WEBSERVICE("https://finnhub.io/api/v1/quote?symbol="&${cellRef}&"&token=${token}"), FIND("""c"":", WEBSERVICE("https://finnhub.io/api/v1/quote?symbol="&${cellRef}&"&token=${token}"))+4, FIND(",", WEBSERVICE("https://finnhub.io/api/v1/quote?symbol="&${cellRef}&"&token=${token}"), FIND("""c"":", WEBSERVICE("https://finnhub.io/api/v1/quote?symbol="&${cellRef}&"&token=${token}"))+4) - (FIND("""c"":", WEBSERVICE("https://finnhub.io/api/v1/quote?symbol="&${cellRef}&"&token=${token}"))+4)), "."))`;
}

async function generateExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LFNF Fund Manager';
  wb.created = new Date();

  const fund = portfolio.fund;
  const holdings = portfolio.holdings;
  
  // ═══════════════════════════════════════════
  // SHEET 1: DASHBOARD
  // ═══════════════════════════════════════════
  const wsDash = wb.addWorksheet('📊 Dashboard', { views: [{ showGridLines: false }] });
  
  wsDash.columns = [
    { width: 4 },   // A
    { width: 35 },  // B
    { width: 30 },  // C
    { width: 4 },   // D
    { width: 35 },  // E
    { width: 20 }   // F
  ];

  wsDash.mergeCells('B2:F3');
  const titleCell = wsDash.getCell('B2');
  titleCell.value = ' LFNF FUND — PORTAFOLIO MAIN DASHBOARD';
  titleCell.style = STYLE.title;

  const createSubheader = (cellRef, text) => {
    const c = wsDash.getCell(cellRef);
    c.value = text;
    c.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  };

  wsDash.mergeCells('B5:C5'); createSubheader('B5', 'DATOS GENERALES DEL FONDO');
  wsDash.mergeCells('E5:F5'); createSubheader('E5', 'MÉTRICAS (Cálculo Automático)');

  const addRow = (rowNum, l1, v1, s1, f1, l2, v2, s2, f2) => {
    const r = wsDash.getRow(rowNum);
    r.getCell('B').value = `  ${l1}`;
    r.getCell('B').style = STYLE.cellBold;
    r.getCell('C').value = v1;
    r.getCell('C').style = s1 || STYLE.cellNormal;
    if (f1) r.getCell('C').numFmt = f1;
    
    r.getCell('E').value = `  ${l2}`;
    r.getCell('E').style = STYLE.cellBold;
    r.getCell('F').value = v2;
    r.getCell('F').style = s2 || STYLE.cellFormula;
    if (f2) r.getCell('F').numFmt = f2;
    r.height = 24;
  };

  // Capital Variable - Input
  addRow(6, 
    'Fondo / Propietario', fund.name, STYLE.cellNormal, null,
    'Suma Asignación (%)', { formula: "SUM('💼 Holdings'!C:C)" }, STYLE.cellFormula, '0.00%');
  
  addRow(7, 
    'Moneda Base', fund.currency, STYLE.cellNormal, null,
    'Cantidad de Holdings', { formula: "COUNTA('💼 Holdings'!A:A)-1" }, STYLE.cellFormula, '0');
    
  addRow(8,
    'TIPO DE CAMBIO (USD a CLP) ✏️', 900, STYLE.cellInput, '"$"#,##0',
    'Benchmark Seleccionado', fund.benchmark, STYLE.cellNormal, null);

  addRow(9, 
    'CAPITAL TOTAL INVERTIDO (CLP) ✏️', fund.totalValueCLP, STYLE.cellInput, '"$"#,##0',
    'Precio Actual Benchmark (USD)', { formula: getFinnhubFormula('"SPY"') }, STYLE.cellFormula, '"$"#,##0.00');

  // Small instructions note
  wsDash.mergeCells('B11:F11');
  const instCell = wsDash.getCell('B11');
  instCell.value = '💡 NOTA: Las celdas en AMARILLO son variables (Inputs). Modifica el Capital Total y el tipo de cambio y toda la Hoja 2 se actualizará.';
  instCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  
  // ═══════════════════════════════════════════
  // SHEET 2: HOLDINGS (DYNAMIC)
  // ═══════════════════════════════════════════
  const wsHold = wb.addWorksheet('💼 Holdings');
  
  wsHold.columns = [
    { header: 'Ticker (Input) ✏️', key: 'ticker', width: 15 },
    { header: 'Nombre (Input) ✏️', key: 'name', width: 40 },
    { header: 'Asignación % (Input) ✏️', key: 'alloc', width: 25 },
    { header: 'Valor Objetivo (CLP) ⚙️', key: 'targetclp', width: 25 },
    { header: 'Precio Mercado (USD) 🌐', key: 'price', width: 25 },
    { header: 'Comprar (Cuotas aprox.) ⚙️', key: 'shares', width: 30 },
  ];

  wsHold.getRow(1).eachCell((cell, colNumber) => {
    cell.style = STYLE.header;
    // Highlight input headers
    if (colNumber <= 3) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Dark amber
    }
  });
  wsHold.getRow(1).height = 25;

  let hRow = 2;
  
  // Create 30 rows setup (18 prefilled, rest blank for user to add)
  for (let i = 0; i < 30; i++) {
    const h = holdings[i] || { ticker: '', name: '', allocation: 0 };
    
    const row = wsHold.addRow({
      ticker: h.ticker,
      name: h.name,
      alloc: h.allocation > 0 ? (h.allocation / 100) : ''
    });
    
    // Style inputs
    row.getCell('ticker').style = STYLE.cellInput;
    row.getCell('name').style = STYLE.cellInput;
    row.getCell('alloc').style = STYLE.cellInput;
    row.getCell('alloc').numFmt = '0.00%';

    // Formulas
    // Target CLP = Alloc * Dashboard Total CLP
    row.getCell('targetclp').value = { formula: `IF(C${hRow}="","", C${hRow}*'📊 Dashboard'!$C$9)` };
    row.getCell('targetclp').style = STYLE.cellFormula;
    row.getCell('targetclp').numFmt = '"$"#,##0';

    // Market Price USD = Finnhub API
    row.getCell('price').value = { formula: getFinnhubFormula(`A${hRow}`) };
    row.getCell('price').style = STYLE.cellFormula;
    row.getCell('price').numFmt = '"$"#,##0.00';

    // Shares to buy = Target CLP / (Price USD * FX)
    row.getCell('shares').value = { formula: `IF(E${hRow}="","", D${hRow}/(E${hRow}*'📊 Dashboard'!$C$8))` };
    row.getCell('shares').style = STYLE.cellFormula;
    row.getCell('shares').numFmt = '0.00';

    hRow++;
  }

  wsHold.autoFilter = `A1:F${hRow - 1}`;
  
  // Add Warning for API 
  const warningRow = wsHold.addRow(['', '', '', '', '', '']);
  warningRow.getCell(2).value = 'Nota: Al abrir el archivo, Excel puede pedir habilitar la conexión de datos (WEBSERVICE). Acéptalo para ver precios reales.';
  warningRow.getCell(2).font = { italic: true, color: { argb: 'FFEF4444' } };

  // ═══════════════════════════════════════════
  // WRITE FILE
  // ═══════════════════════════════════════════
  const outputPath = join(__dirname, '..', 'LFNF_Fund_Management.xlsx');
  await wb.xlsx.writeFile(outputPath);
  
  console.log(`✅ Excel DINÁMICO generado exitosamente en: ${outputPath}`);
}

generateExcel().catch(err => {
    console.error('Error generating Premium Excel:', err);
});
