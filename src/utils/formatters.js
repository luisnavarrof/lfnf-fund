/**
 * LFNF Fund — Number & Currency Formatters
 */

/**
 * Format as Chilean Pesos
 */
export function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format as US Dollars
 */
export function formatUSD(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 2) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format percentage (no sign)
 */
export function formatPercentAbs(value, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers (compact)
 */
export function formatCompact(num) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

/**
 * Format number with separators
 */
export function formatNumber(num, decimals = 0) {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format relative date
 */
export function formatRelativeDate(timestamp) {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  if (diff < minute) return 'Ahora';
  if (diff < hour) return `Hace ${Math.floor(diff / minute)} min`;
  if (diff < day) return `Hace ${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `Hace ${Math.floor(diff / day)}d`;
  
  return new Date(timestamp * 1000).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format date
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format short date
 */
export function formatShortDate(date) {
  return new Date(date).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/**
 * Get gain/loss CSS class
 */
export function gainLossClass(value) {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return '';
}

/**
 * Sector color mapping
 */
export const SECTOR_COLORS = {
  'Technology': '#3b82f6',
  'Healthcare': '#10b981',
  'Financials': '#f59e0b',
  'Consumer Discretionary': '#ec4899',
  'Consumer Staples': '#84cc16',
  'Energy': '#f97316',
  'Aerospace & Defense': '#6366f1',
  'Emerging Markets': '#14b8a6',
  'Multi-Factor': '#8b5cf6',
  'Materials': '#a855f7',
  'Telecom': '#0ea5e9',
  'Other': '#64748b',
};

/**
 * Get color for a sector
 */
export function getSectorColor(sector) {
  return SECTOR_COLORS[sector] || '#64748b';
}

/**
 * Holding colors for charts (curated palette)
 */
export const HOLDING_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
  '#a855f7', // Violet
  '#0ea5e9', // Sky
  '#22c55e', // Green
  '#e11d48', // Rose
  '#eab308', // Yellow
  '#64748b', // Slate
  '#d946ef', // Fuchsia
];
