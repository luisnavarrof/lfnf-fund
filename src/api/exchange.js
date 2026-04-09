/**
 * LFNF Fund — Exchange Rate API
 * USD → CLP conversion using free API
 */

import { Cache } from './cache.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_KEY = 'exchange_usd_clp';

// Fallback rate in case API fails
let fallbackRate = 950;

/**
 * Get current USD/CLP exchange rate
 * Uses open.er-api.com (no API key needed for basic use)
 * @returns {Promise<number>}
 */
export async function getUsdClpRate() {
  const cached = Cache.get(CACHE_KEY);
  if (cached) return cached;

  try {
    // Primary: ExchangeRate-API (free, no key needed for open endpoint)
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (response.ok) {
      const data = await response.json();
      if (data.rates && data.rates.CLP) {
        const rate = data.rates.CLP;
        fallbackRate = rate;
        Cache.set(CACHE_KEY, rate, CACHE_TTL);
        return rate;
      }
    }
  } catch (error) {
    console.warn('Primary exchange API failed:', error.message);
  }

  try {
    // Fallback: cdn.jsdelivr.net/npm/@fawazahmed0/currency-api
    const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    if (response.ok) {
      const data = await response.json();
      if (data.usd && data.usd.clp) {
        const rate = data.usd.clp;
        fallbackRate = rate;
        Cache.set(CACHE_KEY, rate, CACHE_TTL);
        return rate;
      }
    }
  } catch (error) {
    console.warn('Fallback exchange API failed:', error.message);
  }

  // Last resort: return last known rate or static fallback
  return fallbackRate;
}

/**
 * Convert USD to CLP
 * @param {number} usd 
 * @param {number} rate 
 * @returns {number}
 */
export function usdToClp(usd, rate) {
  return usd * rate;
}

/**
 * Convert CLP to USD
 * @param {number} clp 
 * @param {number} rate 
 * @returns {number}
 */
export function clpToUsd(clp, rate) {
  return clp / rate;
}
