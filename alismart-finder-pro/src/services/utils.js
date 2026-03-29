/**
 * AliSmart Finder Pro - Utilities
 * מודול כלי עזר - פונקציות ניקוי, עיצוב וחילוץ נתונים
 * 
 * מכיל פונקציות utility:
 * - חילוץ ועיצוב מחירים
 * - חילוץ דירוגים וכוכבים
 * - חישוב רמות אמון מוכרים
 * - עיצוב מטבעות ותאריכים
 * - ניקוי HTML והגנה מפני XSS
 */

// קבועי מערכת
export const MIN_RATING_THRESHOLD = 4.0;
export const TOP_RATED_THRESHOLD = 4.5;
export const BEST_PRICE_COMPARISON_COUNT = 3;
export const DEFAULT_SHIPPING_IL = 5.0;

/**
 * מפרש מחרוזת מחיר למספר
 * תומך בפורמטים שונים: "$12.99", "12.99 USD", "12,99 €" וכו'
 * 
 * @param {string} priceStr - מחרוזת מחיר גולמית
 * @returns {number} ערך מספרי, 0 אם לא תקין
 */
export function parsePrice(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return 0;
  
  // הסרת סמלי מטבע, שמירה על ספרות, נקודות ופסיקים
  const cleaned = priceStr.replace(/[^\d.,]/g, '');
  
  // טיפול במפריד עשרוני אירופאי (פסיק)
  const normalized = cleaned.replace(',', '.');
  
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : value;
}

/**
 * מפרש מחרוזת מחיר מורחב - מחזיר גם את המטבע
 * 
 * @param {string} priceStr - מחרוזת מחיר גולמית
 * @returns {{value: number, currency: string}} ערך ומטבע
 */
export function parsePriceValue(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return { value: 0, currency: '' };
  
  // זיהוי סמל/קוד מטבע
  const currencyMatch = priceStr.match(/^[^\d\s.,]+|[\s]*(USD|EUR|GBP|ILS|₪|\$|€|£)[\s]*$/i);
  const currency = currencyMatch ? currencyMatch[0].trim() : '';
  
  // הסרת סמלי מטבע ונרמול
  const cleaned = priceStr
    .replace(/[^\d.,]/g, '')     // שמירה על ספרות, נקודות, פסיקים
    .replace(/,/g, '.');          // המרת פסיקים לנקודות לעקביות
  
  // טיפול בנקודות מרובות (שמירת האחרונה כעשרונית)
  const parts = cleaned.split('.');
  let normalized;
  if (parts.length > 2) {
    normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  } else {
    normalized = cleaned;
  }
  
  const value = parseFloat(normalized) || 0;
  return { value, currency };
}

/**
 * מחשב מחיר סופי כולל משלוח לישראל
 * קונים ישראלים זקוקים למחיר כולל למשלוח מדויק
 * 
 * @param {Object} product - נתוני מוצר מה-API
 * @returns {Object} { finalPrice, productPrice, shippingCost, hasFreeShipping }
 */
export function calculateFinalPrice(product) {
  // חילוץ מחיר מוצר משמות שדות שונים ב-API
  const productPrice = parsePrice(
    product.target_sale_price ||
    product.target_original_price ||
    product.sale_price ||
    product.original_price ||
    product.price ||
    '0'
  );

  // חילוץ מחיר משלוח - עדיפות למשלוח לישראל
  let shippingCost = 0;
  const shippingInfo = product.shipping || product.delivery;

  if (shippingInfo) {
    if (typeof shippingInfo === 'object') {
      // ניסיון למצוא משלוח לישראל תחילה
      const ilShipping = shippingInfo.IL || shippingInfo.Israel;
      if (ilShipping && ilShipping.price) {
        shippingCost = parsePrice(ilShipping.price);
      } else if (shippingInfo.price) {
        shippingCost = parsePrice(shippingInfo.price);
      } else if (shippingInfo.freightAmount) {
        shippingCost = parseFloat(shippingInfo.freightAmount) || 0;
      }
    } else if (typeof shippingInfo === 'string') {
      shippingCost = parsePrice(shippingInfo);
    }
  }

  // בדיקת אינדיקטורים למשלוח חינם
  const hasFreeShipping = product.free_shipping ||
                         product.is_free_shipping ||
                         (shippingInfo && shippingInfo.isFree);

  if (hasFreeShipping && shippingCost === 0) {
    shippingCost = 0;
  }

  // אם אין מידע על משלוח, שימוש בהערכה שמרנית לישראל
  if (shippingCost === 0 && !hasFreeShipping) {
    shippingCost = DEFAULT_SHIPPING_IL;
  }

  const finalPrice = productPrice + shippingCost;

  return {
    finalPrice,
    productPrice,
    shippingCost,
    hasFreeShipping: shippingCost === 0
  };
}

/**
 * מחשב סך הכל וממיין מוצרים לפי מחיר כולל
 * מוצרים עם נתונים חסרים מועברים לתחתית הרשימה
 * 
 * @param {Array} products - מערך מוצרים עם priceValue ו-shippingValue
 * @returns {Array} מערך ממויין עם totalPrice בכל מוצר
 */
export function calculateTotalAndSort(products) {
  if (!products || !Array.isArray(products)) return [];
  
  // חישוב סך הכל לכל מוצר והוספת נתוני דירוג
  const productsWithTotal = products.map(product => {
    const price = product.priceValue || 0;
    const shipping = product.shippingValue || 0;
    const hasPrice = price > 0;
    const hasShippingInfo = product.shipping && product.shipping !== 'Check website';
    
    return {
      ...product,
      totalPrice: hasPrice ? (price + shipping) : Infinity,
      hasCompleteData: hasPrice && hasShippingInfo
    };
  });
  
  // מיון: נתונים שלמים קודם (לפי מחיר), אז נתונים חסרים
  const sorted = productsWithTotal.sort((a, b) => {
    if (a.hasCompleteData && b.hasCompleteData) {
      return a.totalPrice - b.totalPrice;
    }
    if (!a.hasCompleteData && b.hasCompleteData) return 1;
    if (a.hasCompleteData && !b.hasCompleteData) return -1;
    return a.totalPrice - b.totalPrice;
  });
  
  // הוספת שדה דירוג לתצוגת תגיות
  return sorted.map((product, index) => ({
    ...product,
    rank: index + 1
  }));
}

/**
 * מחלץ ערך דירוג מנתוני מוצר
 * 
 * @param {Object} product - נתוני מוצר
 * @returns {number} דירוג 0-5, 0 אם לא זמין
 */
export function extractRating(product) {
  const rating = product.evaluate_rate ||
                 product.rating ||
                 product.star ||
                 product.product_average_star ||
                 product.avg_rating;

  if (!rating) return 0;

  // טיפול בפורמט אחוזים (למשל "92%" -> 4.6 כוכבים)
  if (typeof rating === 'string' && rating.includes('%')) {
    const percent = parseFloat(rating.replace('%', ''));
    return (percent / 100) * 5;
  }

  const numRating = parseFloat(rating);
  return isNaN(numRating) ? 0 : numRating;
}

/**
 * קובע אילו תגיות ערך יוצגו למוצר
 * 
 * @param {Object} product - מוצר מועשר עם priceData
 * @param {number} index - מיקום בתוצאות ממוינות
 * @param {Array} allProducts - כל המוצרים להשוואה
 * @returns {Array} מערך סוגי תגיות: 'best-price', 'top-rated', 'value-pick'
 */
export function getProductBadges(product, index, allProducts) {
  const badges = [];
  const rating = extractRating(product);
  const orders = product.orders || 0;

  // Best Price: הפריט הראשון במיון (הזול ביותר)
  if (index === 0 && allProducts.length > 1) {
    badges.push('best-price');
  }

  // Top Rated: דירוג גבוה עם מספר הזמנות מספיק
  if (rating >= TOP_RATED_THRESHOLD && orders > 10) {
    badges.push('top-rated');
  }

  // Value Pick: איזון טוב של מחיר ודירוג
  if (index < 3 && rating >= 4.3 && orders > 20) {
    badges.push('value-pick');
  }

  return badges;
}

/**
 * מחשב רמת אמון מבוססת על דירוג וכמות מכירות
 * רמות אמון: high (ירוק), medium (צהוב), low (אפור/אדום)
 * 
 * @param {Object} product - מוצר עם rating ו-salesCount
 * @returns {Object} { level, label, className }
 */
export function calculateTrustLevel(product) {
  const rating = product.rating || 0;
  const sales = product.salesCount || product.orders || 0;
  
  // אמון גבוה: 4.8+ כוכבים ו-500+ מכירות
  if (rating >= 4.8 && sales >= 500) {
    return {
      level: 'high',
      label: 'מוכר מוביל',
      className: 'as-trust-high'
    };
  }
  
  // אמון בינוני: 4.5-4.7 כוכבים או 100-499 מכירות עם דירוג טוב
  if ((rating >= 4.5 && rating < 4.8) || 
      (rating >= 4.5 && sales >= 100 && sales < 500)) {
    return {
      level: 'medium',
      label: 'מוכר מאומת',
      className: 'as-trust-medium'
    };
  }
  
  // אמון נמוך: מתחת ל-4.4 כוכבים או ללא היסטוריית מכירות
  if (rating > 0 && rating < 4.5) {
    return {
      level: 'low',
      label: 'מוכר חדש',
      className: 'as-trust-low'
    };
  }
  
  // אין נתוני דירוג
  return {
    level: 'unknown',
    label: 'מוכר חדש',
    className: 'as-trust-unknown'
  };
}

/**
 * מחשב חיסכון בהשוואה לאפשרות היקרה ביותר
 * 
 * @param {number} finalPrice - מחיר סופי של המוצר
 * @param {Array} allProducts - כל המוצרים להשוואה
 * @returns {string} מחרוזת חיסכון מעוצבת
 */
export function calculateSavings(finalPrice, allProducts) {
  if (!allProducts || allProducts.length < 2) return '';

  const maxPrice = Math.max(...allProducts.map(p => p.priceData?.finalPrice || 0));
  if (maxPrice <= finalPrice) return '';

  const savings = maxPrice - finalPrice;
  const savingsPercent = Math.round((savings / maxPrice) * 100);

  return `חיסכון ${savingsPercent}%`;
}

/**
 * מדרג מוצרים לפי ערך עבור קונים ישראלים
 * לוגיקה: הסרת דירוגים נמוכים, מיון לפי מחיר סופי, העדפת דירוגים גבוהים
 * 
 * @param {Array} products - מוצרים גולמיים מה-API
 * @returns {Array} מוצרים מסוננים וממוינים עם נתונים מועשרים
 */
export function rankProductsByValue(products) {
  if (!products || !Array.isArray(products)) return [];

  // שלב 1: העשרת מוצרים עם נתונים מחושבים וסינון לפי איכות
  const enriched = products
    .map(product => {
      const priceData = calculateFinalPrice(product);
      const rating = extractRating(product);
      const orders = parseInt(product.orders || product.sales || product.sold || 0);

      return {
        ...product,
        priceData,
        rating,
        orders,
        _qualityScore: (rating * 20) + Math.min(orders / 100, 20) // מדד דירוג פנימי
      };
    })
    .filter(product => {
      // שער איכות: חייב דירוג מעל הסף או הזמנות רבות כביטחון
      const hasGoodRating = product.rating >= MIN_RATING_THRESHOLD;
      const hasHighVolume = product.orders > 50 && product.rating >= 3.5;
      const isNewProduct = product.orders < 5 && product.rating === 0; // מאפשר פריטים חדשים ללא דירוג

      return hasGoodRating || hasHighVolume || isNewProduct;
    });

  // שלב 2: מיון לפי מחיר סופי (ראשי) וניקוד איכות (משני)
  const sorted = enriched.sort((a, b) => {
    const priceDiff = a.priceData.finalPrice - b.priceData.finalPrice;
    if (Math.abs(priceDiff) > 0.5) return priceDiff; // הפרש מחיר משמעותי

    // מחירים דומים: העדפת דירוג גבוה
    return b._qualityScore - a._qualityScore;
  });

  // שלב 3: הקצאת תגיות לפי הדירוג הסופי
  return sorted.map((product, index) => ({
    ...product,
    badges: getProductBadges(product, index, sorted),
    rank: index + 1,
    savingsText: index === 0 ? calculateSavings(product.priceData.finalPrice, sorted) : ''
  }));
}

/**
 * מעצב מחיר עם סמל מטבע
 * 
 * @param {number} price - מחיר מספרי
 * @param {string} currency - סמל מטבע (ברירת מחדל $)
 * @param {number} decimals - מספר ספרות עשרוניות
 * @returns {string} מחיר מעוצב
 */
export function formatPrice(price, currency = '$', decimals = 2) {
  if (price === null || price === undefined || isNaN(price)) return 'N/A';
  if (price === Infinity) return 'N/A';
  
  return `${currency}${price.toFixed(decimals)}`;
}

/**
 * מעצב מספר הזמנות/מכירות
 * 
 * @param {number} orders - מספר הזמנות
 * @returns {string} מחרוזת מעוצבת
 */
export function formatOrders(orders) {
  if (!orders || orders === 0) return '';
  
  if (orders >= 1000) {
    return `${(orders / 1000).toFixed(1)}K מכירות`;
  }
  
  return `${orders} מכירות`;
}

/**
 * מעצב דירוג כוכבים
 * 
 * @param {number} rating - דירוג מספרי
 * @returns {string} דירוג מעוצב עם סימן כוכבית
 */
export function formatRating(rating) {
  if (!rating || rating === 0) return '';
  return `★ ${rating.toFixed(1)}`;
}

/**
 * מנקה HTML למניעת XSS
 * 
 * @param {string} text - טקסט שמקורו בלקוח
 * @returns {string} טקסט מנוקה
 */
export function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * מקצר טקסט למגבלה נתונה עם ellipsis
 * 
 * @param {string} text - טקסט מקורי
 * @param {number} maxLength - אורך מקסימלי
 * @returns {string} טקסט מקוצר
 */
export function truncateText(text, maxLength = 60) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
* מחלץ ID מוצר מ-URL של AliExpress
* 
* @param {string} url - URL של מוצר
* @returns {string|null} ID מוצר או null
*/
export function extractProductId(url) {
  if (!url) return null;
  
  // תבניות URL נפוצות:
  // https://www.aliexpress.com/item/1234567890.html
  // https://www.aliexpress.com/item/1234567890.html?
  const match = url.match(/\/item\/(\d+)\.html/);
  return match ? match[1] : null;
}

/**
 * בונה URL לחיפוש AliExpress
 * 
 * @param {string} keyword - מילת מפתח
 * @returns {string} URL לחיפוש
 */
export function buildSearchUrl(keyword) {
  if (!keyword) return 'https://www.aliexpress.com';
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(keyword)}`;
}

/**
 * מחכה למספר מילישניות
 * 
 * @param {number} ms - מילישניות לחכות
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
* יוצר מזהה ייחודי
* 
* @param {string} prefix - קידומת אופציונלית
* @returns {string} מזהה ייחודי
*/
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * בודק אם ערך הוא אובייקט ריק
 * 
 * @param {Object} obj - אובייקט לבדיקה
 * @returns {boolean} true אם ריק
 */
export function isEmptyObject(obj) {
  return Object.keys(obj || {}).length === 0;
}

/**
 * מבצע debounce על פונקציה
 * 
 * @param {Function} func - פונקציה לביצוע debounce
 * @param {number} wait - מילישניות להמתנה
 * @returns {Function} פונקציה עם debounce
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
* מבצע throttle על פונקציה
* 
* @param {Function} func - פונקציה לביצוע throttle
* @param {number} limit - מגבלת זמן במילישניות
* @returns {Function} פונקציה עם throttle
*/
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * ממיר קוד מטבע לשם מלא בעברית
 * 
 * @param {string} code - קוד מטבע (USD, EUR, ILS)
 * @returns {string} שם מטבע בעברית
 */
export function getCurrencyName(code) {
  const names = {
    'USD': 'דולר',
    'EUR': 'יורו',
    'GBP': 'לירה שטרלינג',
    'ILS': 'שקל',
    'CNY': 'יואן',
    'JPY': 'יין'
  };
  return names[code] || code;
}

/**
 * ממיר קוד מטבע לסמל
 * 
 * @param {string} code - קוד מטבע
 * @returns {string} סמל מטבע
 */
export function getCurrencySymbol(code) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'ILS': '₪',
    'CNY': '¥',
    'JPY': '¥'
  };
  return symbols[code] || '$';
}

/**
 * חישוב ציון אמינות מוכר (Seller Trust Score)
 * 
 * מחשב ציון אמינות מבוסס על:
 * - אחוז פידבק חיובי (עד 40 נקודות)
 * - וותק החנות (עד 30 נקודות)
 * - דירוג עליאקספרס (עד 30 נקודות)
 * 
 * @param {Object} sellerData - נתוני המוכר
 * @param {number} sellerData.positiveFeedbackRate - אחוז פידבק חיובי (0-1)
 * @param {string} sellerData.storeOpenDate - תאריך פתיחת חנות
 * @param {number} sellerData.sellerRating - דירוג המוכר (0-5)
 * @param {number} sellerData.followersCount - מספר עוקבים
 * @param {boolean} sellerData.isTopBrand - האם Top Brand
 * @returns {{score: number, breakdown: Array, maxScore: number}} ציון ופירוט
 */
export function calculateSellerTrustScore(sellerData) {
  if (!sellerData) return { score: 0, breakdown: [], maxScore: 100 };

  let score = 0;
  const breakdown = [];

  // 1. פידבק חיובי (עד 40 נקודות)
  // 95%+ = 40, 90%+ = 32, 85%+ = 24, 80%+ = 16, פחות = 8
  const { positiveFeedbackRate } = sellerData;
  if (typeof positiveFeedbackRate === 'number' && positiveFeedbackRate >= 0) {
    let feedbackScore = 0;
    let status = 'warning';
    
    if (positiveFeedbackRate >= 0.95) {
      feedbackScore = 40;
      status = 'excellent';
    } else if (positiveFeedbackRate >= 0.90) {
      feedbackScore = 32;
      status = 'good';
    } else if (positiveFeedbackRate >= 0.85) {
      feedbackScore = 24;
      status = 'good';
    } else if (positiveFeedbackRate >= 0.80) {
      feedbackScore = 16;
      status = 'warning';
    } else {
      feedbackScore = 8;
      status = 'risky';
    }
    
    score += feedbackScore;
    breakdown.push({
      label: 'Feedback Rate',
      value: `${(positiveFeedbackRate * 100).toFixed(1)}%`,
      points: feedbackScore,
      maxPoints: 40,
      status,
      hebrewLabel: 'אחוז פידבק חיובי'
    });
  }

  // 2. וותק החנות (עד 30 נקודות)
  // 3+ שנים = 30, 2 שנים = 20, שנה = 10, פחות = 5
  const { storeOpenDate } = sellerData;
  if (storeOpenDate) {
    const yearsOpen = calculateYearsOpen(storeOpenDate);
    let ageScore = 0;
    let status = 'warning';
    
    if (yearsOpen >= 3) {
      ageScore = 30;
      status = 'excellent';
    } else if (yearsOpen >= 2) {
      ageScore = 20;
      status = 'excellent';
    } else if (yearsOpen >= 1) {
      ageScore = 10;
      status = 'good';
    } else {
      ageScore = 5;
      status = 'warning';
    }
    
    score += ageScore;
    breakdown.push({
      label: 'Store Age',
      value: yearsOpen >= 1 ? `${yearsOpen} years` : 'New store',
      points: ageScore,
      maxPoints: 30,
      status,
      hebrewLabel: 'וותק החנות'
    });
  }

  // 3. דירוג עליאקספרס (עד 30 נקודות)
  // 4.8+ = 30, 4.5+ = 25, 4.0+ = 20, 3.5+ = 15, פחות = 10
  const { sellerRating } = sellerData;
  if (typeof sellerRating === 'number' && sellerRating > 0) {
    let ratingScore = 0;
    let status = 'warning';
    
    if (sellerRating >= 4.8) {
      ratingScore = 30;
      status = 'excellent';
    } else if (sellerRating >= 4.5) {
      ratingScore = 25;
      status = 'excellent';
    } else if (sellerRating >= 4.0) {
      ratingScore = 20;
      status = 'good';
    } else if (sellerRating >= 3.5) {
      ratingScore = 15;
      status = 'warning';
    } else {
      ratingScore = 10;
      status = 'risky';
    }
    
    score += ratingScore;
    breakdown.push({
      label: 'AliExpress Rating',
      value: `${sellerRating.toFixed(1)}/5`,
      points: ratingScore,
      maxPoints: 30,
      status,
      hebrewLabel: 'דירוג עליאקספרס'
    });
  }

  // בונוס: Top Brand (+10 נקודות)
  if (sellerData.isTopBrand) {
    score = Math.min(score + 10, 100);
  }

  // בונוס: הרבה עוקבים (+5 נקודות)
  if (sellerData.followersCount > 10000) {
    score = Math.min(score + 5, 100);
  }

  return {
    score: Math.round(score),
    breakdown,
    maxScore: 100,
    isTopBrand: sellerData.isTopBrand || false,
    hasNonFilteredContent: sellerData.hasNonFilteredContent || false
  };
}

/**
 * חישוב מספר שנים מאז תאריך
 * 
 * @param {string} dateString - תאריך בפורמט ISO
 * @returns {number} מספר שנים
 */
function calculateYearsOpen(dateString) {
  if (!dateString) return 0;
  try {
    const openDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - openDate);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
    return Math.floor(diffYears);
  } catch (e) {
    return 0;
  }
}

/**
 * קבלת רמת אמון לפי ציון
 * 
 * @param {number} score - ציון אמינות
 * @returns {{level: string, color: string, label: string}} רמת אמון
 */
export function getTrustLevelFromScore(score) {
  if (score >= 80) {
    return { level: 'high', color: '#22c55e', label: 'Verified', hebrewLabel: 'מאומת' };
  }
  if (score >= 60) {
    return { level: 'medium', color: '#f59e0b', label: 'Moderate', hebrewLabel: 'בינוני' };
  }
  return { level: 'low', color: '#ef4444', label: 'Risky', hebrewLabel: 'סיכון' };
}

// ============================================================
// Shipping & Customs Tax Calculator
// מחשבון משלוח ומכס
// ============================================================

/**
 * טבלת מכס ומע"מ לפי מדינה
 * מכיל סף פטור, שיעור מע"מ, ושיעור מכס
 */
export const TAX_RULES_BY_COUNTRY = {
  'IL': {
    name: 'Israel',
    nameHe: 'ישראל',
    vatRate: 0.17, // 17% מע"מ
    customsThreshold: 75, // דולר - סף פטור ממכס
    vatThreshold: 0, // תמיד יש מע"מ
    handlingFee: 20, // דמי טיפול בדואר
    currency: 'USD'
  },
  'US': {
    name: 'United States',
    nameHe: 'ארה"ב',
    vatRate: 0, // אין מע"מ פדרלי
    customsThreshold: 800, // סף פטור גבוה
    vatThreshold: 0,
    handlingFee: 0,
    currency: 'USD',
    stateTax: true // מס מדינתי (משתנה)
  },
  'GB': {
    name: 'United Kingdom',
    nameHe: 'בריטניה',
    vatRate: 0.20, // 20% VAT
    customsThreshold: 135, // GBP
    vatThreshold: 0,
    handlingFee: 12, // דמי טיפול
    currency: 'GBP'
  },
  'EU': {
    name: 'European Union',
    nameHe: 'האיחוד האירופי',
    vatRate: 0.19, // ממוצע ~19%
    customsThreshold: 150, // EUR
    vatThreshold: 0,
    handlingFee: 15,
    currency: 'EUR'
  },
  'CA': {
    name: 'Canada',
    nameHe: 'קנדה',
    vatRate: 0.13, // משולב GST/PST
    customsThreshold: 20, // CAD
    vatThreshold: 0,
    handlingFee: 10,
    currency: 'CAD'
  },
  'AU': {
    name: 'Australia',
    nameHe: 'אוסטרליה',
    vatRate: 0.10, // 10% GST
    customsThreshold: 1000, // AUD
    vatThreshold: 0,
    handlingFee: 0,
    currency: 'AUD'
  }
};

/**
 * מחשב מחיר סופי כולל משלוח ומכס (Landed Cost)
 * 
 * @param {Object} params - פרמטרים לחישוב
 * @param {number} params.productPrice - מחיר המוצר
 * @param {number} params.shippingCost - עלות משלוח
 * @param {number} params.quantity - כמות (ברירת מחדל 1)
 * @param {string} params.countryCode - קוד מדינה (IL, US, GB, וכו')
 * @param {string} params.currency - מטבע המחיר
 * @returns {Object} פירוט המחיר הסופי
 */
export function calculateFinalLandingPrice({
  productPrice = 0,
  shippingCost = 0,
  quantity = 1,
  countryCode = 'IL',
  currency = 'USD'
}) {
  const rules = TAX_RULES_BY_COUNTRY[countryCode] || TAX_RULES_BY_COUNTRY['IL'];
  
  // חישוב בסיסי
  const totalProductPrice = productPrice * quantity;
  const totalShipping = shippingCost * quantity;
  const subtotal = totalProductPrice + totalShipping;
  
  // בדיקה אם עוברים את סף הפטור
  const isOverThreshold = totalProductPrice > rules.customsThreshold;
  
  // חישוב מע"מ
  let vatAmount = 0;
  if (subtotal > rules.vatThreshold) {
    vatAmount = subtotal * rules.vatRate;
  }
  
  // חישוב מכס (אם עוברים את הסף)
  let customsAmount = 0;
  if (isOverThreshold) {
    // מכס ממוצע של ~12% על ערך המוצר (ללא משלוח)
    customsAmount = totalProductPrice * 0.12;
  }
  
  // דמי טיפול
  const handlingFee = isOverThreshold ? rules.handlingFee : 0;
  
  // סך הכל
  const finalTotal = subtotal + vatAmount + customsAmount + handlingFee;
  
  return {
    // פירוט
    breakdown: {
      productPrice: totalProductPrice,
      shipping: totalShipping,
      vat: vatAmount,
      customs: customsAmount,
      handlingFee: handlingFee
    },
    // סיכומים
    subtotal: subtotal,
    totalTaxes: vatAmount + customsAmount + handlingFee,
    finalTotal: finalTotal,
    // מטא-דאטה
    currency: currency,
    country: countryCode,
    rules: rules,
    isOverThreshold: isOverThreshold,
    thresholdWarning: getThresholdWarning(totalProductPrice, rules, countryCode),
    quantity: quantity
  };
}

/**
 * בודק אם המוצר קרוב לסף המכס ומחזיר התראה מתאימה
 * 
 * @param {number} productPrice - מחיר המוצר
 * @param {Object} rules - חוקי המס של המדינה
 * @param {string} countryCode - קוד המדינה
 * @returns {Object|null} התראה או null
 */
function getThresholdWarning(productPrice, rules, countryCode) {
  const threshold = rules.customsThreshold;
  const gap = threshold - productPrice;
  const proximityThreshold = threshold * 0.15; // 15% מהסף
  
  // אם המחיר בטווח 15% מתחת לסף
  if (gap > 0 && gap <= proximityThreshold) {
    const isRTL = countryCode === 'IL';
    return {
      type: 'warning',
      severity: 'medium',
      message: isRTL 
        ? `זהירות! מרחק ${gap.toFixed(2)}$ מסף המכס. הוספת פריטים עשויה לחייב מסים.`
        : `Careful! ${gap.toFixed(2)}$ from customs threshold. Adding more items may trigger taxes.`,
      currentPrice: productPrice,
      threshold: threshold,
      gap: gap,
      isRTL: isRTL
    };
  }
  
  // אם כבר עברנו את הסף
  if (productPrice > threshold) {
    const isRTL = countryCode === 'IL';
    const overBy = productPrice - threshold;
    return {
      type: 'info',
      severity: 'info',
      message: isRTL
        ? `המחיר עובר את סף הפטור ב-${overBy.toFixed(2)}$. יוחלו מסים.`
        : `Price exceeds tax-free threshold by ${overBy.toFixed(2)}$. Taxes will apply.`,
      currentPrice: productPrice,
      threshold: threshold,
      gap: -overBy,
      isRTL: isRTL
    };
  }
  
  return null;
}

/**
 * מחשב השוואה בין אפשרויות משלוח שונות
 * 
 * @param {Array} shippingOptions - מערך אפשרויות משלוח
 * @param {number} productPrice - מחיר המוצר
 * @param {string} countryCode - קוד מדינה
 * @returns {Array} אפשרויות ממוינות לפי ערך
 */
export function compareShippingOptions(shippingOptions, productPrice, countryCode = 'IL') {
  if (!shippingOptions || !Array.isArray(shippingOptions)) {
    return [];
  }
  
  const rules = TAX_RULES_BY_COUNTRY[countryCode] || TAX_RULES_BY_COUNTRY['IL'];
  
  return shippingOptions
    .map(option => {
      const shippingCost = parsePrice(option.price || '0');
      const calculation = calculateFinalLandingPrice({
        productPrice,
        shippingCost,
        quantity: 1,
        countryCode
      });
      
      return {
        ...option,
        totalCost: calculation.finalTotal,
        costBreakdown: calculation.breakdown,
        taxes: calculation.totalTaxes,
        isOverThreshold: calculation.isOverThreshold,
        valueScore: calculateShippingValueScore(option, shippingCost, calculation.finalTotal)
      };
    })
    .sort((a, b) => b.valueScore - a.valueScore); // מיון לפי ציון ערך
}

/**
 * מחשב ציון ערך לאפשרות משלוח
 * משקלל: מהירות, עלות, אמינות
 * 
 * @param {Object} option - אפשרות משלוח
 * @param {number} shippingCost - עלות המשלוח
 * @param {number} finalTotal - סך הכל כולל מסים
 * @returns {number} ציון ערך (0-100)
 */
function calculateShippingValueScore(option, shippingCost, finalTotal) {
  let score = 50; // בסיס
  
  // בונוס למשלוח חינם או זול
  if (shippingCost === 0) {
    score += 30;
  } else if (shippingCost < 5) {
    score += 20;
  } else if (shippingCost < 10) {
    score += 10;
  }
  
  // בונוס למהירות משלוח
  const deliveryDays = parseInt(option.deliveryTime) || 30;
  if (deliveryDays <= 7) {
    score += 20; // מהיר מאוד
  } else if (deliveryDays <= 14) {
    score += 10;
  } else if (deliveryDays <= 21) {
    score += 5;
  }
  
  // מינוס למחיר גבוה
  if (finalTotal > 100) {
    score -= 10;
  }
  
  // בונוס למשלוח מאובטח/מעקב
  if (option.hasTracking || option.isInsured) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * מחלץ נתוני משלוח מדף AliExpress
 * 
 * @returns {Object} נתוני משלוח שזוהו
 */
export function extractShippingInfoFromPage() {
  const shippingInfo = {
    methods: [],
    estimatedDelivery: '',
    weight: null,
    isFreeShipping: false
  };
  
  try {
    // זיהוי אפשרויות משלוח
    const shippingElements = document.querySelectorAll('[class*="shipping"], [class*="logistics"], [class*="delivery"]');
    
    shippingElements.forEach(el => {
      const text = el.textContent?.trim() || '';
      
      // בדיקת משלוח חינם
      if (/free\s+shipping|משלוח\s+חינם|免邮/i.test(text)) {
        shippingInfo.isFreeShipping = true;
        shippingInfo.methods.push({
          name: 'Standard Shipping',
          price: 0,
          isFree: true
        });
      }
      
      // חילוץ זמן הגעה
      const deliveryMatch = text.match(/(\d+)[-\s]?(\d+)\s*(days|business days|ימים)/i);
      if (deliveryMatch && !shippingInfo.estimatedDelivery) {
        shippingInfo.estimatedDelivery = `${deliveryMatch[1]}-${deliveryMatch[2]} days`;
      }
    });
    
    // חילוץ משקל (אם זמין)
    const weightElements = document.querySelectorAll('[class*="weight"], [class*="specification"]');
    weightElements.forEach(el => {
      const text = el.textContent || '';
      const weightMatch = text.match(/(\d+\.?\d*)\s*(kg|g|grams|ק"ג|גרם)/i);
      if (weightMatch) {
        const value = parseFloat(weightMatch[1]);
        const unit = weightMatch[2].toLowerCase();
        shippingInfo.weight = unit.includes('kg') ? value : value / 1000; // המרה לק"ג
      }
    });
    
  } catch (error) {
    console.log('[AliSmart] Failed to extract shipping info:', error);
  }
  
  return shippingInfo;
}

/**
 * מעצב פירוט מחיר כולל מסים
 * 
 * @param {Object} calculation - תוצאת חישוב calculateFinalLandingPrice
 * @param {string} language - שפה (en/he)
 * @returns {Object} פירוט מעוצב
 */
export function formatPriceBreakdown(calculation, language = 'en') {
  const isRTL = language === 'he';
  const symbol = getCurrencySymbol(calculation.currency);
  
  const format = (amount) => `${symbol}${amount.toFixed(2)}`;
  
  return {
    product: {
      label: isRTL ? 'מחיר מוצר' : 'Product Price',
      value: format(calculation.breakdown.productPrice)
    },
    shipping: {
      label: isRTL ? 'משלוח' : 'Shipping',
      value: format(calculation.breakdown.shipping),
      isFree: calculation.breakdown.shipping === 0
    },
    taxes: {
      vat: {
        label: isRTL ? 'מע"מ' : 'VAT',
        value: format(calculation.breakdown.vat),
        rate: calculation.rules.vatRate
      },
      customs: {
        label: isRTL ? 'מכס' : 'Customs',
        value: format(calculation.breakdown.customs)
      },
      handling: {
        label: isRTL ? 'דמי טיפול' : 'Handling Fee',
        value: format(calculation.breakdown.handlingFee)
      }
    },
    total: {
      label: isRTL ? 'סה"כ כולל מסים' : 'Total Landed Cost',
      value: format(calculation.finalTotal)
    },
    disclaimer: isRTL 
      ? 'מחיר משוער. המחיר הסופי עשוי להשתנות לפי רשויות מקומיות.'
      : 'Estimated cost. Final price may vary by local authorities.'
  };
}

// ============================================================
// Savings Analytics & Tracking
// מעקב וניתוח חיסכון
// ============================================================

/**
 * מבנה נתוני חיסכון ברירת מחדל
 */
export const DEFAULT_SAVINGS_DATA = {
  totalSaved: 0,
  smartChoices: 0,
  couponsFound: 0,
  couponsUsed: 0,
  productsTracked: 0,
  weeklyActivity: [], // מערך של 7 ימים
  monthlyStats: {},
  lastUpdated: Date.now()
};

/**
 * טעינת נתוני חיסכון מה-storage
 * @returns {Promise<Object>} נתוני חיסכון
 */
export async function loadSavingsData() {
  try {
    const result = await chrome.storage.local.get(['SAVINGS_DATA']);
    return { ...DEFAULT_SAVINGS_DATA, ...(result.SAVINGS_DATA || {}) };
  } catch (error) {
    console.error('[AliSmart] Failed to load savings data:', error);
    return { ...DEFAULT_SAVINGS_DATA };
  }
}

/**
 * שמירת נתוני חיסכון ל-storage
 * @param {Object} data - נתוני חיסכון
 */
export async function saveSavingsData(data) {
  try {
    await chrome.storage.local.set({
      SAVINGS_DATA: {
        ...data,
        lastUpdated: Date.now()
      }
    });
  } catch (error) {
    console.error('[AliSmart] Failed to save savings data:', error);
  }
}

/**
 * מעקב חיסכון חדש
 * 
 * @param {Object} params - פרמטרים לרישום
 * @param {string} params.type - סוג (coupon_used, cheaper_choice, price_alert)
 * @param {number} params.amount - סכום חיסכון
 * @param {Object} params.product - פרטי מוצר (אופציונלי)
 * @returns {Promise<Object>} נתוני חיסכון מעודכנים
 */
export async function trackSavings({ type, amount = 0, product = null }) {
  try {
    const data = await loadSavingsData();
    
    // עדכון סך הכל
    if (amount > 0) {
      data.totalSaved += amount;
    }
    
    // עדכון מונים לפי סוג
    switch (type) {
      case 'coupon_used':
        data.couponsUsed++;
        break;
      case 'coupon_found':
        data.couponsFound++;
        break;
      case 'cheaper_choice':
        data.smartChoices++;
        break;
      case 'product_tracked':
        data.productsTracked++;
        break;
      default:
        break;
    }
    
    // עדכון פעילות שבועית
    const today = new Date().toISOString().split('T')[0];
    const existingDay = data.weeklyActivity.find(a => a.date === today);
    
    if (existingDay) {
      existingDay.savings += amount;
      existingDay.actions++;
    } else {
      data.weeklyActivity.push({
        date: today,
        dayOfWeek: new Date().getDay(),
        savings: amount,
        actions: 1
      });
    }
    
    // שמירת רק 30 ימים אחרונים
    if (data.weeklyActivity.length > 30) {
      data.weeklyActivity = data.weeklyActivity.slice(-30);
    }
    
    // עדכון סטטיסטיקות חודשיות
    const monthKey = today.substring(0, 7); // YYYY-MM
    if (!data.monthlyStats[monthKey]) {
      data.monthlyStats[monthKey] = {
        totalSaved: 0,
        actions: 0
      };
    }
    data.monthlyStats[monthKey].totalSaved += amount;
    data.monthlyStats[monthKey].actions++;
    
    await saveSavingsData(data);
    
    // שידור אירוע לעדכון ה-UI
    chrome.runtime.sendMessage({
      type: 'SAVINGS_UPDATED',
      data: data
    }).catch(() => {});
    
    return data;
  } catch (error) {
    console.error('[AliSmart] Failed to track savings:', error);
    return null;
  }
}

/**
 * קבלת סטטיסטיקות חיסכון מסוכמות
 * @returns {Promise<Object>} סטטיסטיקות
 */
export async function getSavingsStats() {
  const data = await loadSavingsData();
  
  // חישוב פעילות 7 ימים אחרונים
  const last7Days = getLast7Days();
  const weeklyData = last7Days.map(date => {
    const dayActivity = data.weeklyActivity.find(a => a.date === date);
    return {
      date,
      day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      savings: dayActivity?.savings || 0,
      actions: dayActivity?.actions || 0
    };
  });
  
  // חישוב יעדים והישגים
  const achievements = calculateAchievements(data);
  
  return {
    ...data,
    weeklyData,
    achievements,
    formattedTotal: formatCurrency(data.totalSaved, 'USD')
  };
}

/**
 * יצירת מערך 7 ימים אחרונים
 */
function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/**
 * חישוב הישגים
 */
function calculateAchievements(data) {
  const achievements = [];
  
  if (data.totalSaved >= 50) {
    achievements.push({
      id: 'first_fifty',
      title: 'Smart Shopper',
      titleHe: 'קונה חכם',
      description: 'Saved $50 or more',
      descriptionHe: 'חסך 50$ או יותר',
      icon: '💰',
      unlocked: true
    });
  }
  
  if (data.smartChoices >= 10) {
    achievements.push({
      id: 'ten_choices',
      title: 'Deal Hunter',
      titleHe: 'צייד מבצעים',
      description: 'Made 10 smart choices',
      descriptionHe: 'ביצע 10 בחירות חכמות',
      icon: '🎯',
      unlocked: true
    });
  }
  
  if (data.couponsUsed >= 5) {
    achievements.push({
      id: 'coupon_master',
      title: 'Coupon Master',
      titleHe: 'שליט הקופונים',
      description: 'Used 5 coupons',
      descriptionHe: 'ניצל 5 קופונים',
      icon: '🎫',
      unlocked: true
    });
  }
  
  if (data.totalSaved >= 200) {
    achievements.push({
      id: 'big_saver',
      title: 'Big Saver',
      titleHe: 'חוסך גדול',
      description: 'Saved $200 or more',
      descriptionHe: 'חסך 200$ או יותר',
      icon: '🏆',
      unlocked: true
    });
  }
  
  return achievements;
}

/**
 * עיצוב סכום כספי
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * יצירת תמונת סטטיסטיקה לשיתוף (Share My Savings)
 * 
 * @param {Object} stats - סטטיסטיקות
 * @returns {string} Data URL של תמונה
 */
export function generateSavingsShareImage(stats) {
  // יצירת canvas
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  
  // רקע גרדיאנט
  const gradient = ctx.createLinearGradient(0, 0, 600, 400);
  gradient.addColorStop(0, '#ee0979');
  gradient.addColorStop(1, '#ff6a00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 400);
  
  // כותרת
  ctx.fillStyle = 'white';
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('My AliSmart Savings', 300, 70);
  
  // סכום חיסכון
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.fillText(stats.formattedTotal, 300, 160);
  
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText('Total Saved', 300, 200);
  
  // סטטיסטיקות נוספות
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText(`💡 ${stats.smartChoices} Smart Choices`, 300, 260);
  ctx.fillText(`🎫 ${stats.couponsUsed} Coupons Used`, 300, 295);
  ctx.fillText(`📦 ${stats.productsTracked} Products Tracked`, 300, 330);
  
  // פוטר
  ctx.font = '16px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('AliSmart Finder Pro - Smart Shopping Assistant', 300, 380);
  
  return canvas.toDataURL('image/png');
}

// ============================================================
// Review & Image Safety Filter
// מסנן ביקורות ותמונות חכם
// ============================================================

// מילות מפתח לזיהוי תוכן עם דמויות אנושיות
const HUMAN_CONTENT_KEYWORDS = [
  'model', 'wear', 'wearing', 'person', 'people', 'woman', 'man', 
  'girl', 'boy', 'face', 'portrait', 'modeling', 'posing',
  'body', 'skin', 'hair', 'dress', 'outfit', 'fashion',
  'קישוט', 'לובש', 'איש', 'אישה', 'בן אדם', 'פנים', 'דיוקן'
];

// תבניות ביקורות ספאם
const SPAM_PATTERNS = [
  /^(good|great|nice|ok|okay|perfect|excellent)$/i,
  /[!]{3,}/, // יותר מ-2 סימני קריאה
  /[A-Z]{5,}/, // יותר מ-5 אותיות גדולות ברצף
  /(\b\w+\b)(\s+\1){2,}/i // חזרה של אותה מילה
];

/**
 * בדיקה אם ביקורת נראית כמו בוט/ספאם
 * 
 * @param {Object} review - ביקורת לבדיקה
 * @param {Array} allReviews - כל הביקורות להשוואה
 * @returns {Object} תוצאת ניתוח
 */
export function isLikelyBot(review, allReviews = []) {
  const content = review.content || '';
  const words = content.trim().split(/\s+/).filter(w => w.length > 0);
  const username = review.username || '';
  
  let botScore = 0;
  const flags = [];
  
  // 1. אורך טקסט קצר מדי
  if (words.length < 3) {
    botScore += 30;
    flags.push('too_short');
  }
  
  // 2. ביקורת ריקה או חסרת תוכן
  if (words.length === 0 || content.length < 10) {
    botScore += 40;
    flags.push('no_content');
  }
  
  // 3. חזרתיות - אותו טקסט מופיע בביקורות אחרות
  if (allReviews.length > 0) {
    const duplicates = allReviews.filter(r => 
      r.content && 
      r.content.length > 5 &&
      content.length > 5 &&
      r.content.toLowerCase().trim() === content.toLowerCase().trim() &&
      r !== review
    );
    
    if (duplicates.length > 0) {
      botScore += 25;
      flags.push('duplicate');
    }
  }
  
  // 4. תבניות ספאם
  SPAM_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      botScore += 15;
      flags.push('spam_pattern');
    }
  });
  
  // 5. שם משתמש חשוד (מספרים בלבד, או generic)
  if (/^\d+$/.test(username) || /^(user|buyer|customer|anonymous)\d*$/i.test(username)) {
    botScore += 10;
    flags.push('generic_username');
  }
  
  // 6. אין דירוג
  if (!review.rating || review.rating === 0) {
    botScore += 10;
    flags.push('no_rating');
  }
  
  // 7. תאריך חשוד (כל הביקורות מאותו יום)
  if (review.date) {
    const reviewDate = new Date(review.date);
    const now = new Date();
    const daysDiff = Math.abs(now - reviewDate) / (1000 * 60 * 60 * 24);
    
    // ביקורת מאוד ישנה או עתידית
    if (daysDiff > 365 || reviewDate > now) {
      botScore += 10;
      flags.push('suspicious_date');
    }
  }
  
  // קביעת רמת סיכון
  let trustLevel = 'verified';
  if (botScore >= 60) {
    trustLevel = 'suspicious';
  } else if (botScore >= 30) {
    trustLevel = 'uncertain';
  }
  
  return {
    isLikelyBot: botScore >= 50,
    botScore: Math.min(100, botScore),
    trustLevel,
    flags: [...new Set(flags)], // הסרת כפילויות
    recommendations: generateFilterRecommendations(flags)
  };
}

/**
 * יצירת המלצות לסינון
 */
function generateFilterRecommendations(flags) {
  const recommendations = [];
  
  if (flags.includes('too_short') || flags.includes('no_content')) {
    recommendations.push('Review lacks detail');
  }
  if (flags.includes('duplicate')) {
    recommendations.push('Similar to other reviews');
  }
  if (flags.includes('spam_pattern')) {
    recommendations.push('Contains spam patterns');
  }
  if (flags.includes('generic_username')) {
    recommendations.push('Generic user profile');
  }
  
  return recommendations;
}

/**
 * בדיקה אם תמונה עשויה להכיל דמויות אנושיות
 * מבוסס על alt text ו-url
 * 
 * @param {string} imageUrl - URL התמונה
 * @param {string} altText - טקסט חלופי
 * @returns {boolean} האם יש חשד לתוכן אנושי
 */
export function containsHumanContent(imageUrl = '', altText = '') {
  const combinedText = (imageUrl + ' ' + altText).toLowerCase();
  
  // בדיקת מילות מפתח
  for (const keyword of HUMAN_CONTENT_KEYWORDS) {
    if (combinedText.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  // בדיקת תבניות URL
  if (/model|person|people|wear|fashion|portrait|face/i.test(imageUrl)) {
    return true;
  }
  
  return false;
}

/**
 * סינון ביקורות מערך
 * 
 * @param {Array} reviews - מערך ביקורות
 * @returns {Object} ביקורות מסוננות עם דירוגי אמון
 */
export function filterReviews(reviews) {
  if (!Array.isArray(reviews)) return { filtered: [], stats: {} };
  
  const analyzed = reviews.map(review => {
    const botAnalysis = isLikelyBot(review, reviews);
    return {
      ...review,
      _trustAnalysis: botAnalysis,
      _isBlurred: review.images?.some(img => containsHumanContent(img.src, img.alt)) || false
    };
  });
  
  // סטטיסטיקות
  const stats = {
    total: analyzed.length,
    verified: analyzed.filter(r => r._trustAnalysis.trustLevel === 'verified').length,
    uncertain: analyzed.filter(r => r._trustAnalysis.trustLevel === 'uncertain').length,
    suspicious: analyzed.filter(r => r._trustAnalysis.trustLevel === 'suspicious').length,
    withBlurredImages: analyzed.filter(r => r._isBlurred).length
  };
  
  return {
    filtered: analyzed,
    stats
  };
}

/**
 * טעינת הגדרות Safe Mode
 * @returns {Promise<boolean>} האם Safe Mode מופעל
 */
export async function loadSafeModeSetting() {
  try {
    const result = await chrome.storage.local.get(['SAFE_MODE_ENABLED']);
    return result.SAFE_MODE_ENABLED !== false; // ברירת מחדל: true
  } catch (error) {
    return true;
  }
}

/**
 * שמירת הגדרות Safe Mode
 * @param {boolean} enabled - האם להפעיל
 */
export async function saveSafeModeSetting(enabled) {
  try {
    await chrome.storage.local.set({ SAFE_MODE_ENABLED: enabled });
  } catch (error) {
    console.error('[AliSmart] Failed to save safe mode setting:', error);
  }
}

/**
 * קבלת תווית אמון לביקורת
 * 
 * @param {string} trustLevel - רמת אמון
 * @param {string} language - שפה
 * @returns {Object} תווית וסגנון
 */
export function getTrustLabel(trustLevel, language = 'en') {
  const isRTL = language === 'he';
  
  const labels = {
    verified: {
      text: isRTL ? 'ביקורת מאומתת' : 'Verified Review',
      bgColor: '#dcfce7',
      textColor: '#166534',
      icon: '✓'
    },
    uncertain: {
      text: isRTL ? 'נדרשת בדיקה' : 'Check Review',
      bgColor: '#fef3c7',
      textColor: '#92400e',
      icon: '?'
    },
    suspicious: {
      text: isRTL ? 'ביקורת חשודה' : 'Suspicious Review',
      bgColor: '#fee2e2',
      textColor: '#991b1b',
      icon: '⚠'
    }
  };
  
  return labels[trustLevel] || labels.verified;
}

