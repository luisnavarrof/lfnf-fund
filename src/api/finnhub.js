/**
 * LFNF Fund — Finnhub API Client
 * Free tier: 60 calls/minute
 * Docs: https://finnhub.io/docs/api
 */

import { Cache } from './cache.js';

const BASE_URL = 'https://finnhub.io/api/v1';
const CACHE_TTL_QUOTE = 5 * 60 * 1000;       // 5 min for quotes
const CACHE_TTL_NEWS = 15 * 60 * 1000;        // 15 min for news
const CACHE_TTL_CANDLES = 60 * 60 * 1000;     // 1 hour for candles
const RATE_LIMIT_DELAY = 1100;                  // ~55 calls/min to stay safe

let lastCallTime = 0;

/**
 * Get the API key from localStorage
 */
export function getApiKey() {
  return localStorage.getItem('lfnf_finnhub_key') || '';
}

/**
 * Set the API key in localStorage
 */
export function setApiKey(key) {
  localStorage.setItem('lfnf_finnhub_key', key.trim());
}

/**
 * Check if API key is configured
 */
export function hasApiKey() {
  return !!getApiKey();
}

/**
 * Rate-limited fetch
 */
async function rateLimitedFetch(url) {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY - elapsed));
  }
  lastCallTime = Date.now();
  
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid API key');
    if (response.status === 429) throw new Error('Rate limit exceeded');
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Get stock/ETF quote
 * @param {string} symbol - Ticker symbol
 * @returns {Promise<{c: number, d: number, dp: number, h: number, l: number, o: number, pc: number, t: number}>}
 */
export async function getQuote(symbol) {
  const cacheKey = `quote_${symbol}`;
  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const data = await rateLimitedFetch(
      `${BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`
    );
    
    // Validate response (some tickers might return zeros)
    if (data && data.c !== undefined && data.c > 0) {
      Cache.set(cacheKey, data, CACHE_TTL_QUOTE);
      return data;
    }
    
    // Return data even if zero (ticker might be valid but market closed)
    if (data && data.c !== undefined) {
      Cache.set(cacheKey, data, CACHE_TTL_QUOTE);
      return data;
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to get quote for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Get stock candles (historical data)
 * @param {string} symbol 
 * @param {string} resolution - 1, 5, 15, 30, 60, D, W, M
 * @param {number} from - UNIX timestamp
 * @param {number} to - UNIX timestamp
 */
export async function getCandles(symbol, resolution = 'D', from, to) {
  const cacheKey = `candles_${symbol}_${resolution}_${from}_${to}`;
  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const data = await rateLimitedFetch(
      `${BASE_URL}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`
    );
    
    if (data && data.s === 'ok' && data.c && data.c.length > 0) {
      Cache.set(cacheKey, data, CACHE_TTL_CANDLES);
      return data;
    }
    
    // For newer tickers, try shorter period
    return null;
  } catch (error) {
    console.warn(`Failed to get candles for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Get company news
 * @param {string} symbol 
 * @param {string} from - YYYY-MM-DD
 * @param {string} to - YYYY-MM-DD
 */
export async function getCompanyNews(symbol, from, to) {
  const cacheKey = `news_${symbol}_${from}_${to}`;
  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const data = await rateLimitedFetch(
      `${BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`
    );
    
    if (Array.isArray(data)) {
      Cache.set(cacheKey, data, CACHE_TTL_NEWS);
      return data;
    }
    return [];
  } catch (error) {
    console.warn(`Failed to get news for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Get general market news
 * @param {string} category - general, forex, crypto, merger
 */
export async function getMarketNews(category = 'general') {
  const cacheKey = `market_news_${category}`;
  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const data = await rateLimitedFetch(
      `${BASE_URL}/news?category=${category}&token=${apiKey}`
    );
    if (Array.isArray(data)) {
      Cache.set(cacheKey, data, CACHE_TTL_NEWS);
      return data;
    }
    return [];
  } catch (error) {
    console.warn(`Failed to get market news:`, error.message);
    return [];
  }
}

/**
 * Batch fetch quotes for multiple symbols with rate limiting
 * @param {string[]} symbols 
 * @returns {Promise<Object.<string, QuoteData>>}
 */
export async function getBatchQuotes(symbols) {
  const results = {};
  
  for (const symbol of symbols) {
    const quote = await getQuote(symbol);
    if (quote) {
      results[symbol] = quote;
    }
  }
  
  return results;
}

/**
 * Fetch news for multiple portfolio symbols
 * @param {string[]} symbols
 * @param {number} daysBack
 * @returns {Promise<Array>}
 */
export async function getPortfolioNews(symbols, daysBack = 3) {
  const to = new Date().toISOString().split('T')[0];
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const from = fromDate.toISOString().split('T')[0];

  const allNews = [];
  
  // Only fetch news for a subset to avoid rate limiting
  const newsSymbols = symbols.slice(0, 8);
  
  for (const symbol of newsSymbols) {
    const news = await getCompanyNews(symbol, from, to);
    if (news && news.length > 0) {
      // Add related symbol to each news item
      news.forEach(n => {
        if (!n.relatedTickers) n.relatedTickers = [];
        if (!n.relatedTickers.includes(symbol)) n.relatedTickers.push(symbol);
      });
      allNews.push(...news.slice(0, 5)); // Max 5 per symbol
    }
  }

  // Sort by datetime descending, remove duplicates by id
  const seen = new Set();
  return allNews
    .sort((a, b) => b.datetime - a.datetime)
    .filter(n => {
      const key = n.id || n.headline;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

/**
 * Validate API key by making a test call
 */
export async function validateApiKey(key) {
  try {
    const response = await fetch(`${BASE_URL}/quote?symbol=AAPL&token=${key}`);
    if (response.status === 401) return false;
    if (response.status === 403) return false;
    const data = await response.json();
    return data && data.c !== undefined;
  } catch {
    return false;
  }
}
