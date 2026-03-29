/**
 * Search Suggestions Service
 * שירות הצעות חיפוש
 * 
 * תכונות:
 * - קבלת הצעות חיפוש מ-AliExpress
 * - מטמון הצעות (Cache)
 * - Fallback להצעות מקומיות
 */

const CACHE_KEY = 'ALISMART_SEARCH_SUGGESTIONS_CACHE';
const CACHE_TTL = 5 * 60 * 1000; // 5 דקות

/**
 * מביא הצעות חיפוש מה-API
 * @param {string} query - מילת החיפוש
 * @param {string} language - שפה (he/en)
 * @returns {Promise<Array>} רשימת הצעות
 */
export async function fetchSearchSuggestions(query, language = 'en') {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    // בדיקת מטמון
    const cached = getCachedSuggestions(query);
    if (cached) {
      return cached;
    }

    // קריאה ל-API של עליאקספרס
    const response = await fetch(
      `https://suggest.aliexpress.com/api/suggest?query=${encodeURIComponent(query)}&site=glo&lang=${language === 'he' ? 'he' : 'en'}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const suggestions = data.suggestions?.map(s => s.keyword) || [];

    // שמירה במטמון
    cacheSuggestions(query, suggestions);

    return suggestions.slice(0, 8);
  } catch (error) {
    console.warn('[SearchSuggestions] Failed to fetch, using fallback:', error);
    return getFallbackSuggestions(query, language);
  }
}

/**
 * מביא הצעות פופולריות
 * @param {string} language - שפה
 * @returns {Array} רשימת חיפושים פופולריים
 */
export function getPopularSearches(language = 'en') {
  const popular = {
    en: [
      'wireless earbuds',
      'phone case',
      'smart watch',
      'bluetooth speaker',
      'led lights',
      'usb c cable',
      'laptop stand',
      'kitchen gadget',
      'home decor',
      'fashion accessories',
    ],
    he: [
      'אוזניות בלוטות',
      'מגן לטלפון',
      'שעון חכם',
      'רמקול בלוטות',
      'תאורת לד',
      'כבל טעינה',
      'מעמד למחשב',
      'גאדגט למטבח',
      'עיצוב הבית',
      'אקססוריז אופנה',
    ],
  };

  return popular[language] || popular.en;
}

/**
 * מביא הצעות מקומיות (fallback)
 * @param {string} query - מילת החיפוש
 * @param {string} language - שפה
 * @returns {Array} רשימת הצעות
 */
function getFallbackSuggestions(query, language = 'en') {
  const queryLower = query.toLowerCase();
  
  const allTerms = [
    ...getPopularSearches(language),
    'wireless', 'bluetooth', 'smart', 'portable', 'mini', 'professional',
    'waterproof', 'fast charging', 'sports', 'gaming', 'travel',
    'organizer', 'storage', 'kitchen', 'bathroom', 'bedroom',
    'office', 'outdoor', 'car accessories', 'phone accessories',
    'computer accessories', 'beauty tools', 'health', 'fitness',
  ];

  return allTerms
    .filter(term => term.toLowerCase().includes(queryLower))
    .slice(0, 6);
}

/**
 * שומר הצעות במטמון
 * @param {string} query - מילת החיפוש
 * @param {Array} suggestions - רשימת הצעות
 */
function cacheSuggestions(query, suggestions) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[query.toLowerCase()] = {
      suggestions,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // Ignore cache errors
  }
}

/**
 * מביא הצעות מהמטמון
 * @param {string} query - מילת החיפוש
 * @returns {Array|null} רשימת הצעות או null
 */
function getCachedSuggestions(query) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = cache[query.toLowerCase()];
    
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.suggestions;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * מנקה מטמון ישן
 */
export function clearSuggestionsCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // Ignore
  }
}

/**
 * מביא היסטוריית חיפושים
 * @returns {Promise<Array>} רשימת חיפושים אחרונים
 */
export async function getSearchHistory() {
  try {
    const result = await chrome.storage.local.get('ALISMART_SEARCH_HISTORY');
    return result.ALISMART_SEARCH_HISTORY || [];
  } catch (e) {
    return [];
  }
}

/**
 * מוסיף חיפוש להיסטוריה
 * @param {string} term - מילת החיפוש
 */
export async function addToSearchHistory(term) {
  if (!term || !term.trim()) return;
  
  try {
    const history = await getSearchHistory();
    const newHistory = [
      { term: term.trim(), timestamp: Date.now() },
      ...history.filter(h => h.term !== term.trim()),
    ].slice(0, 5);
    
    await chrome.storage.local.set({ ALISMART_SEARCH_HISTORY: newHistory });
  } catch (e) {
    // Ignore
  }
}

/**
 * מסיר פריט מהיסטוריה
 * @param {string} term - מילת החיפוש להסרה
 */
export async function removeFromSearchHistory(term) {
  try {
    const history = await getSearchHistory();
    const newHistory = history.filter(h => h.term !== term);
    await chrome.storage.local.set({ ALISMART_SEARCH_HISTORY: newHistory });
  } catch (e) {
    // Ignore
  }
}

/**
 * מנקה את כל ההיסטוריה
 */
export async function clearSearchHistory() {
  try {
    await chrome.storage.local.remove('ALISMART_SEARCH_HISTORY');
  } catch (e) {
    // Ignore
  }
}
