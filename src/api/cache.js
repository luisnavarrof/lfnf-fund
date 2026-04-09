/**
 * LFNF Fund — API Cache System
 * Caches API responses in localStorage with TTL
 */

const CACHE_PREFIX = 'lfnf_cache_';

export class Cache {
  /**
   * Get cached data
   * @param {string} key 
   * @returns {any|null}
   */
  static get(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { data, expiry } = JSON.parse(raw);
      if (Date.now() > expiry) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Set cached data with TTL
   * @param {string} key 
   * @param {any} data 
   * @param {number} ttlMs - Time to live in milliseconds
   */
  static set(key, data, ttlMs = 5 * 60 * 1000) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        data,
        expiry: Date.now() + ttlMs
      }));
    } catch {
      // localStorage full, clear old cache entries
      Cache.clearExpired();
    }
  }

  /**
   * Clear all expired cache entries
   */
  static clearExpired() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(key => {
      try {
        const { expiry } = JSON.parse(localStorage.getItem(key));
        if (Date.now() > expiry) localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Clear all cache
   */
  static clearAll() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(key => localStorage.removeItem(key));
  }
}
