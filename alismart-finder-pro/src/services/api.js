/**
 * AliSmart Finder Pro - API Services
 * מודול חיפוש ויזואלי וטקסטואלי - מוגדר מחדש לפי ארכיטקטורת ה-Pro
 * 
 * מכיל את כל פונקציות החיפוש המתקדמות:
 * - חיפוש ויזואלי לפי תמונה
 * - חיפוש טקסטואלי לפי מילות מפתח
 * - מיזוג תוצאות חיפוש
 * - קריאות API דרך ה-Proxy
 */

const PROXY_URL = 'https://alismart-proxy.vercel.app/api/search';
const FETCH_TIMEOUT = 15000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** @type {Map<string, {products: Array, timestamp: number}>} */
const visualSearchCache = new Map();

/**
 * מנקה URL של תמונה מתוך suffixes של AliExpress
 * מסיר suffixes כמו _80x80.jpg ומחזיר את ה-URL המקורי ברזולוציה גבוהה
 * 
 * @param {string} url - URL מקורי של תמונה
 * @returns {string} URL מנוקה ללא suffixes
 */
export function cleanImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  // מסיר suffixes של גדלים: _80x80.jpg, _300x300.jpg, _640x640.jpg וכו'
  let cleaned = url.replace(/_\d+x\d+\.[a-zA-Z]+$/, '');
  
  // מסיר וריאנטים אחרים כמו .jpg_50x50
  cleaned = cleaned.replace(/\.[a-zA-Z]+_\d+x\d+$/, '');
  
  // מוודא פרוטוקול
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  }
  
  return cleaned;
}

/**
 * מחלץ מילות מפתח משמעותיות מכותרת מוצר
 * מסיר מילי spam כמו "Hot Sale", "2026 New" ושומר רק על מונחים חיוניים
 * מוגבל ל-5 מילות מפתח מקסימום
 * 
 * @param {string} title - כותרת מוצר גולמית
 * @returns {string} מילות מפתח מנוקות
 */
export function extractKeywords(title) {
  if (!title || typeof title !== 'string') return '';
  
  // מילי spam שיש להסיר
  const spamWords = [
    'hot sale', 'new', '2026', '2025', '2024', 'brand', 'genuine', 'authentic',
    'high quality', 'best seller', 'top rated', 'popular', 'trending',
    'limited time', 'special offer', 'discount', 'cheap', 'wholesale',
    'free shipping', 'fast delivery', 'dropshipping', 'bestseller',
    '100%', 'official', 'original', 'premium', 'luxury', 'cheap'
  ];
  
  // ניקוי כותרת: lowercase, הסרת תווים מיוחדים
  let cleaned = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // הסרת תווים מיוחדים
    .replace(/\s+/g, ' ')       // נרמול רווחים
    .trim();
  
  // הסרת מילי spam
  spamWords.forEach(spam => {
    const regex = new RegExp('\\b' + spam + '\\b', 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  
  // פיצול למילים וסינון
  const words = cleaned
    .split(' ')
    .map(w => w.trim())
    .filter(w => w.length > 2)           // דילוג על מילים קצרות
    .filter(w => !/^\d+$/.test(w))      // דילוג על מספרים טהורים
    .filter((w, i, arr) => arr.indexOf(w) === i); // הסרת כפילויות
  
  // הגבלה ל-5 מילות מפתח מקסימום
  const keywords = words.slice(0, 5);
  
  return keywords.join(' ');
}

/**
 * מבצע חיפוש ויזואלי ב-AliExpress באמצעות URL של תמונה
 * משתמש ב-caching למניעת קריאות API כפולות
 * 
 * @param {string} imgUrl - URL של התמונה לחיפוש
 * @returns {Promise<Array>} מערך של מוצרים דומים
 */
export async function performVisualSearch(imgUrl) {
  if (!imgUrl) {
    console.log('[AliSmart] No image URL provided for visual search');
    return [];
  }
  
  // ניקוי ה-URL של התמונה לחיפוש אופטימלי
  const cleanUrl = cleanImageUrl(imgUrl);
  const cacheKey = cleanUrl;
  
  // בדיקת קאש תחילה
  const cached = visualSearchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log('[AliSmart] Using cached visual search results for:', cleanUrl.substring(0, 50));
    return cached.products;
  }
  
  console.log('[AliSmart] Performing visual search with cleaned URL:', cleanUrl.substring(0, 50));
  
  try {
    // בניית URL לחיפוש ויזואלי
    const apiUrl = `https://www.aliexpress.com/pictures/vsearch/api/search?imgUrl=${encodeURIComponent(cleanUrl)}&count=12`;
    
    // ניסיון קריאה ל-API endpoint
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://www.aliexpress.com'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.products && Array.isArray(data.products)) {
          const products = parseApiResults(data.products);
          console.log('[AliSmart] Visual search API returned', products.length, 'products');
          
          // שמירה בקאש
          visualSearchCache.set(cacheKey, {
            products,
            timestamp: Date.now()
          });
          
          return products;
        }
      }
    } catch (apiError) {
      console.log('[AliSmart] API search failed:', apiError.message);
    }
    
    console.log('[AliSmart] Visual search complete, no results from API');
    return [];
    
  } catch (error) {
    console.log('[AliSmart] Visual search error:', error.message);
    return [];
  }
}

/**
 * מבצע חיפוש טקסטואלי ב-AliExpress באמצעות מילות מפתח מנוקות
 * 
 * @param {string} query - שאילתת חיפוש (כותרת מנוקה)
 * @returns {Promise<Array>} מערך של מוצרים מתוצאות החיפוש
 */
export async function performTextSearch(query) {
  if (!query || query.trim().length < 3) {
    console.log('[AliSmart] Query too short for text search');
    return [];
  }
  
  const keywords = extractKeywords(query);
  if (!keywords) {
    console.log('[AliSmart] No keywords extracted for search');
    return [];
  }
  
  console.log('[AliSmart] Performing text search with keywords:', keywords);
  
  try {
    // קריאה ל-background script לעקיפת CORS
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'searchByKeyword',
        keyword: keywords
      }, resolve);
    });
    
    if (response?.success && response.products && Array.isArray(response.products)) {
      console.log('[AliSmart] Text search returned', response.products.length, 'products');
      return response.products.map(p => ({
        ...p,
        searchSource: 'text'
      }));
    }
    
    return [];
  } catch (error) {
    console.log('[AliSmart] Text search error:', error.message);
    return [];
  }
}

/**
 * מבצע חיפוש דרך ה-Proxy של Vercel
 * 
 * @param {string} keyword - מילת מפתח לחיפוש
 * @param {number} page - מספר עמוד
 * @param {number} pageSize - כמות תוצאות בעמוד
 * @param {string} sort - מיון תוצאות
 * @param {string} imgUrl - URL תמונה (אופציונלי)
 * @param {string} title - כותרת (אופציונלי)
 * @param {string} currentId - ID נוכחי (אופציונלי)
 * @returns {Promise<Object>} תוצאות החיפוש
 */
export async function searchViaProxy(keyword, page = 1, pageSize = 50, sort = 'SALE_PRICE_ASC', imgUrl = '', title = '', currentId = '') {
  console.log('[AliSmart] Searching via Vercel proxy:', { keyword, imgUrl, title, currentId });
  
  // אם אין מילת מפתח, מחזירים שגיאה
  if (!keyword || keyword.trim() === '') {
    console.log('[AliSmart] Search skipped: Empty keyword');
    return { error: 'Empty keyword' };
  }
  
  const body = {
    action: 'search',
    keyword: keyword || '',
    page,
    pageSize,
    sort
  };
  
  if (imgUrl) {
    body.imgUrl = imgUrl;
    console.log('[AliSmart] Including image URL for Visual Search:', imgUrl);
  }
  if (title) body.title = title;
  if (currentId) body.currentId = currentId;
  
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify(body),
    credentials: 'omit',
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  
  if (!response.ok) {
    throw new Error(`Proxy error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  console.log('[AliSmart] Proxy response received');
  return data;
}

/**
 * ממזג תוצאות חיפוש ויזואלי וטקסטואלי, מסיר כפילויות
 * נותן עדיפות לתוצאות ויזואליות, מוסיף פריטים ייחודיים מחיפוש טקסטואלי
 * 
 * @param {Array} visualResults - תוצאות חיפוש ויזואלי
 * @param {Array} textResults - תוצאות חיפוש טקסטואלי
 * @returns {Array} מוצרים ממוזגים ללא כפילויות
 */
export function mergeSearchResults(visualResults, textResults) {
  const merged = [...(visualResults || [])];
  const seenIds = new Set(merged.map(p => p.productId).filter(Boolean));
  
  // הוספת תוצאות טקסט ייחודיות
  (textResults || []).forEach(product => {
    const id = product.productId;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      merged.push({ ...product, searchSource: 'text' });
    }
  });
  
  console.log('[AliSmart] Merged', visualResults?.length || 0, 'visual +', textResults?.length || 0, 
      'text =', merged.length, 'unique products');
  
  return merged;
}

/**
 * מפענח תוצאות API למבנה מוצר סטנדרטי
 * 
 * @param {Array} apiProducts - מוצרים מה-API של AliExpress
 * @returns {Array} אובייקטי מוצר בסטנדרט אחיד
 */
export function parseApiResults(apiProducts) {
  return apiProducts.map(item => {
    // חילוץ ערך מחיר
    const priceStr = item.price || item.salePrice || '0';
    const priceMatch = priceStr.match(/[\d,.]+/);
    const priceValue = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
    
    // חילוץ מחיר משלוח
    let shippingValue = 0;
    let shippingText = 'Check website';
    if (item.logistics && item.logistics.freightAmount) {
      shippingValue = parseFloat(item.logistics.freightAmount.value) || 0;
      shippingText = shippingValue === 0 ? 'Free shipping' : `$${shippingValue.toFixed(2)}`;
    }
    
    return {
      product_title: item.title || item.productTitle || 'Unknown Product',
      product_main_image_url: item.imageUrl || item.imgUrl || item.image,
      product_detail_url: item.productUrl || item.url || `https://www.aliexpress.com/item/${item.productId}.html`,
      price: priceStr,
      priceValue: priceValue,
      shipping: shippingText,
      shippingValue: shippingValue,
      rating: parseFloat(item.evaluationStar) || 0,
      orders: parseInt(item.tradeCount) || 0,
      productId: item.productId
    };
  });
}

/**
 * מבצע חיפוש היברידי משולב (ויזואלי + טקסטואלי)
 * מריץ את שני החיפושים במקביל לכיסוי מקסימלי
 * 
 * @param {string} title - כותרת המוצר
 * @param {string} imgUrl - URL התמונה
 * @returns {Promise<Array>} מערך מוצרים ממווג וללא כפילויות
 */
export async function triggerHybridSearch(title, imgUrl) {
  console.log('[AliSmart] Triggering hybrid search:', { 
    title: title?.substring(0, 50), 
    imgUrl: imgUrl?.substring(0, 50) 
  });

  // הרצת שני החיפושים במקביל לכיסוי מקסימלי
  const [visualResults, textResults] = await Promise.all([
    // חיפוש ויזואלי (אם יש תמונה)
    imgUrl ? performVisualSearch(imgUrl).catch(err => {
      console.log('[AliSmart] Visual search failed:', err.message);
      return [];
    }) : Promise.resolve([]),
    
    // חיפוש טקסטואלי (תמיד רץ כגיבוי/העשרה)
    performTextSearch(title).catch(err => {
      console.log('[AliSmart] Text search failed:', err.message);
      return [];
    })
  ]);

  console.log('[AliSmart] Visual search:', visualResults.length, 'products, Text search:', textResults.length, 'products');

  // מיזוג תוצאות, הסרת כפילויות
  const mergedProducts = mergeSearchResults(visualResults, textResults);
  
  console.log('[AliSmart] Hybrid search complete:', mergedProducts.length, 'total unique products');
  
  return mergedProducts;
}

/**
 * מחפש מוצרים לפי תמונה דרך ה-Proxy
 * 
 * @param {string} imageUrl - URL של התמונה
 * @returns {Promise<Object>} תוצאות החיפוש
 */
export async function searchByImage(imageUrl) {
  if (!imageUrl) {
    return { success: false, error: 'No image URL provided' };
  }

  const cacheKey = `img:${imageUrl}`;
  const cached = visualSearchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return { success: true, products: cached.products };
  }

  try {
    const searchUrl = `${PROXY_URL}?imageUrl=${encodeURIComponent(imageUrl)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Image search failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const products = data?.products || [];
    const result = { success: true, products };
    
    visualSearchCache.set(cacheKey, {
      products,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error('[AliSmart] Image search error:', error);
    return { success: false, error: error.message || 'Image search failed' };
  }
}

/**
 * מחפש מוצרים לפי מילת מפתח דרך ה-Proxy
 * 
 * @param {string} keyword - מילת המפתח
 * @param {number} page - מספר עמוד
 * @param {string} sort - מיון תוצאות
 * @returns {Promise<Object>} תוצאות החיפוש
 */
export async function searchByKeyword(keyword, page = 1, sort = null) {
  try {
    const config = await getConfig();
    const pageSize = Math.min(config.RESULTS_PER_PAGE || 50, 50);
    const sortBy = sort || config.SORT_BY || 'SALE_PRICE_ASC';

    const data = await searchViaProxy(keyword, page, pageSize, sortBy);

    // חילוץ מוצרים מתוך מבנה התשובה
    const products = data?.products || 
                     data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || 
                     [];

    return { success: true, products };
  } catch (error) {
    console.error('[AliSmart] Keyword search error:', error);
    return { success: false, error: error.message || 'Search failed' };
  }
}

/**
 * ממיר מטבע ל-USD
 * 
 * @param {string} fromCurrency - מטבע מקור
 * @param {number} amount - סכום
 * @returns {Promise<Object>} תוצאת ההמרה
 */
export async function convertCurrency(fromCurrency = 'USD', amount = 0) {
  try {
    const rates = await getExchangeRates();
    const rate = rates[fromCurrency] || 1;
    const usdAmount = +(amount / rate).toFixed(2);
    return { success: true, usdAmount, rate, rates };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * מושג תצורת הגדרות מה-storage
 * @returns {Promise<Object>} הגדרות התוסף
 */
export function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['CURRENCY', 'LANGUAGE', 'RESULTS_PER_PAGE', 'SORT_BY'],
      (result) => {
        resolve({
          CURRENCY: result.CURRENCY || 'USD',
          LANGUAGE: result.LANGUAGE || 'he',
          RESULTS_PER_PAGE: result.RESULTS_PER_PAGE || 50,
          SORT_BY: result.SORT_BY || 'SALE_PRICE_ASC'
        });
      }
    );
  });
}

// משתנים גלובליים לשערי חליפין
let exchangeRates = null;
let ratesFetchedAt = 0;
const RATES_TTL = 6 * 60 * 60 * 1000; // 6 שעות

// הגדרות AI מקומי
const OLLAMA_BASE_URL = 'http://localhost:11434';
const LM_STUDIO_BASE_URL = 'http://localhost:1234';
const LOCAL_AI_TIMEOUT = 30000; // 30 שניות

/**
 * מושג שערי חליפין עדכניים
 * @returns {Promise<Object>} שערי חליפין
 */
async function getExchangeRates() {
  if (exchangeRates && Date.now() - ratesFetchedAt < RATES_TTL) {
    return exchangeRates;
  }
  
  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.result === 'success' && json.rates) {
      exchangeRates = json.rates;
      ratesFetchedAt = Date.now();
      return exchangeRates;
    }
    throw new Error('Unexpected response');
  } catch (e) {
    console.warn('[AliSmart] Exchange rates fetch failed:', e.message);
    // שערי ברירת מחדל
    return {
      USD: 1, EUR: 0.92, GBP: 0.79, ILS: 3.65, BRL: 5.05, AUD: 1.55, CAD: 1.37,
      JPY: 155, CNY: 7.25, INR: 83.5, KRW: 1350, SEK: 10.8, PLN: 4.05, RUB: 92, ZAR: 18.5,
      TRY: 32, THB: 35, MYR: 4.7, PHP: 56, VND: 25000, TWD: 32, HKD: 7.8, SGD: 1.35,
      NZD: 1.7, DKK: 6.9, NOK: 10.8, CZK: 23.5, HUF: 370, RON: 4.6, CHF: 0.88
    };
  }
}

/**
 * בדיקה אם Ollama זמין
 * @returns {Promise<boolean>}
 */
async function isOllamaAvailable() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * בדיקה אם LM Studio זמין
 * @returns {Promise<boolean>}
 */
async function isLMStudioAvailable() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${LM_STUDIO_BASE_URL}/v1/models`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * סיכום ביקורות באמצעות Ollama (AI מקומי)
 * @param {string} reviewTexts - טקסט הביקורות לסיכום
 * @param {string} language - שפת הסיכום (en/he)
 * @returns {Promise<Object>} סיכום בפורמט Pros/Cons/Verdict
 */
async function summarizeWithOllama(reviewTexts, language = 'en') {
  const prompt = language === 'he' 
    ? `אנא נתח את הביקורות הבאות וספק סיכום בפורמט JSON:

ביקורות:
${reviewTexts}

החזר תשובה בפורמט JSON בלבד:
{
  "pros": ["יתרון 1", "יתרון 2", "יתרון 3"],
  "cons": ["חיסרון 1", "חיסרון 2"],
  "verdict": "שורה תחתונה - האם המוצר מומלץ?",
  "satisfactionRate": 85
}

הנחיות:
- pros: עד 3 יתרונות עיקריים שחוזרים בביקורות
- cons: עד 3 חסרונות עיקריים שחוזרים בביקורות  
- verdict: שורה אחת תחתונה - האם המוצר שווה קניה?
- satisfactionRate: אחוז שביעות רצון מוערך (0-100)`
    : `Please analyze the following reviews and provide a summary in JSON format:

Reviews:
${reviewTexts}

Return response in JSON format only:
{
  "pros": ["pro 1", "pro 2", "pro 3"],
  "cons": ["con 1", "con 2"],
  "verdict": "bottom line - is this product recommended?",
  "satisfactionRate": 85
}

Guidelines:
- pros: up to 3 main advantages mentioned in reviews
- cons: up to 3 main disadvantages mentioned in reviews
- verdict: one line bottom line - is this product worth buying?
- satisfactionRate: estimated satisfaction percentage (0-100)`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2:3b', // או כל מודל זמין אחר
      prompt: prompt,
      stream: false,
      format: 'json'
    }),
    signal: AbortSignal.timeout(LOCAL_AI_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  
  // פענוח התשובה
  try {
    const parsed = JSON.parse(data.response);
    return {
      pros: parsed.pros || [],
      cons: parsed.cons || [],
      verdict: parsed.verdict || '',
      satisfactionRate: parsed.satisfactionRate || 0,
      source: 'ollama'
    };
  } catch (e) {
    throw new Error('Failed to parse Ollama response');
  }
}

/**
 * סיכום ביקורות באמצעות LM Studio (AI מקומי)
 * @param {string} reviewTexts - טקסט הביקורות לסיכום
 * @param {string} language - שפת הסיכום (en/he)
 * @returns {Promise<Object>} סיכום בפורמט Pros/Cons/Verdict
 */
async function summarizeWithLMStudio(reviewTexts, language = 'en') {
  const systemPrompt = language === 'he'
    ? 'אתה עוזר AI שמסכם ביקורות מוצרים. החזר תשובה בפורמט JSON בלבד.'
    : 'You are an AI assistant that summarizes product reviews. Return response in JSON format only.';

  const userPrompt = language === 'he'
    ? `אנא נתח את הביקורות הבאות וספק סיכום בפורמט JSON:

ביקורות:
${reviewTexts}

החזר תשובה בפורמט JSON בלבד:
{
  "pros": ["יתרון 1", "יתרון 2"],
  "cons": ["חיסרון 1", "חיסרון 2"],
  "verdict": "שורה תחתונה",
  "satisfactionRate": 85
}`
    : `Please analyze the following reviews and provide a summary in JSON format:

Reviews:
${reviewTexts}

Return response in JSON format only:
{
  "pros": ["pro 1", "pro 2"],
  "cons": ["con 1", "con 2"],
  "verdict": "bottom line",
  "satisfactionRate": 85
}`;

  const response = await fetch(`${LM_STUDIO_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local-model',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    }),
    signal: AbortSignal.timeout(LOCAL_AI_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.status}`);
  }

  const data = await response.json();
  
  try {
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    return {
      pros: parsed.pros || [],
      cons: parsed.cons || [],
      verdict: parsed.verdict || '',
      satisfactionRate: parsed.satisfactionRate || 0,
      source: 'lmstudio'
    };
  } catch (e) {
    throw new Error('Failed to parse LM Studio response');
  }
}

/**
 * סיכום ביקורות באמצעות AI - מנסה מקומי קודם, אז חיצוני
 * פרטיות: שולח רק טקסט ביקורות ציבורי, ללא מידע אישי
 * @param {Array} reviews - מערך ביקורות
 * @param {string} language - שפת הסיכום
 * @returns {Promise<Object>} סיכום מבנה Pros/Cons/Verdict
 */
export async function summarizeReviews(reviews, language = 'en') {
  if (!reviews || reviews.length === 0) {
    throw new Error('No reviews to summarize');
  }

  // הכנת הטקסט - רק תוכן ביקורות ציבורי, ללא מידע אישי
  const reviewTexts = reviews
    .slice(0, 30) // הגבלה ל-30 ביקורות להקלה על המודל
    .map(r => `Rating: ${r.rating}/5 - ${r.content}`)
    .join('\n---\n');

  // ניסיון AI מקומי קודם (פרטיות מירבית)
  try {
    const [ollamaAvailable, lmStudioAvailable] = await Promise.all([
      isOllamaAvailable(),
      isLMStudioAvailable()
    ]);

    if (ollamaAvailable) {
      console.log('[AliSmart] Using local Ollama for review summarization');
      return await summarizeWithOllama(reviewTexts, language);
    }

    if (lmStudioAvailable) {
      console.log('[AliSmart] Using local LM Studio for review summarization');
      return await summarizeWithLMStudio(reviewTexts, language);
    }
  } catch (localError) {
    console.log('[AliSmart] Local AI failed, falling back to cloud:', localError.message);
  }

  // Fallback ל-API חיצוני
  try {
    const response = await fetch('https://alismart-proxy.vercel.app/api/summarize-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviews: reviewTexts,
        language,
        count: reviews.length,
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      pros: data.pros || [],
      cons: data.cons || [],
      verdict: data.verdict || '',
      satisfactionRate: data.satisfactionRate || calculateBasicSatisfaction(reviews),
      totalReviews: reviews.length,
      source: 'cloud'
    };
  } catch (apiError) {
    console.error('[AliSmart] All summarization methods failed:', apiError);
    // Fallback בסיסי ביותר
    return generateBasicSummary(reviews, language);
  }
}

/**
 * חישוב שביעות רצון בסיסי
 * @param {Array} reviews - מערך ביקורות
 * @returns {number} אחוז שביעות רצון
 */
function calculateBasicSatisfaction(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  const positive = reviews.filter(r => r.rating >= 4).length;
  return Math.round((positive / reviews.length) * 100);
}

/**
 * יצירת סיכום בסיסי ללא AI
 * @param {Array} reviews - מערך ביקורות
 * @param {string} language - שפה
 * @returns {Object} סיכום בסיסי
 */
function generateBasicSummary(reviews, language) {
  const satisfactionRate = calculateBasicSatisfaction(reviews);
  const allText = reviews.map(r => r.content?.toLowerCase() || '').join(' ');
  
  const positiveKeywords = {
    en: ['good', 'great', 'excellent', 'perfect', 'amazing', 'quality', 'fast', 'recommend', 'love', 'nice', 'best'],
    he: ['טוב', 'מעולה', 'איכותי', 'מהיר', 'מומלץ', 'אהבתי', 'נחמד', 'הכי טוב']
  };
  
  const negativeKeywords = {
    en: ['bad', 'poor', 'terrible', 'slow', 'broken', 'defective', 'waste', 'disappointing', 'small'],
    he: ['רע', 'גרוע', 'נורא', 'איטי', 'שבור', 'פגום', 'בזבוז', 'מאכזב', 'קטן']
  };

  const lang = language === 'he' ? 'he' : 'en';
  const posWords = positiveKeywords[lang];
  const negWords = negativeKeywords[lang];

  const detectedPros = posWords.filter(w => allText.includes(w)).slice(0, 3);
  const detectedCons = negWords.filter(w => allText.includes(w)).slice(0, 3);

  let verdict;
  if (satisfactionRate >= 80) {
    verdict = language === 'he' ? 'מומלץ בחום' : 'Highly recommended';
  } else if (satisfactionRate >= 60) {
    verdict = language === 'he' ? 'ביקורות מעורבות' : 'Mixed reviews';
  } else {
    verdict = language === 'he' ? 'התקדם בזהירות' : 'Proceed with caution';
  }

  return {
    pros: detectedPros.length ? detectedPros : [language === 'he' ? 'ביקורות חיוביות' : 'Positive feedback'],
    cons: detectedCons.length ? detectedCons : [language === 'he' ? 'לא נמצאו חסרונות משמעותיים' : 'No major issues'],
    verdict,
    satisfactionRate,
    totalReviews: reviews.length,
    source: 'basic'
  };
}

// ============================================================
// Smart Share & Affiliate Link Generator
// מחולל שיתוף וקישורי אפיליאייט
// ============================================================

/**
 * מזהה Affiliate מההגדרות או משתמש בברירת מחדל
 * @returns {string} Affiliate ID
 */
export async function getAffiliateId() {
  try {
    const config = await chrome.storage.sync.get(['AFFILIATE_ID', 'CUSTOM_AFFILIATE_ID']);
    return config.CUSTOM_AFFILIATE_ID || config.AFFILIATE_ID || 'alismart';
  } catch (e) {
    return 'alismart';
  }
}

/**
* ניקוי URL מפרמטרי מעקב ושאריות
* 
* @param {string} url - URL מקורי
* @returns {string} URL מנוקה
*/
export function cleanAliExpressUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  try {
    const urlObj = new URL(url);
    
    // רשימת פרמטרים להסרה
    const paramsToRemove = [
      'spm', 'scm', 'aff_platform', 'aff_trace_key', 'algo_pvid',
      'algo_expid', 'pdp_ext_f', 'pdp_npi', 'gps-id', 'scm_id',
      'scm-url', 'scm1001003', 'scm1001009', 'scm1002001',
      'sk', 'srcSns', 'snsAbTest', 'businessType', 'templateId',
      'tt', 'channel', 'from', '_t', 'cv', 'af', 'mall_affr',
      'dp', 'mall_affr_pr1', 'mall_affr_pr2'
    ];
    
    // הסרת פרמטרים מיותרים
    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // החזרת URL נקי
    return urlObj.toString();
  } catch (e) {
    // אם URL לא תקין, החזר כמות שהוא
    return url;
  }
}

/**
* יצירת קישור אפיליאייט עם ID משובץ
* 
* @param {string} productUrl - URL מוצר מנוקה
* @param {string} affiliateId - מזהה אפיליאייט (אופציונלי)
* @returns {Promise<string>} קישור אפיליאייט
*/
export async function generateAffiliateLink(productUrl, affiliateId = null) {
  if (!productUrl) {
    throw new Error('No product URL provided');
  }
  
  // ניקוי ה-URL תחילה
  const cleanUrl = cleanAliExpressUrl(productUrl);
  
  // קבלת מזהה אפיליאייט
  const affId = affiliateId || await getAffiliateId();
  
  try {
    const urlObj = new URL(cleanUrl);
    
    // הוספת פרמטר אפיליאייט
    urlObj.searchParams.set('aff_id', affId);
    
    // הוספת פרמטרים נוספים לזיהוי
    urlObj.searchParams.set('alismart_ref', 'extension');
    
    return urlObj.toString();
  } catch (e) {
    console.error('[AliSmart] Failed to generate affiliate link:', e);
    return cleanUrl;
  }
}

/**
* יצירת קישור מקוצר (Short Link)
* משתמש ב-API חיצוני או יוצר קיצור פנימי
* 
* @param {string} url - URL לקיצור
* @returns {Promise<{shortUrl: string, qrCode: string}>} קישור מקוצר ו-QR
*/
export async function generateShortLink(url) {
  if (!url) {
    throw new Error('No URL provided');
  }
  
  try {
    // ניסיון ליצור קיצור דרך ה-Proxy שלנו
    const response = await fetch('https://alismart-proxy.vercel.app/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        shortUrl: data.shortUrl || data.url,
        qrCode: data.qrCode || generateQRCode(url)
      };
    }
    
    // Fallback: קיצור פנימי
    return generateInternalShortLink(url);
  } catch (error) {
    console.log('[AliSmart] Short link service failed, using internal:', error.message);
    return generateInternalShortLink(url);
  }
}

/**
* יצירת קיצור פנימי (Fallback)
* משתמש ב-alismart.link או מחזיר את הלינק המקורי עם hash
* 
* @param {string} url - URL לקיצור
* @returns {{shortUrl: string, qrCode: string}} קישור מקוצר
*/
function generateInternalShortLink(url) {
  // יצירת hash קצר מה-URL
  const hash = btoa(url).substring(0, 8).replace(/[^a-zA-Z0-9]/g, '');
  
  return {
    shortUrl: `https://go.alismart.link/${hash}`,
    qrCode: generateQRCode(url)
  };
}

/**
* יצירת QR Code (Data URL)
* משתמש ב-API חיצוני ליצירת QR
* 
* @param {string} url - URL ל-QR
* @param {number} size - גודל QR בפיקסלים
* @returns {string} Data URL של QR Code
*/
export function generateQRCode(url, size = 200) {
  // שימוש ב-API של goqr.me (חינמי, ללא auth)
  const encodedUrl = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}`;
}

/**
* יצירת מחרוזת שיתוף לוואטסאפ/טלגרם
* 
* @param {Object} product - נתוני מוצר
* @param {string} shortUrl - קישור מקוצר
* @param {string} language - שפה (en/he)
* @returns {string} מחרוזת שיתוף מעוצבת
*/
export function generateShareMessage(product, shortUrl, language = 'en') {
  const isRTL = language === 'he';
  
  const title = product?.title || product?.product_title || 'Product';
  const price = product?.price || product?.target_sale_price || '';
  
  if (isRTL) {
    return `תראה מה מצאתי! 🎁

${title}${price ? ` - ${price}` : ''}

${shortUrl}`;
  }
  
  return `Check this out! 🎁

${title}${price ? ` - ${price}` : ''}

${shortUrl}`;
}

/**
* יצירת URL לשיתוף ישיר בוואטסאפ
* 
* @param {string} message - הודעה לשיתוף
* @returns {string} URL לוואטסאפ
*/
export function generateWhatsAppShareUrl(message) {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/?text=${encodedMessage}`;
}

/**
* יצירת URL לשיתוף ישיר בטלגרם
* 
* @param {string} message - הודעה לשיתוף
* @returns {string} URL לטלגרם
*/
export function generateTelegramShareUrl(message) {
  const encodedMessage = encodeURIComponent(message);
  return `https://t.me/share/url?text=${encodedMessage}`;
}

/**
* העתקת טקסט ללוח
* 
* @param {string} text - טקסט להעתקה
* @returns {Promise<boolean>} האם ההעתקה הצליחה
*/
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback לשיטה הישנה
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      console.error('[AliSmart] Failed to copy to clipboard:', e);
      return false;
    }
  }
}

// ============================================================
// Price Drop Trend Analysis
// ניתוח מגמות ירידות מחיר
// ============================================================

/**
 * יצירת נתוני מגמה סימולציה (Mock) למוצר
 * בשימוש אמיתי, היה שולף מה-API או מ-Storage
 * 
 * @param {string} productId - מזהה מוצר
 * @param {number} currentPrice - מחיר נוכחי
 * @returns {Array} היסטוריית מחירים (30 יום)
 */
export function generateMockPriceHistory(productId, currentPrice = 0) {
  const history = [];
  const days = 30;
  const basePrice = currentPrice > 0 ? currentPrice * 1.2 : 50; // מחיר בסיס גבוה יותר
  
  // יצירת מגמה עם תנודות ריאליסטיות
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // סימולציית תנודות מחיר
    const randomFactor = 0.9 + (Math.random() * 0.25); // בין -10% ל-+25%
    const trendFactor = 1 - (i * 0.005); // מגמת ירידה עדינה
    const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.97 : 1; // ירידה בסופ"ש
    
    const price = Math.max(
      currentPrice * 0.7, // מחיר מינימום
      basePrice * randomFactor * trendFactor * weekendFactor
    );
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2)),
      dayOfWeek: date.getDay()
    });
  }
  
  return history;
}

/**
 * איסוף נתוני מגמה מ-5 מוצרים דומים
 * 
 * @param {Array} similarProducts - מערך מוצרים דומים
 * @param {Object} currentProduct - המוצר הנוכחי
 * @returns {Promise<Object>} נתוני מגמה
 */
export async function getMarketTrend(similarProducts, currentProduct) {
  if (!similarProducts || similarProducts.length === 0) {
    console.log('[AliSmart] No similar products for trend analysis');
    return null;
  }
  
  try {
    // בחירת 5 מוצרים מובילים
    const topProducts = similarProducts.slice(0, 5);
    
    // יצירת היסטוריית מחירים לכל מוצר
    const productsWithHistory = topProducts.map(product => {
      const price = parseFloat(product.priceValue || product.price || 50);
      return {
        ...product,
        priceHistory: generateMockPriceHistory(product.productId, price)
      };
    });
    
    // הוספת המוצר הנוכחי
    const currentPrice = parseFloat(
      currentProduct.priceValue || currentProduct.price || 50
    );
    const currentHistory = generateMockPriceHistory(
      currentProduct.productId || 'current',
      currentPrice
    );
    
    // חישוב ממוצע שוק
    const marketAverage = calculateMarketAverage(productsWithHistory);
    
    // חישוב מגמות
    const trends = calculateTrends(currentHistory, marketAverage);
    
    return {
      currentProduct: {
        id: currentProduct.productId || 'current',
        name: currentProduct.title || 'Current Product',
        history: currentHistory,
        currentPrice: currentPrice
      },
      marketAverage: marketAverage,
      similarProducts: productsWithHistory.map(p => ({
        id: p.productId,
        name: p.title,
        currentPrice: parseFloat(p.priceValue || p.price || 50),
        history: p.priceHistory
      })),
      trends: trends,
      buyingAdvice: generateBuyingAdvice(trends, currentPrice, marketAverage),
      marketStatus: determineMarketStatus(trends)
    };
  } catch (error) {
    console.error('[AliSmart] Failed to get market trend:', error);
    return null;
  }
}

/**
 * חישוב ממוצע שוק
 * 
 * @param {Array} products - מוצרים עם היסטוריה
 * @returns {Array} ממוצע שוק יומי
 */
function calculateMarketAverage(products) {
  const days = 30;
  const marketAverage = [];
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // איסוף מחירים של כל המוצרים ביום זה
    const pricesForDay = products
      .map(p => {
        const dayData = p.priceHistory.find(h => h.date === dateStr);
        return dayData ? dayData.price : null;
      })
      .filter(p => p !== null);
    
    if (pricesForDay.length > 0) {
      const avgPrice = pricesForDay.reduce((a, b) => a + b, 0) / pricesForDay.length;
      marketAverage.push({
        date: dateStr,
        price: parseFloat(avgPrice.toFixed(2))
      });
    }
  }
  
  return marketAverage;
}

/**
 * חישוב מגמות מחיר
 * 
 * @param {Array} currentHistory - היסטוריית מוצר נוכחי
 * @param {Array} marketAverage - ממוצע שוק
 * @returns {Object} מגמות
 */
function calculateTrends(currentHistory, marketAverage) {
  if (!currentHistory.length || !marketAverage.length) {
    return { direction: 'stable', strength: 0 };
  }
  
  // מחיר התחלה וסוף
  const currentStart = currentHistory[0].price;
  const currentEnd = currentHistory[currentHistory.length - 1].price;
  const marketStart = marketAverage[0].price;
  const marketEnd = marketAverage[marketAverage.length - 1].price;
  
  // שינוי באחוזים
  const currentChange = ((currentEnd - currentStart) / currentStart) * 100;
  const marketChange = ((marketEnd - marketStart) / marketStart) * 100;
  
  // חישוב ממוצע נע (7 ימים)
  const currentMovingAvg7 = calculateMovingAverage(currentHistory, 7);
  const marketMovingAvg7 = calculateMovingAverage(marketAverage, 7);
  
  // תנודתיות (Volatility)
  const volatility = calculateVolatility(currentHistory);
  
  // קביעת כיוון מגמה
  let direction = 'stable';
  if (currentChange < -5) direction = 'falling';
  else if (currentChange > 5) direction = 'rising';
  
  // חישוב עוצמת מגמה (0-100)
  const strength = Math.min(100, Math.abs(currentChange) * 5);
  
  return {
    currentChange: parseFloat(currentChange.toFixed(1)),
    marketChange: parseFloat(marketChange.toFixed(1)),
    currentMovingAvg7: currentMovingAvg7,
    marketMovingAvg7: marketMovingAvg7,
    volatility: parseFloat(volatility.toFixed(1)),
    direction: direction,
    strength: parseFloat(strength.toFixed(1)),
    vsMarket: parseFloat(((currentEnd - marketEnd) / marketEnd * 100).toFixed(1))
  };
}

/**
 * חישוב ממוצע נע
 * 
 * @param {Array} data - נתוני מחיר
 * @param {number} period - תקופה (ימים)
 * @returns {number} ממוצע נע
 */
function calculateMovingAverage(data, period) {
  if (!data.length || period > data.length) return 0;
  
  const recent = data.slice(-period);
  const sum = recent.reduce((acc, item) => acc + item.price, 0);
  return parseFloat((sum / period).toFixed(2));
}

/**
 * חישוב תנודתיות (Volatility)
 * 
 * @param {Array} data - נתוני מחיר
 * @returns {number} תנודתיות באחוזים
 */
function calculateVolatility(data) {
  if (data.length < 2) return 0;
  
  const prices = data.map(d => d.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  
  return (stdDev / mean) * 100; // CV - Coefficient of Variation
}

/**
 * קביעת סטטוס שוק
 * 
 * @param {Object} trends - מגמות
 * @returns {Object} סטטוס שוק
 */
function determineMarketStatus(trends) {
  const { direction, strength, vsMarket, volatility } = trends;
  
  // מד חום (0-100)
  let heatScore = 50;
  
  if (direction === 'rising') {
    heatScore += strength * 0.5; // עלייה = חם
  } else if (direction === 'falling') {
    heatScore -= strength * 0.5; // ירידה = קר
  }
  
  if (volatility > 15) heatScore += 10; // תנודתיות גבוהה = חם
  
  heatScore = Math.max(0, Math.min(100, heatScore));
  
  let status = 'neutral';
  let label = 'Stable Market';
  let labelHe = 'שוק יציב';
  let color = '#6b7280'; // gray
  
  if (heatScore >= 70) {
    status = 'hot';
    label = 'Hot Market 🔥';
    labelHe = 'שוק חם 🔥';
    color = '#ef4444'; // red
  } else if (heatScore >= 55) {
    status = 'warming';
    label = 'Warming Up ↗️';
    labelHe = 'מתחמם ↗️';
    color = '#f97316'; // orange
  } else if (heatScore <= 30) {
    status = 'cold';
    label = 'Cold Market ❄️';
    labelHe = 'שוק קר ❄️';
    color = '#3b82f6'; // blue
  } else if (heatScore <= 45) {
    status = 'cooling';
    label = 'Cooling Down ↘️';
    labelHe = 'מתקרר ↘️';
    color = '#06b6d4'; // cyan
  }
  
  return {
    score: parseFloat(heatScore.toFixed(0)),
    status,
    label,
    labelHe,
    color
  };
}

/**
 * יצירת המלצת קנייה
 * 
 * @param {Object} trends - מגמות
 * @param {number} currentPrice - מחיר נוכחי
 * @param {Array} marketAverage - ממוצע שוק
 * @returns {Object} המלצה
 */
function generateBuyingAdvice(trends, currentPrice, marketAverage) {
  const { direction, strength, vsMarket, currentMovingAvg7 } = trends;
  const marketAvgPrice = marketAverage[marketAverage.length - 1]?.price || currentPrice;
  
  const advice = {
    action: 'neutral',
    actionHe: 'neutral',
    message: '',
    messageHe: '',
    confidence: 50,
    icon: '🤔'
  };
  
  // מחיר נמוך מהממוצע
  if (vsMarket < -10) {
    advice.action = 'buy';
    advice.actionHe = 'buy';
    advice.message = `Great time to buy: ${Math.abs(vsMarket).toFixed(0)}% below market average`;
    advice.messageHe = `זמן מעולה לקנות: ${Math.abs(vsMarket).toFixed(0)}% מתחת לממוצע השוק`;
    advice.confidence = 75;
    advice.icon = '🎉';
  }
  // מגמת ירידה חזקה
  else if (direction === 'falling' && strength > 40) {
    advice.action = 'wait';
    advice.actionHe = 'wait';
    advice.message = 'Wait: Prices are trending downward';
    advice.messageHe = 'המתן: מחירים במגמת ירידה';
    advice.confidence = 65;
    advice.icon = '⏳';
  }
  // מחיר גבוה מהממוצע
  else if (vsMarket > 15) {
    advice.action = 'wait';
    advice.actionHe = 'wait';
    advice.message = 'Price is above market average - consider waiting';
    advice.messageHe = 'מחיר מעל ממוצע השוק - שקלו להמתין';
    advice.confidence = 60;
    advice.icon = '⚠️';
  }
  // מגמת עלייה
  else if (direction === 'rising' && strength > 30) {
    advice.action = 'buy';
    advice.actionHe = 'buy';
    advice.message = 'Buy now: Prices are trending upward';
    advice.messageHe = 'קנו עכשיו: מחירים במגמת עלייה';
    advice.confidence = 70;
    advice.icon = '📈';
  }
  // יציב
  else {
    advice.action = 'neutral';
    advice.actionHe = 'neutral';
    advice.message = 'Fair price - similar to market average';
    advice.messageHe = 'מחיר הוגן - דומה לממוצע השוק';
    advice.confidence = 50;
    advice.icon = '✓';
  }
  
  return advice;
}

/**
 * הכנת נתונים לגרף recharts
 * 
 * @param {Object} trendData - נתוני מגמה
 * @returns {Array} נתונים מוכנים לגרף
 */
export function prepareChartData(trendData) {
  if (!trendData) return [];
  
  const { currentProduct, marketAverage } = trendData;
  const chartData = [];
  
  // יצירת מפה של תאריכים
  const allDates = new Set([
    ...currentProduct.history.map(h => h.date),
    ...marketAverage.map(m => m.date)
  ]);
  
  // מיון תאריכים
  const sortedDates = Array.from(allDates).sort();
  
  // יצירת נקודות נתונים
  sortedDates.forEach(date => {
    const currentData = currentProduct.history.find(h => h.date === date);
    const marketData = marketAverage.find(m => m.date === date);
    
    const point = {
      date: date,
      day: new Date(date).getDate(),
      // המרת תאריך לפורמט קריא
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
    
    if (currentData) {
      point.productPrice = currentData.price;
    }
    
    if (marketData) {
      point.marketAverage = marketData.price;
    }
    
    chartData.push(point);
  });
  
  return chartData;
}

// ============================================================
// Currency Exchange & Bank Fees
// מטבעות, המרה ועמלות בנק
// ============================================================

// מטבעות נתמכים
export const SUPPORTED_CURRENCIES = {
  'USD': { code: 'USD', symbol: '$', name: 'US Dollar', nameHe: 'דולר אמריקאי' },
  'ILS': { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', nameHe: 'שקל ישראלי' },
  'EUR': { code: 'EUR', symbol: '€', name: 'Euro', nameHe: 'יורו' },
  'GBP': { code: 'GBP', symbol: '£', name: 'British Pound', nameHe: 'לירה שטרלינג' },
  'CAD': { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', nameHe: 'דולר קנדי' },
  'AUD': { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', nameHe: 'דולר אוסטרלי' },
  'CNY': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', nameHe: 'יואן סיני' }
};

// מטבע ברירת מחדל
export const DEFAULT_CURRENCY = {
  code: 'ILS',
  bankFee: 2.5 // אחוז עמלת ברירת מחדל
};

/**
 * טעינת הגדרות מטבע
 * @returns {Promise<Object>} הגדרות מטבע
 */
export async function loadCurrencySettings() {
  try {
    const result = await chrome.storage.local.get(['CURRENCY_SETTINGS']);
    return {
      ...DEFAULT_CURRENCY,
      ...(result.CURRENCY_SETTINGS || {})
    };
  } catch (error) {
    console.error('[AliSmart] Failed to load currency settings:', error);
    return { ...DEFAULT_CURRENCY };
  }
}

/**
 * שמירת הגדרות מטבע
 * @param {Object} settings - הגדרות מטבע
 */
export async function saveCurrencySettings(settings) {
  try {
    await chrome.storage.local.set({ CURRENCY_SETTINGS: settings });
  } catch (error) {
    console.error('[AliSmart] Failed to save currency settings:', error);
  }
}

/**
 * קבלת שערי חליפין עם caching
 * משתמש ב-ExchangeRate-API (חינמי, ללא key)
 * 
 * @returns {Promise<Object>} שערי חליפין
 */
export async function getExchangeRates() {
  try {
    // בדיקה אם יש נתונים בתוקף (24 שעות)
    const cached = await chrome.storage.local.get(['EXCHANGE_RATES', 'EXCHANGE_RATES_TIMESTAMP']);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (cached.EXCHANGE_RATES && cached.EXCHANGE_RATES_TIMESTAMP) {
      const age = now - cached.EXCHANGE_RATES_TIMESTAMP;
      if (age < oneDay) {
        console.log('[AliSmart] Using cached exchange rates');
        return cached.EXCHANGE_RATES;
      }
    }
    
    // קבלת שערים חדשים מה-API
    console.log('[AliSmart] Fetching fresh exchange rates');
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // שמירה ב-cache
    await chrome.storage.local.set({
      EXCHANGE_RATES: data,
      EXCHANGE_RATES_TIMESTAMP: now
    });
    
    return data;
  } catch (error) {
    console.error('[AliSmart] Failed to fetch exchange rates:', error);
    
    // Fallback: שערים קבועים
    return {
      base: 'USD',
      date: new Date().toISOString().split('T')[0],
      rates: {
        'ILS': 3.65,
        'EUR': 0.92,
        'GBP': 0.79,
        'CAD': 1.36,
        'AUD': 1.52,
        'CNY': 7.24,
        'USD': 1
      }
    };
  }
}

/**
 * חישוב מחיר כולל המרה ועמלה
 * 
 * @param {Object} params - פרמטרים
 * @param {number} params.usdPrice - מחיר בדולרים
 * @param {string} params.targetCurrency - מטבע יעד
 * @param {number} params.bankFeePercent - אחוז עמלת בנק
 * @param {Object} params.exchangeRates - שערי חליפין
 * @returns {Object} תוצאת חישוב
 */
export function calculatePriceWithFees({
  usdPrice = 0,
  targetCurrency = 'ILS',
  bankFeePercent = 2.5,
  exchangeRates = null
}) {
  if (!usdPrice || usdPrice <= 0) {
    return {
      originalPrice: 0,
      convertedPrice: 0,
      bankFee: 0,
      finalPrice: 0,
      exchangeRate: 0,
      currency: targetCurrency
    };
  }
  
  const rate = exchangeRates?.rates?.[targetCurrency] || 1;
  
  // המרת מטבע
  const convertedPrice = usdPrice * rate;
  
  // חישוב עמלת בנק
  const bankFeeAmount = convertedPrice * (bankFeePercent / 100);
  
  // מחיר סופי כולל עמלה
  const finalPrice = convertedPrice + bankFeeAmount;
  
  return {
    originalPrice: usdPrice,
    convertedPrice: parseFloat(convertedPrice.toFixed(2)),
    bankFee: parseFloat(bankFeeAmount.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2)),
    exchangeRate: rate,
    bankFeePercent: bankFeePercent,
    currency: targetCurrency
  };
}

/**
 * פורמט מחיר עם סימול מטבע
 * 
 * @param {number} amount - סכום
 * @param {string} currencyCode - קוד מטבע
 * @returns {string} מחיר מעוצב
 */
export function formatPriceWithCurrency(amount, currencyCode) {
  const currency = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES['USD'];
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  
  // מיקום סימול המטבע (לפני או אחרי)
  if (currencyCode === 'ILS') {
    return `${currency.symbol}${formatted}`;
  }
  
  return `${currency.symbol}${formatted}`;
}

/**
 * חישוב והמרת מחיר מוצר לשקלים
 * פונקציה מרכזית לשימוש ברכיבים
 * 
 * @param {Object} product - מוצר עם מחיר
 * @param {Object} currencySettings - הגדרות מטבע
 * @returns {Promise<Object>} מחיר מומר
 */
export async function convertProductPrice(product, currencySettings = null) {
  try {
    const settings = currencySettings || await loadCurrencySettings();
    const rates = await getExchangeRates();
    
    // חילוץ מחיר USD
    const usdPrice = parseFloat(
      product?.priceValue || 
      product?.price || 
      product?.target_sale_price || 
      0
    );
    
    if (settings.code === 'USD' || !usdPrice) {
      return {
        displayPrice: `$${usdPrice.toFixed(2)}`,
        localPrice: null,
        hasConversion: false
      };
    }
    
    const calculation = calculatePriceWithFees({
      usdPrice,
      targetCurrency: settings.code,
      bankFeePercent: settings.bankFee,
      exchangeRates: rates
    });
    
    const currency = SUPPORTED_CURRENCIES[settings.code];
    
    return {
      displayPrice: `$${usdPrice.toFixed(2)}`,
      localPrice: {
        amount: calculation.finalPrice,
        formatted: `${currency.symbol}${calculation.finalPrice.toFixed(2)}`,
        currency: settings.code,
        currencyName: currency.name,
        bankFee: calculation.bankFee,
        bankFeePercent: settings.bankFee,
        exchangeRate: calculation.exchangeRate
      },
      hasConversion: true
    };
  } catch (error) {
    console.error('[AliSmart] Failed to convert product price:', error);
    return {
      displayPrice: `$${(product?.priceValue || 0).toFixed(2)}`,
      localPrice: null,
      hasConversion: false
    };
  }
}

// ============================================================
// Competitive Matrix API
// מנוע מטריצת השוואת מתחרים
// ============================================================

/**
 * מושג מטריצת מתחרים מקיפה למוצר
 * משלב חיפוש ויזואלי, טקסטואלי, ודירוג לפי Golden Score
 * 
 * @param {Object} sourceProduct - מוצר מקור לשימוש כבסיס השוואה
 * @param {Object} options - אפשרויות סינון
 * @returns {Promise<Object>} מטריצת מתחרים עם דירוג
 */
export async function getCompetitiveMatrix(sourceProduct, options = {}) {
  if (!sourceProduct) {
    return { success: false, error: 'No source product provided', competitors: [] };
  }

  console.log('[AliSmart] Building competitive matrix for:', sourceProduct.title?.substring(0, 50));

  try {
    // הרצת חיפושים במקביל לכיסוי מקסימלי
    const [visualResults, textResults, categoryResults] = await Promise.all([
      // חיפוש ויזואלי
      sourceProduct.imageUrl ? 
        performVisualSearch(sourceProduct.imageUrl).catch(err => {
          console.log('[AliSmart] Visual search in matrix failed:', err.message);
          return [];
        }) : Promise.resolve([]),
      
      // חיפוש טקסטואלי
      performTextSearch(sourceProduct.title).catch(err => {
        console.log('[AliSmart] Text search in matrix failed:', err.message);
        return [];
      }),
      
      // חיפוש לפי קטגוריה (אם זמין)
      sourceProduct.categoryId ? 
        searchByCategory(sourceProduct.categoryId, sourceProduct.keywords).catch(err => {
          console.log('[AliSmart] Category search failed:', err.message);
          return [];
        }) : Promise.resolve([])
    ]);

    // מיזוג וסינון כפילויות
    const allResults = [...visualResults, ...textResults, ...categoryResults];
    const uniqueCompetitors = mergeAndDeduplicate(allResults, sourceProduct.productId);
    
    console.log('[AliSmart] Matrix sources:', {
      visual: visualResults.length,
      text: textResults.length,
      category: categoryResults.length,
      unique: uniqueCompetitors.length
    });

    // דירוג וסינון לפי קריטריונים
    const rankedCompetitors = rankCompetitors(uniqueCompetitors, sourceProduct, options);
    
    // החזרת 5 המתחרים הטובים ביותר
    const topCompetitors = rankedCompetitors.slice(0, 5);

    return {
      success: true,
      sourceProduct,
      competitors: topCompetitors,
      totalFound: uniqueCompetitors.length,
      searchSources: {
        visual: visualResults.length > 0,
        text: textResults.length > 0,
        category: categoryResults.length > 0
      }
    };

  } catch (error) {
    console.error('[AliSmart] Competitive matrix error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to build competitive matrix',
      competitors: [] 
    };
  }
}

/**
 * מיזוג תוצאות והסרת כפילויות
 * @param {Array} results - תוצאות ממקורות שונים
 * @param {string} excludeId - ID למעט מכלל
 * @returns {Array} תוצאות ייחודיות
 */
function mergeAndDeduplicate(results, excludeId) {
  const seen = new Set();
  const unique = [];
  
  for (const product of results) {
    const id = product.productId || product.id;
    
    // דילוג על המוצר המקורי
    if (id === excludeId) continue;
    
    // דילוג על כפילויות
    if (seen.has(id)) continue;
    seen.add(id);
    
    // דילוג על מוצרים ללא מחיר
    const price = extractPriceValue(product.price);
    if (price <= 0) continue;
    
    unique.push(product);
  }
  
  return unique;
}

/**
 * דירוג מתחרים לפי אלגוריתם Golden Score
 * @param {Array} competitors - מערך מתחרים
 * @param {Object} sourceProduct - מוצר מקור
 * @param {Object} options - אפשרויות סינון
 * @returns {Array} מתחרים מדורגים
 */
function rankCompetitors(competitors, sourceProduct, options = {}) {
  // חישוב ציונים
  const scored = competitors.map(competitor => {
    // חילוץ נתוני אמינות
    const sellerRating = parseFloat(competitor.sellerRating || competitor.storeRating || 0);
    const feedbackPercent = parseFloat(competitor.feedbackPercent || competitor.positiveFeedback || 0);
    const storeAge = parseFloat(competitor.storeAge || competitor.yearsActive || 0);
    const rating = parseFloat(competitor.rating || competitor.productRating || 0);
    
    // בדיקת עמידה בקריטריוני עילית
    const meetsElite = (
      rating >= 4.0 &&
      feedbackPercent >= 94 &&
      storeAge >= 1
    );
    
    // דילוג על לא-עילית אם נדרש
    if (options.eliteOnly && !meetsElite) {
      return null;
    }
    
    // חישוב Golden Score
    const score = calculateMatrixScore(competitor, sourceProduct);
    
    return {
      ...competitor,
      score,
      meetsElite,
      sellerRating,
      feedbackPercent,
      storeAge,
      rating
    };
  }).filter(Boolean); // הסרת nullים
  
  // מיון לפי ציון יורד
  return scored.sort((a, b) => b.score.total - a.score.total);
}

/**
 * חישוב ציון Golden Score למטריצה
 * @param {Object} product - מוצר מתחרה
 * @param {Object} sourceProduct - מוצר מקור
 * @returns {Object} פירוט הציון
 */
function calculateMatrixScore(product, sourceProduct) {
  const scores = {
    price: 0,
    reliability: 0,
    shipping: 0,
    trust: 0
  };
  
  // 1. Price Score (40%)
  const productPrice = extractPriceValue(product.price);
  const sourcePrice = extractPriceValue(sourceProduct?.price);
  
  if (sourcePrice > 0) {
    const ratio = productPrice / sourcePrice;
    if (ratio <= 0.5) scores.price = 40;
    else if (ratio <= 0.7) scores.price = 35;
    else if (ratio <= 0.9) scores.price = 30;
    else if (ratio <= 1.0) scores.price = 25;
    else if (ratio <= 1.2) scores.price = 15;
    else scores.price = 5;
  } else {
    scores.price = productPrice < 20 ? 30 : productPrice < 50 ? 25 : 20;
  }
  
  // 2. Reliability Score (30%)
  const sellerRating = parseFloat(product.sellerRating || product.storeRating || 0);
  const feedbackPercent = parseFloat(product.feedbackPercent || product.positiveFeedback || 0);
  
  if (sellerRating >= 4.9) scores.reliability += 15;
  else if (sellerRating >= 4.8) scores.reliability += 13;
  else if (sellerRating >= 4.7) scores.reliability += 11;
  else if (sellerRating >= 4.5) scores.reliability += 9;
  else scores.reliability += 5;
  
  if (feedbackPercent >= 98) scores.reliability += 10;
  else if (feedbackPercent >= 95) scores.reliability += 8;
  else if (feedbackPercent >= 94) scores.reliability += 6;
  else if (feedbackPercent >= 90) scores.reliability += 4;
  else scores.reliability += 2;
  
  // 3. Shipping Score (20%)
  const shippingType = detectShippingType(product.shipping);
  const shippingScores = {
    'express': 20,
    'aliexpress_standard': 18,
    'standard': 15,
    'free': 12,
    'unknown': 10,
    'slow': 5
  };
  scores.shipping = shippingScores[shippingType] || 10;
  
  // בונוס למשלוח חינם
  if (product.freeShipping || product.shippingCost === 0) {
    scores.shipping += 2;
  }
  
  // 4. Trust Score (10%)
  if (product.isChoice || product.choiceProduct) scores.trust = 10;
  else if (product.buyerProtection) scores.trust = 7;
  else scores.trust = 5;
  
  const total = scores.price + scores.reliability + scores.shipping + scores.trust;
  
  // יצירת תגיות
  const badges = [];
  if (scores.price >= 35) badges.push({ type: 'cheapest', label: 'Cheapest', priority: 1 });
  if (scores.shipping >= 18) badges.push({ type: 'fastest', label: 'Fastest', priority: 1 });
  if (scores.reliability >= 23) badges.push({ type: 'trusted', label: 'Most Trusted', priority: 1 });
  if (product.freeShipping) badges.push({ type: 'free_shipping', label: 'Free Shipping', priority: 2 });
  if (product.isChoice) badges.push({ type: 'choice', label: 'Choice', priority: 2 });
  
  return {
    total,
    scores,
    badges: badges.sort((a, b) => a.priority - b.priority)
  };
}

/**
 * חילוץ ערך מחיר
 * @param {string|number} price
 * @returns {number}
 */
function extractPriceValue(price) {
  if (typeof price === 'number') return price;
  if (!price) return 0;
  const match = String(price).match(/[\d,.]+/);
  return match ? parseFloat(match[0].replace(',', '')) || 0 : 0;
}

/**
 * זיהוי סוג משלוח
 * @param {string} shipping
 * @returns {string}
 */
function detectShippingType(shipping) {
  if (!shipping) return 'unknown';
  const desc = String(shipping).toLowerCase();
  
  if (desc.includes('dhl') || desc.includes('fedex')) return 'express';
  if (desc.includes('aliexpress') && desc.includes('standard')) return 'aliexpress_standard';
  if (desc.includes('free')) return 'free';
  if (desc.includes('standard')) return 'standard';
  return 'unknown';
}

/**
 * חיפוש לפי קטגוריה
 * @param {string} categoryId
 * @param {Array} keywords
 * @returns {Promise<Array>}
 */
async function searchByCategory(categoryId, keywords = []) {
  if (!categoryId) return [];
  
  try {
    // ניתן להרחיב בעתיד לחיפוש API אמיתי לפי קטגוריה
    console.log('[AliSmart] Category search for:', categoryId);
    return [];
  } catch (error) {
    console.log('[AliSmart] Category search error:', error.message);
    return [];
  }
}

/**
 * חיפוש וואוצ'רים נסתרים של חנות
 * סורק את ה-API של AliExpress למציאת קופונים שלא מוצגים בדף
 * 
 * @param {string} storeId - מזהה החנות (seller ID)
 * @param {string} productId - מזהה המוצר (אופציונלי)
 * @returns {Promise<Object>} רשימת וואוצ'רים נסתרים
 */
export async function huntHiddenVouchers(storeId, productId = null) {
  if (!storeId) {
    return { success: false, error: 'No store ID provided', vouchers: [] };
  }

  console.log('[AliSmart VoucherSniper] Hunting hidden vouchers for store:', storeId);

  const vouchers = {
    follower: [],      // קופוני עוקבים
    threshold: [],     // קופוני סף
    cashback: [],      // קודי קאשבק
    platform: [],      // קופוני פלטפורמה
    combo: []          // שילובים אפשריים
  };

  try {
    // === 1. סריקת קופוני חנות (Store Coupons) ===
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200)); // Jitter 200-500ms
    
    try {
      const storeCouponUrl = `https://www.aliexpress.com/store/promotion/coupon.html?sellerAdminSeq=${storeId}`;
      
      // ניסיון לקבל קופונים דרך background script
      const storeResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'fetchStoreCoupons',
          storeId: storeId,
          url: storeCouponUrl
        }, resolve);
      });

      if (storeResponse?.success && storeResponse.coupons) {
        storeResponse.coupons.forEach(coupon => {
          if (coupon.type === 'FOLLOWER') {
            vouchers.follower.push({
              code: coupon.code,
              amount: parseFloat(coupon.amount) || 0,
              minOrder: parseFloat(coupon.minOrder) || 0,
              type: 'follower',
              expiry: coupon.expiryDate,
              source: 'store_api'
            });
          } else if (coupon.type === 'THRESHOLD') {
            vouchers.threshold.push({
              code: coupon.code,
              amount: parseFloat(coupon.amount) || 0,
              minOrder: parseFloat(coupon.minOrder) || 0,
              type: 'threshold',
              expiry: coupon.expiryDate,
              source: 'store_api'
            });
          }
        });
      }
    } catch (e) {
      console.log('[AliSmart VoucherSniper] Store coupon fetch failed:', e.message);
    }

    // === 2. סריקת קופוני AliExpress Platform ===
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200)); // Jitter נוסף
    
    try {
      const platformResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'fetchPlatformCoupons'
        }, resolve);
      });

      if (platformResponse?.success && platformResponse.coupons) {
        platformResponse.coupons.forEach(coupon => {
          vouchers.platform.push({
            code: coupon.code,
            amount: parseFloat(coupon.amount) || 0,
            minOrder: parseFloat(coupon.minOrder) || 0,
            type: 'platform',
            expiry: coupon.expiryDate,
            category: coupon.category,
            source: 'platform_api'
          });
        });
      }
    } catch (e) {
      console.log('[AliSmart VoucherSniper] Platform coupon fetch failed:', e.message);
    }

    // === 3. סריקת קודי קאשבק ===
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
    
    // קודי קאשבק נפוצים שאולי עדיין בתוקף
    const commonCashbackCodes = [
      { code: 'CBACK5', amount: 5, minOrder: 50 },
      { code: 'CBACK10', amount: 10, minOrder: 100 },
      { code: 'SAVE5', amount: 5, minOrder: 30 },
      { code: 'BONUS8', amount: 8, minOrder: 80 },
      { code: 'EXTRA15', amount: 15, minOrder: 150 }
    ];

    // סימולציה של בדיקת תוקף - בפועל היינו בודקים מול שרת
    vouchers.cashback = commonCashbackCodes.map(cb => ({
      code: cb.code,
      amount: cb.amount,
      minOrder: cb.minOrder,
      type: 'cashback',
      expiry: null, // לא ידוע
      source: 'predicted',
      confidence: 'medium'
    }));

    // === 4. חישוב שילובים אופטימליים ===
    vouchers.combo = calculateOptimalCombos(vouchers);

    console.log('[AliSmart VoucherSniper] Hunt complete:', {
      follower: vouchers.follower.length,
      threshold: vouchers.threshold.length,
      platform: vouchers.platform.length,
      cashback: vouchers.cashback.length,
      combos: vouchers.combo.length
    });

    return {
      success: true,
      storeId,
      productId,
      vouchers,
      totalFound: vouchers.follower.length + vouchers.threshold.length + 
                   vouchers.platform.length + vouchers.cashback.length,
      bestCombo: vouchers.combo[0] || null
    };

  } catch (error) {
    console.error('[AliSmart VoucherSniper] Hunt failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to hunt vouchers',
      storeId,
      productId,
      vouchers
    };
  }
}

/**
 * חישוב שילובי קופונים אופטימליים (The Golden Combo)
 * @param {Object} vouchers - אובייקט עם כל סוגי הקופונים
 * @param {number} cartTotal - סכום העגלה (אופציונלי)
 * @returns {Array} שילובים מדורגים
 */
function calculateOptimalCombos(vouchers, cartTotal = null) {
  const combos = [];
  const allVouchers = [
    ...vouchers.follower,
    ...vouchers.threshold,
    ...vouchers.platform,
    ...vouchers.cashback
  ];

  // חישוב שילובים אפשריים
  for (let i = 0; i < allVouchers.length; i++) {
    for (let j = i + 1; j < allVouchers.length; j++) {
      const v1 = allVouchers[i];
      const v2 = allVouchers[j];

      // בדיקת אפשרות שילוב (לוגיקה בסיסית)
      const canStack = checkStackability(v1, v2);
      
      if (canStack) {
        const totalSavings = v1.amount + v2.amount;
        const totalMinOrder = Math.max(v1.minOrder, v2.minOrder);

        combos.push({
          vouchers: [v1, v2],
          totalSavings,
          totalMinOrder,
          efficiency: cartTotal ? (totalSavings / cartTotal) * 100 : 0,
          type: `${v1.type}+${v2.type}`
        });
      }
    }
  }

  // מיון לפי חיסכון יורד
  return combos.sort((a, b) => b.totalSavings - a.totalSavings);
}

/**
 * בדיקת אפשרות שילוב בין שני קופונים
 * @param {Object} v1 - קופון ראשון
 * @param {Object} v2 - קופון שני
 * @returns {boolean}
 */
function checkStackability(v1, v2) {
  // חוקי AliExpress:
  // 1. קופון פלטפורמה + קופון חנות = מותר
  // 2. שני קופוני חנות = אסור
  // 3. קופון קאשבק + אחר = תלוי
  
  if (v1.type === 'platform' && (v2.type === 'follower' || v2.type === 'threshold')) return true;
  if (v2.type === 'platform' && (v1.type === 'follower' || v1.type === 'threshold')) return true;
  if (v1.type === 'cashback' || v2.type === 'cashback') return true; // בדיקה בפועל ב-checkout
  
  return false;
}

/**
 * בדיקת תוקף קופון מול שרת AliExpress
 * @param {string} code - קוד הקופון
 * @param {string} productId - מזהה מוצר
 * @returns {Promise<Object>} תוצאת הבדיקה
 */
export async function validateVoucher(code, productId = null) {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'validateVoucher',
        code: code,
        productId: productId
      }, resolve);
    });

    return response || { valid: false, error: 'No response' };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * מציאת הקופון הטוב ביותר לעגלה נוכחית
 * @param {Array} vouchers - רשימת קופונים זמינים
 * @param {number} cartTotal - סכום העגלה
 * @returns {Object|null} הקופון הטוב ביותר
 */
export function findBestVoucher(vouchers, cartTotal) {
  if (!vouchers || !cartTotal) return null;

  const eligible = vouchers.filter(v => v.minOrder <= cartTotal);
  if (eligible.length === 0) return null;

  // מיון לפי חיסכון יורד
  return eligible.sort((a, b) => b.amount - a.amount)[0];
}

/**
 * בדיקת וואוצ'רים על ידי brute-force ב-checkout
 * @param {Array} voucherCodes - רשימת קודים לבדיקה
 * @param {string} checkoutUrl - URL של עמוד התשלום
 * @returns {Promise<Object>} תוצאות הבדיקה
 */
export async function bruteForceVouchersAtCheckout(voucherCodes, checkoutUrl) {
  const results = {
    tested: [],
    successful: [],
    bestSavings: 0,
    bestCode: null
  };

  console.log('[AliSmart VoucherSniper] Starting brute-force with', voucherCodes.length, 'codes');

  for (const code of voucherCodes) {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300)); // Jitter
      
      const result = await tryApplyVoucher(code, checkoutUrl);
      
      results.tested.push({
        code: code,
        success: result.success,
        savings: result.savings || 0,
        error: result.error || null
      });

      if (result.success && result.savings > 0) {
        results.successful.push({
          code: code,
          savings: result.savings,
          message: result.message
        });

        if (result.savings > results.bestSavings) {
          results.bestSavings = result.savings;
          results.bestCode = code;
        }
      }
    } catch (e) {
      console.log('[AliSmart VoucherSniper] Code test failed:', code, e.message);
    }
  }

  console.log('[AliSmart VoucherSniper] Brute-force complete:', {
    tested: results.tested.length,
    successful: results.successful.length,
    bestSavings: results.bestSavings
  });

  return results;
}

/**
 * ניסיון להחיל קופון ספציפי
 * @param {string} code - קוד הקופון
 * @param {string} checkoutUrl - URL התשלום
 * @returns {Promise<Object>} תוצאה
 */
async function tryApplyVoucher(code, checkoutUrl) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'applyVoucherAtCheckout',
      code: code,
      checkoutUrl: checkoutUrl
    }, (response) => {
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

/**
 * Seller Integrity Analysis
 * Fetches comprehensive seller data for risk assessment
 * @param {string} storeId - Store/seller ID
 * @returns {Promise<Object>} Seller integrity analysis
 */
export async function analyzeSellerIntegrity(storeId) {
  if (!storeId) {
    return { success: false, error: 'No store ID provided' };
  }

  console.log('[AliSmart Radar] Analyzing seller integrity for store:', storeId);

  try {
    // Fetch seller data from background script
    const sellerData = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'fetchSellerData',
        storeId: storeId
      }, resolve);
    });

    if (!sellerData || !sellerData.success) {
      throw new Error(sellerData?.error || 'Failed to fetch seller data');
    }

    // Fetch historical data
    const historicalData = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'fetchSellerHistory',
        storeId: storeId
      }, resolve);
    });

    // Import risk engine and run analysis
    const { analyzeSellerIntegrity: runAnalysis } = await import('../utils/risk-engine.js');
    const analysis = runAnalysis(sellerData.data, historicalData?.data || {});

    return {
      success: true,
      storeId,
      analysis
    };

  } catch (error) {
    console.error('[AliSmart Radar] Seller analysis failed:', error);
    return {
      success: false,
      error: error.message || 'Analysis failed',
      storeId
    };
  }
}

console.log('🚀 AliSmart: API Services Loaded');

// ============================================================
// Smart Wishlist API
// Cloud-synced wishlist with collections and price alerts
// ============================================================

/**
 * Adds a product to the wishlist
 * @param {Object} product - Product to add
 * @param {string} collectionId - Target collection ID
 * @returns {Promise<Object>} Result
 */
export async function addToWishlist(product, collectionId = 'default') {
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'addToWishlist',
      product: {
        productId: product.productId || product.id,
        title: product.title,
        price: product.price,
        priceValue: product.priceValue,
        imageUrl: product.imageUrl || product.image,
        storeId: product.storeId,
        storeName: product.storeName
      },
      collectionId
    });
    
    return result || { success: false, error: 'No response' };
  } catch (error) {
    console.error('[AliSmart API] Add to wishlist failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Removes an item from the wishlist
 * @param {string} itemId - Item ID to remove
 * @returns {Promise<Object>} Result
 */
export async function removeFromWishlist(itemId) {
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'removeFromWishlist',
      itemId
    });
    
    return result || { success: false, error: 'No response' };
  } catch (error) {
    console.error('[AliSmart API] Remove from wishlist failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets all wishlist items
 * @returns {Promise<Array>} Wishlist items
 */
export async function getWishlist() {
  try {
    const result = await chrome.storage.local.get('alismart_wishlist_items');
    return result.alismart_wishlist_items || [];
  } catch (error) {
    console.error('[AliSmart API] Get wishlist failed:', error);
    return [];
  }
}

/**
 * Creates a new collection
 * @param {string} name - Collection name
 * @param {string} color - Optional color
 * @returns {Promise<Object>} Created collection
 */
export async function createCollection(name, color = '#ff6a00') {
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'createWishlistCollection',
      name,
      color
    });
    
    return result || { success: false, error: 'No response' };
  } catch (error) {
    console.error('[AliSmart API] Create collection failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets all collections
 * @returns {Promise<Array>} Collections
 */
export async function getCollections() {
  try {
    const result = await chrome.storage.local.get('alismart_wishlist_collections');
    return result.alismart_wishlist_collections || [
      { id: 'default', name: 'All Items', color: '#ff6a00', itemCount: 0 }
    ];
  } catch (error) {
    console.error('[AliSmart API] Get collections failed:', error);
    return [];
  }
}
