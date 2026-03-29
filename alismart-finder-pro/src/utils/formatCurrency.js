/**
 * Currency Formatting Utility
 * פורמט מטבע דינמי לפי שפה ומטבע
 * 
 * משתמש ב-Intl.NumberFormat לפורמט מקומי
 */

// מיפוי מטבעות לקודי ISO וסמלים
const CURRENCY_MAP = {
  'USD': { code: 'USD', symbol: '$', locale: 'en-US' },
  'EUR': { code: 'EUR', symbol: '€', locale: 'de-DE' },
  'GBP': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'ILS': { code: 'ILS', symbol: '₪', locale: 'he-IL' },
  'JPY': { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
  'CNY': { code: 'CNY', symbol: '¥', locale: 'zh-CN' },
  'CAD': { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
  'AUD': { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
  'CHF': { code: 'CHF', symbol: 'Fr', locale: 'de-CH' },
  'SEK': { code: 'SEK', symbol: 'kr', locale: 'sv-SE' },
  'PLN': { code: 'PLN', symbol: 'zł', locale: 'pl-PL' },
  'RUB': { code: 'RUB', symbol: '₽', locale: 'ru-RU' },
  'BRL': { code: 'BRL', symbol: 'R$', locale: 'pt-BR' },
  'INR': { code: 'INR', symbol: '₹', locale: 'en-IN' },
  'KRW': { code: 'KRW', symbol: '₩', locale: 'ko-KR' },
};

// מיפוי שפות לlocale
const LANGUAGE_LOCALES = {
  'he': 'he-IL',
  'en': 'en-US',
  'de': 'de-DE',
  'fr': 'fr-FR',
  'es': 'es-ES',
  'it': 'it-IT',
  'pt': 'pt-BR',
  'ru': 'ru-RU',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'zh': 'zh-CN',
  'ar': 'ar-SA',
  'pl': 'pl-PL',
};

/**
 * פורמט מחיר לפי מטבע ושפה
 * 
 * @param {number} amount - סכום
 * @param {string} currency - קוד מטבע (USD, EUR, ILS וכו')
 * @param {string} language - קוד שפה (he, en וכו')
 * @param {Object} options - אפשרויות נוספות
 * @returns {string} מחיר מפורמט
 */
export function formatCurrency(amount, currency = 'USD', language = 'he', options = {}) {
  // ברירות מחדל
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    useSymbol = true,
    compact = false,
  } = options;

  // בדיקת תקינות
  if (amount === null || amount === undefined || isNaN(amount)) {
    return useSymbol ? `${getSymbol(currency)}0` : '0';
  }

  // קבלת locale לפי שפה
  const locale = LANGUAGE_LOCALES[language] || 'he-IL';
  
  // קבלת קוד מטבע
  const currencyCode = CURRENCY_MAP[currency]?.code || currency || 'USD';

  try {
    // שימוש ב-Intl.NumberFormat
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits,
      maximumFractionDigits,
      currencyDisplay: useSymbol ? 'symbol' : 'code',
    });

    let formatted = formatter.format(amount);

    // עבור RTL (עברית, ערבית) - וידוא שהסמל מופיע בצד הנכון
    if (isRTL(language)) {
      // הסרת סימן דולר/יורו מימין והוספתו משמאל לשקל
      if (currency === 'ILS' && !formatted.includes('₪')) {
        formatted = formatted.replace(currencyCode, '₪');
      }
    }

    return formatted;
  } catch (error) {
    // Fallback - פורמט בסיסי
    console.warn('[formatCurrency] Intl.NumberFormat failed:', error);
    return formatFallback(amount, currency, language);
  }
}

/**
 * פורמט קומפקטי למספרים גדולים
 * לדוגמה: 1.2K במקום 1,234
 */
export function formatCompactNumber(number, language = 'he') {
  const locale = LANGUAGE_LOCALES[language] || 'he-IL';
  
  try {
    const formatter = new Intl.NumberFormat(locale, {
      notation: 'compact',
      compactDisplay: 'short',
    });
    return formatter.format(number);
  } catch (error) {
    // Fallback
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + 'M';
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + 'K';
    }
    return number.toString();
  }
}

/**
 * פורמט אחוזים
 */
export function formatPercent(value, language = 'he', decimals = 0) {
  const locale = LANGUAGE_LOCALES[language] || 'he-IL';
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value / 100);
  } catch (error) {
    return value.toFixed(decimals) + '%';
  }
}

/**
 * קבלת סמל מטבע בלבד
 */
export function getSymbol(currency) {
  return CURRENCY_MAP[currency]?.symbol || currency || '$';
}

/**
 * קבלת locale לפי שפה
 */
export function getLocale(language) {
  return LANGUAGE_LOCALES[language] || 'he-IL';
}

/**
 * בדיקה אם שפה היא RTL
 */
function isRTL(language) {
  return ['he', 'ar', 'fa', 'ur'].includes(language);
}

/**
 * פורמט fallback בסיסי
 */
function formatFallback(amount, currency, language) {
  const symbol = getSymbol(currency);
  const formatted = amount.toFixed(2);
  
  if (isRTL(language)) {
    return `${formatted} ${symbol}`;
  }
  return `${symbol}${formatted}`;
}

/**
 * חילוץ קוד מטבע ממחרוזת
 * לדוגמה: "$12.99" -> "USD"
 */
export function detectCurrency(priceString) {
  if (!priceString || typeof priceString !== 'string') return 'USD';
  
  const currencyMap = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '₪': 'ILS',
    '¥': 'JPY',
    '₩': 'KRW',
    '₹': 'INR',
    '₽': 'RUB',
  };
  
  for (const [symbol, code] of Object.entries(currencyMap)) {
    if (priceString.includes(symbol)) {
      return code;
    }
  }
  
  return 'USD';
}

/**
 * המרת מטבע
 * 
 * @param {number} amount - סכום
 * @param {string} fromCurrency - מטבע מקור
 * @param {string} toCurrency - מטבע יעד
 * @param {number} rate - שער חליפין
 * @returns {number} סכום מומר
 */
export function convertCurrency(amount, fromCurrency, toCurrency, rate) {
  if (!rate || rate <= 0) return amount;
  return amount * rate;
}

/**
 * פורמט טווח מחירים
 * לדוגמה: "$10 - $50"
 */
export function formatPriceRange(min, max, currency, language = 'he') {
  const formattedMin = formatCurrency(min, currency, language);
  const formattedMax = formatCurrency(max, currency, language);
  
  if (isRTL(language)) {
    return `${formattedMax} - ${formattedMin}`;
  }
  return `${formattedMin} - ${formattedMax}`;
}
