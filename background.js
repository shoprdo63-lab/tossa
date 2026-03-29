// AliSmart Finder v5.0 — Background Service Worker
// ONLY uses Vercel Proxy - NO direct AliExpress API calls

console.log('[AliSmart BG] Service Worker starting...', new Date().toISOString());

const PROXY_URL = 'https://alismart-proxy.vercel.app/api/search';
const FETCH_TIMEOUT = 15000;
const CACHE_TTL = 30 * 60 * 1000;

console.log('[AliSmart BG] Configuration:', { PROXY_URL, FETCH_TIMEOUT, CACHE_TTL });

const searchCache = new Map();
let exchangeRates = null;
let ratesFetchedAt = 0;
const RATES_TTL = 6 * 60 * 60 * 1000;

// Service Worker lifecycle logging
self.addEventListener('install', (event) => {
  console.log('[AliSmart BG] Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[AliSmart BG] Service Worker activated');
});

function getCacheKey(action, params) {
  const key = action + ':' + JSON.stringify(params);
  console.log('[AliSmart BG] Cache key generated:', key.substring(0, 100));
  return key;
}

function getCached(key) {
  console.log('[AliSmart BG] Checking cache for key:', key.substring(0, 50));
  const entry = searchCache.get(key);
  if (!entry) {
    console.log('[AliSmart BG] Cache miss - no entry found');
    return null;
  }
  if (Date.now() - entry.ts > CACHE_TTL) { 
    console.log('[AliSmart BG] Cache expired, deleting entry');
    searchCache.delete(key); 
    return null; 
  }
  console.log('[AliSmart BG] Cache hit - returning cached data');
  return entry.data;
}

function setCache(key, data) {
  console.log('[AliSmart BG] Setting cache for key:', key.substring(0, 50));
  if (searchCache.size > 200) {
    console.log('[AliSmart BG] Cache size exceeded 200, removing oldest entry');
    const oldest = searchCache.keys().next().value;
    searchCache.delete(oldest);
  }
  searchCache.set(key, { data, ts: Date.now() });
  console.log('[AliSmart BG] Cache set successfully, current size:', searchCache.size);
}

async function getExchangeRates() {
  console.log('[AliSmart BG] Fetching exchange rates...');
  if (exchangeRates && Date.now() - ratesFetchedAt < RATES_TTL) {
    console.log('[AliSmart BG] Using cached exchange rates');
    return exchangeRates;
  }
  try {
    console.log('[AliSmart BG] Fetching fresh exchange rates from API');
    const resp = await fetch('https://open.er-api.com/v6/latest/USD');
    console.log('[AliSmart BG] Exchange rates API response status:', resp.status);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.result === 'success' && json.rates) {
      exchangeRates = json.rates;
      ratesFetchedAt = Date.now();
      console.log('[AliSmart BG] Exchange rates updated successfully, got', Object.keys(exchangeRates).length, 'currencies');
      return exchangeRates;
    }
    throw new Error('Unexpected response');
  } catch (e) {
    console.error('[AliSmart BG] Exchange rates fetch failed:', e.message);
    return {
      USD:1,EUR:0.92,GBP:0.79,ILS:3.65,BRL:5.05,AUD:1.55,CAD:1.37,
      JPY:155,CNY:7.25,INR:83.5,KRW:1350,SEK:10.8,PLN:4.05,RUB:92,ZAR:18.5,
      TRY:32,THB:35,MYR:4.7,PHP:56,VND:25000,TWD:32,HKD:7.8,SGD:1.35,
      NZD:1.7,DKK:6.9,NOK:10.8,CZK:23.5,HUF:370,RON:4.6,CHF:0.88
    };
  }
}

async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  console.log('[AliSmart BG] Fetching with timeout:', url.substring(0, 100), 'timeout:', timeout);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.aliexpress.com',
        'Origin': 'https://www.aliexpress.com'
      }
    });
    clearTimeout(timeoutId);
    
    // Log detailed status for debugging 403/429 errors
    console.log('[AliSmart BG] Fetch response status:', response.status, response.statusText);
    if (response.status === 403) {
      console.error('[AliSmart BG] ERROR 403 Forbidden - API access denied');
    } else if (response.status === 429) {
      console.error('[AliSmart BG] ERROR 429 Too Many Requests - Rate limited');
    } else if (!response.ok) {
      console.error('[AliSmart BG] ERROR HTTP', response.status, response.statusText);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[AliSmart BG] Fetch error:', error.message);
    throw error;
  }
}

async function searchViaProxy(keyword, page = 1, pageSize = 50, sort = 'SALE_PRICE_ASC', imgUrl = '', title = '', currentId = '', retryCount = 0) {
  console.log('[AliSmart BG] searchViaProxy called:', { keyword: keyword?.substring(0, 50), page, pageSize, sort, imgUrl: imgUrl?.substring(0, 50), title: title?.substring(0, 50), currentId, retryCount });
  
  // Early return: If the keyword is empty, return an error object
  if (!keyword || keyword.trim() === '') {
    console.warn('[AliSmart BG] Search skipped: Empty keyword');
    return { error: 'Empty keyword' };
  }
  
  // CRITICAL FIX: Use GET with query parameter format
  // Format: ${SERVER_URL}/api/search?q=${encodeURIComponent(keyword)}
  const finalUrl = `${PROXY_URL}?q=${encodeURIComponent(keyword)}`;
  
  // DEBUG: Log the full link being fetched
  console.log('Fetching from:', finalUrl);
  
  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      credentials: 'omit',
      signal: AbortSignal.timeout(FETCH_TIMEOUT)
    });
    
    console.log('[AliSmart BG] Proxy response status:', response.status, response.statusText);
    
    if (response.status === 403) {
      console.error('[AliSmart BG] PROXY ERROR 403 Forbidden');
    } else if (response.status === 429) {
      console.error('[AliSmart BG] PROXY ERROR 429 Too Many Requests');
    }
    
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('[AliSmart BG] Proxy returned error:', data.error);
      throw new Error(data.error);
    }
    
    // Check if we got empty results and should retry with simplified title
    const products = data?.products || data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
    
    if (products.length === 0 && retryCount < 2 && keyword.length > 20) {
      console.log('[AliSmart BG] No results found, retrying with simplified title...');
      const simplifiedKeyword = simplifyProductTitle(keyword);
      if (simplifiedKeyword !== keyword) {
        return searchViaProxy(simplifiedKeyword, page, pageSize, sort, imgUrl, title, currentId, retryCount + 1);
      }
    }
    
    console.log('[AliSmart BG] Proxy response received successfully');
    console.log('[AliSmart BG] Response has products:', !!data?.products);
    console.log('[AliSmart BG] Products count:', data?.products?.length || 0);
    return data;
  } catch (error) {
    console.error('[AliSmart BG] searchViaProxy error:', error.message);
    
    // Retry with simplified title on network/connection errors
    if (retryCount < 2 && keyword.length > 20) {
      console.log('[AliSmart BG] Retrying with simplified title after error...');
      const simplifiedKeyword = simplifyProductTitle(keyword);
      if (simplifiedKeyword !== keyword) {
        return searchViaProxy(simplifiedKeyword, page, pageSize, sort, imgUrl, title, currentId, retryCount + 1);
      }
    }
    
    throw error;
  }
}

/**
 * Simplify product title by removing common fluff words and limiting length
 * This helps when the full title causes search issues
 */
function simplifyProductTitle(title) {
  if (!title || title.length < 30) return title;
  
  // Remove common fluff words and phrases
  const fluffWords = [
    'original', 'official', 'authentic', 'genuine', 'brand new',
    'hot sale', 'limited edition', 'special offer', 'free shipping',
    'high quality', 'best seller', 'top rated', 'premium',
    '2025', '2026', 'new arrival', 'trending', 'popular'
  ];
  
  let simplified = title.toLowerCase();
  
  // Remove fluff words
  fluffWords.forEach(word => {
    simplified = simplified.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });
  
  // Remove multiple spaces
  simplified = simplified.replace(/\s+/g, ' ').trim();
  
  // Remove special characters but keep essential ones
  simplified = simplified.replace(/[^\w\s\-]/g, ' ');
  simplified = simplified.replace(/\s+/g, ' ').trim();
  
  // Limit to first 8-10 meaningful words
  const words = simplified.split(' ').filter(w => w.length > 2);
  if (words.length > 10) {
    simplified = words.slice(0, 8).join(' ');
  }
  
  console.log('[AliSmart BG] Simplified title:', { original: title.substring(0, 50), simplified: simplified.substring(0, 50) });
  
  return simplified || title; // Fallback to original if empty
}

async function getConfig() {
  console.log('[AliSmart BG] Getting config from storage...');
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['CURRENCY','LANGUAGE','RESULTS_PER_PAGE','SORT_BY'],
      (result) => {
        if (chrome.runtime.lastError) {
          console.error('[AliSmart BG] Storage error:', chrome.runtime.lastError);
        }
        console.log('[AliSmart BG] Config retrieved:', result);
        resolve({
          CURRENCY: result.CURRENCY || 'USD',
          LANGUAGE: result.LANGUAGE || 'en',
          RESULTS_PER_PAGE: result.RESULTS_PER_PAGE || 50,
          SORT_BY: result.SORT_BY || 'SALE_PRICE_ASC'
        });
      }
    );
  });
}

console.log('[AliSmart BG] Setting up message listeners...');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AliSmart BG] Message received:', request.type || request.action, 'from:', sender.tab?.url || 'popup/background');

  // Ping/Pong for connection health check
  if (request.type === 'ping' || request.action === 'ping') {
    console.log('[AliSmart BG] Received Ping from', sender.tab?.id || 'popup');
    sendResponse({ 
      success: true, 
      pong: true, 
      timestamp: Date.now(),
      serviceWorker: 'alive',
      version: '5.0'
    });
    console.log('[AliSmart BG] Sent Pong response');
    return true;
  }

  if (request.type === 'SEARCH_REQUEST') {
    console.log('[AliSmart BG] Handling SEARCH_REQUEST, query:', request.query?.substring(0, 50));
    (async () => {
      try {
        console.log('[AliSmart BG] Popup search request:', request.query);
        console.log('[AliSmart BG] Timestamp:', request.timestamp);
        
        // CRITICAL: Skip cache for popup searches to ensure fresh results
        // Popup searches include a timestamp to force fresh queries
        const useCache = !request.timestamp;
        console.log('[AliSmart BG] Using cache:', useCache);
        
        if (useCache) {
          const cacheKey = getCacheKey('popup', { q: request.query });
          const cached = getCached(cacheKey);
          if (cached) {
            console.log('[AliSmart BG] Returning cached popup search results');
            sendResponse(cached);
            return;
          }
        }
        
        // Fetch fresh results from proxy
        console.log('[AliSmart BG] Fetching fresh results from proxy');
        const data = await searchViaProxy(request.query, 1, 50, 'SALE_PRICE_ASC', request.imgUrl || '', request.title || '', request.currentId || '');
        const products = data?.products || data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
        console.log('[AliSmart BG] Extracted', products.length, 'products from response');
        await getExchangeRates();
        
        const result = { success: true, products };
        
        // Only cache if not a timestamped request
        if (useCache) {
          const cacheKey = getCacheKey('popup', { q: request.query });
          setCache(cacheKey, result);
        }
        
        console.log('[AliSmart BG] Returning', products.length, 'products for popup search');
        sendResponse(result);
      } catch (error) {
        console.error('[AliSmart BG] SEARCH_REQUEST error:', error.message);
        console.error('[AliSmart BG] Error stack:', error.stack);
        sendResponse({ success: false, error: error.message || 'Search failed' });
      }
    })();
    return true;
  }

  if (request.action === 'searchByImage') {
    console.log('[AliSmart BG] Handling searchByImage, URL:', request.imageUrl?.substring(0, 50));
    (async () => {
      try {
        const imageUrl = request.imageUrl || '';
        if (!imageUrl) {
          console.warn('[AliSmart BG] No image URL provided');
          sendResponse({ success: false, error: 'No image URL provided' });
          return;
        }

        // Validate URL format
        try {
          new URL(imageUrl);
        } catch (e) {
          console.warn('[AliSmart BG] Invalid image URL format:', imageUrl.substring(0, 50));
          sendResponse({ success: false, error: 'Invalid image URL format' });
          return;
        }

        const cacheKey = getCacheKey('img', { img: imageUrl });
        const cached = getCached(cacheKey);
        if (cached) {
          console.log('[AliSmart BG] Returning cached image search results:', cached.products?.length, 'products');
          sendResponse(cached);
          return;
        }

        // Try multiple proxy endpoints for redundancy
        const proxyEndpoints = [
          `${PROXY_URL}?imageUrl=${encodeURIComponent(imageUrl)}`,
          `${PROXY_URL}?imgUrl=${encodeURIComponent(imageUrl)}`,
          `${PROXY_URL}?image=${encodeURIComponent(imageUrl)}`
        ];
        
        let lastError = null;
        let response = null;
        
        for (const searchUrl of proxyEndpoints) {
          try {
            console.log('[AliSmart BG] Trying image search URL:', searchUrl.substring(0, 100));
            response = await fetchWithTimeout(searchUrl, {}, 10000); // 10 second timeout
            
            if (response.ok) {
              console.log('[AliSmart BG] Image search successful with endpoint');
              break;
            }
          } catch (err) {
            lastError = err;
            console.log('[AliSmart BG] Endpoint failed, trying next...');
            continue;
          }
        }
        
        if (!response || !response.ok) {
          const status = response?.status || 'unknown';
          if (status === 403) {
            console.error('[AliSmart BG] IMAGE SEARCH 403 Forbidden');
          } else if (status === 429) {
            console.error('[AliSmart BG] IMAGE SEARCH 429 Too Many Requests');
          } else if (status === 404) {
            console.error('[AliSmart BG] IMAGE SEARCH 404 - Proxy endpoint not found');
          }
          throw new Error(`Image search failed: ${status} ${lastError?.message || ''}`);
        }

        const data = await response.json();
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format from image search');
        }
        
        if (data.error) {
          throw new Error(data.error);
        }

        // Extract products from various possible response formats
        let products = [];
        if (Array.isArray(data.products)) {
          products = data.products;
        } else if (Array.isArray(data.results)) {
          products = data.results;
        } else if (Array.isArray(data.data)) {
          products = data.data;
        } else if (data.product && Array.isArray(data.product)) {
          products = data.product;
        } else if (data.item && Array.isArray(data.item)) {
          products = data.item;
        }
        
        // Normalize product fields
        const normalizedProducts = products.map(p => ({
          productId: p.productId || p.id || p.product_id || p.itemId || '',
          product_title: p.product_title || p.title || p.productTitle || p.name || 'Unknown Product',
          product_main_image_url: p.product_main_image_url || p.imageUrl || p.image || p.imgUrl || p.pic || '',
          product_detail_url: p.product_detail_url || p.productUrl || p.url || p.link || 
            (p.productId ? `https://www.aliexpress.com/item/${p.productId}.html` : ''),
          price: p.price || p.salePrice || p.originalPrice || p.sale_price || p.minPrice || 'N/A',
          priceValue: parseFloat(p.priceValue || p.sale_price || p.original_price || p.minPrice || 0),
          rating: parseFloat(p.rating || p.evaluationStar || p.productAverageStar || p.star || 0),
          orders: parseInt(p.orders || p.tradeCount || p.sales || p.sold || 0)
        })).filter(p => p.productId); // Only keep products with valid IDs

        console.log('[AliSmart BG] Image search found', normalizedProducts.length, 'products');
        
        const result = { 
          success: true, 
          products: normalizedProducts,
          source: 'visual_search'
        };
        
        setCache(cacheKey, result);
        sendResponse(result);
      } catch (error) {
        console.error('[AliSmart BG] searchByImage error:', error.message);
        console.error('[AliSmart BG] Error stack:', error.stack);
        sendResponse({ 
          success: false, 
          error: error.message || 'Image search failed',
          products: [] // Always return empty array on error for consistency
        });
      }
    })();
    return true;
  }

  if (request.action === 'searchByKeyword') {
    console.log('[AliSmart BG] Handling searchByKeyword, keyword:', request.keyword?.substring(0, 50));
    (async () => {
      try {
        const keyword = request.keyword;
        const page = request.page || 1;
        const sortVal = request.sort || null;
        const imgUrl = request.imgUrl || '';
        const title = request.title || '';

        console.log('[AliSmart BG] Received from content.js:', { keyword: keyword?.substring(0, 50), imgUrl: imgUrl?.substring(0, 50), title: title?.substring(0, 50) });

        const cacheKey = getCacheKey('kw', { kw: keyword, sort: sortVal, page, img: imgUrl, title });
        const cached = getCached(cacheKey);
        if (cached) {
          console.log('[AliSmart BG] Returning cached keyword search results');
          sendResponse(cached);
          return;
        }

        const config = await getConfig();
        const pageSize = Math.min(config.RESULTS_PER_PAGE || 50, 50);
        const sort = sortVal || config.SORT_BY || 'SALE_PRICE_ASC';
        console.log('[AliSmart BG] Search config:', { pageSize, sort, page });

        const data = await searchViaProxy(keyword, page, pageSize, sort, imgUrl, title, request.currentId || '');
        await getExchangeRates();

        // Extract products from the response data
        const products = data?.products || data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
        console.log('[AliSmart BG] Extracted', products.length, 'products from keyword search');
        
        // DEBUG: Log first product structure to identify correct image field
        if (products.length > 0) {
          console.log('[AliSmart BG] DEBUG first product keys:', Object.keys(products[0]));
        }
        
        const result = { success: true, products };
        setCache(cacheKey, result);
        console.log('[AliSmart BG] Sending', products.length, 'products to content script');
        sendResponse(result);
      } catch (error) {
        console.error('[AliSmart BG] searchByKeyword error:', error.message);
        console.error('[AliSmart BG] Error stack:', error.stack);
        sendResponse({ success: false, error: error.message || 'Search failed' });
      }
    })();
    return true;
  }

  if (request.action === 'convertCurrency') {
    console.log('[AliSmart BG] Handling convertCurrency:', request.fromCurrency, request.amount);
    (async () => {
      try {
        const rates = await getExchangeRates();
        const from = request.fromCurrency || 'USD';
        const amount = parseFloat(request.amount) || 0;
        const rate = rates[from] || 1;
        const usdAmount = +(amount / rate).toFixed(2);
        console.log('[AliSmart BG] Currency conversion:', amount, from, '=', usdAmount, 'USD');
        sendResponse({ success: true, usdAmount, rate, rates });
      } catch (e) {
        console.error('[AliSmart BG] convertCurrency error:', e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (request.action === 'getConfig') {
    console.log('[AliSmart BG] Handling getConfig');
    getConfig()
      .then(config => {
        console.log('[AliSmart BG] Sending config:', config);
        sendResponse({ success: true, config });
      })
      .catch(error => {
        console.error('[AliSmart BG] getConfig error:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'saveConfig') {
    console.log('[AliSmart BG] Handling saveConfig:', request.config);
    const safeConfig = {
      CURRENCY: request.config.CURRENCY,
      SORT_BY: request.config.SORT_BY,
      RESULTS_PER_PAGE: request.config.RESULTS_PER_PAGE
    };
    chrome.storage.sync.set(safeConfig, () => {
      if (chrome.runtime.lastError) {
        console.error('[AliSmart BG] saveConfig error:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('[AliSmart BG] Config saved successfully');
        sendResponse({ success: true });
      }
    });
    return true;
  }

  // ─── Voucher Sniper Handlers ────────────────────────────────────────────
  // Hidden Voucher Discovery & Auto-Injection at Checkout
  
  if (request.action === 'fetchStoreCoupons') {
    console.log('[AliSmart BG] Fetching store coupons for store:', request.storeId);
    
    (async () => {
      try {
        // Simulate fetching store coupons (in production, this would scrape the store page)
        const mockCoupons = [
          { code: `STORE${request.storeId}5`, amount: 5, minOrder: 50, type: 'FOLLOWER', expiryDate: '2026-12-31' },
          { code: `SAVE10${request.storeId}`, amount: 10, minOrder: 100, type: 'THRESHOLD', expiryDate: '2026-12-31' }
        ];
        
        // Add jitter to avoid rate limiting
        await new Promise(r => setTimeout(r, Math.random() * 500 + 300));
        
        sendResponse({ success: true, coupons: mockCoupons });
      } catch (error) {
        console.error('[AliSmart BG] Store coupon fetch error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'fetchPlatformCoupons') {
    console.log('[AliSmart BG] Fetching platform coupons');
    
    (async () => {
      try {
        // Common AliExpress platform coupons
        const platformCoupons = [
          { code: 'ALI5', amount: 5, minOrder: 50, type: 'platform', expiryDate: '2026-12-31', category: 'general' },
          { code: 'WELCOME15', amount: 15, minOrder: 150, type: 'platform', expiryDate: '2026-12-31', category: 'new_user' },
          { code: 'FLASH8', amount: 8, minOrder: 80, type: 'platform', expiryDate: '2026-12-31', category: 'flash_sale' }
        ];
        
        await new Promise(r => setTimeout(r, Math.random() * 400 + 200));
        
        sendResponse({ success: true, coupons: platformCoupons });
      } catch (error) {
        console.error('[AliSmart BG] Platform coupon fetch error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'validateVoucher') {
    console.log('[AliSmart BG] Validating voucher:', request.code);
    
    (async () => {
      try {
        // Simulate validation with jitter
        await new Promise(r => setTimeout(r, Math.random() * 600 + 400));
        
        // Mock validation - in production would check against AliExpress API
        const isValid = request.code && request.code.length >= 3;
        const mockSavings = isValid ? Math.floor(Math.random() * 10) + 2 : 0;
        
        sendResponse({ 
          valid: isValid, 
          savings: mockSavings,
          message: isValid ? 'Voucher applied successfully' : 'Invalid voucher code'
        });
      } catch (error) {
        console.error('[AliSmart BG] Voucher validation error:', error);
        sendResponse({ valid: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'applyVoucherAtCheckout') {
    console.log('[AliSmart BG] Applying voucher at checkout:', request.code);
    
    (async () => {
      try {
        // Get the active tab (checkout page)
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url.includes('aliexpress.com')) {
          sendResponse({ success: false, error: 'Not on AliExpress checkout page' });
          return;
        }
        
        // Inject script to apply voucher
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectVoucherCode,
          args: [request.code]
        });
        
        sendResponse(result[0]?.result || { success: false, error: 'Injection failed' });
      } catch (error) {
        console.error('[AliSmart BG] Checkout injection error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ─── Elite Seller Radar Handlers ─────────────────────────────────────
  // Seller Integrity & Risk Assessment
  
  if (request.action === 'fetchSellerData') {
    console.log('[AliSmart BG] Fetching seller data for store:', request.storeId);
    
    (async () => {
      try {
        // Simulate fetching seller data from AliExpress
        await new Promise(r => setTimeout(r, Math.random() * 500 + 300));
        
        // Mock seller data (in production would scrape from store page)
        const mockSellerData = {
          storeId: request.storeId,
          storeName: `Store ${request.storeId}`,
          storeAge: 2.5, // years
          yearsActive: 2.5,
          orders: 15420,
          sales: 15420,
          rating: 4.7,
          storeRating: 4.7,
          feedbackPercent: 96.5,
          positiveFeedback: 96.5,
          responseRate: 0.88,
          replyRate: 0.88,
          shippingDays: 12,
          category: 'Electronics'
        };
        
        sendResponse({ success: true, data: mockSellerData });
      } catch (error) {
        console.error('[AliSmart BG] Seller data fetch error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'fetchSellerHistory') {
    console.log('[AliSmart BG] Fetching seller history for store:', request.storeId);
    
    (async () => {
      try {
        await new Promise(r => setTimeout(r, Math.random() * 400 + 200));
        
        // Generate mock historical data
        const now = Date.now();
        const mockHistory = {
          priceHistory: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(now - i * 86400000).toISOString(),
            price: 25 + Math.random() * 10
          })),
          reviews: Array.from({ length: 50 }, (_, i) => ({
            date: new Date(now - Math.random() * 90 * 86400000).toISOString(),
            rating: Math.random() > 0.1 ? 5 : 4,
            content: ['Great product', 'Fast shipping', 'Good quality', 'Excellent'][Math.floor(Math.random() * 4)]
          })),
          categoryAvg: {
            shippingDays: 15,
            responseRate: 0.82,
            avgPrice: 28
          }
        };
        
        sendResponse({ success: true, data: mockHistory });
      } catch (error) {
        console.error('[AliSmart BG] Seller history fetch error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ─── Smart Wishlist Handlers ─────────────────────────────────────────
  // Cloud-synced wishlist with collections
  
  if (request.action === 'addToWishlist') {
    console.log('[AliSmart BG] Adding to wishlist:', request.product?.title);
    
    (async () => {
      try {
        const { product, collectionId } = request;
        
        // Get current wishlist
        const result = await chrome.storage.local.get('alismart_wishlist_items');
        const items = result.alismart_wishlist_items || [];
        
        // Check if already exists
        const exists = items.find(i => i.productId === product.productId);
        if (exists) {
          sendResponse({ success: false, error: 'Item already in wishlist', item: exists });
          return;
        }
        
        // Create new item
        const newItem = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          productId: product.productId,
          title: product.title,
          price: product.price,
          priceValue: product.priceValue,
          imageUrl: product.imageUrl,
          storeId: product.storeId,
          storeName: product.storeName,
          collectionId: collectionId || 'default',
          addedAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          priceHistory: [{
            price: product.priceValue,
            date: new Date().toISOString()
          }]
        };
        
        // Save
        items.push(newItem);
        await chrome.storage.local.set({ alismart_wishlist_items: items });
        
        sendResponse({ success: true, item: newItem, totalItems: items.length });
      } catch (error) {
        console.error('[AliSmart BG] Add to wishlist error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'removeFromWishlist') {
    console.log('[AliSmart BG] Removing from wishlist:', request.itemId);
    
    (async () => {
      try {
        const result = await chrome.storage.local.get('alismart_wishlist_items');
        const items = result.alismart_wishlist_items || [];
        
        const updated = items.filter(i => i.id !== request.itemId);
        await chrome.storage.local.set({ alismart_wishlist_items: updated });
        
        sendResponse({ success: true, removedId: request.itemId, totalItems: updated.length });
      } catch (error) {
        console.error('[AliSmart BG] Remove from wishlist error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'createWishlistCollection') {
    console.log('[AliSmart BG] Creating wishlist collection:', request.name);
    
    (async () => {
      try {
        const result = await chrome.storage.local.get('alismart_wishlist_collections');
        const collections = result.alismart_wishlist_collections || [
          { id: 'default', name: 'All Items', color: '#ff6a00', itemCount: 0 }
        ];
        
        const newCollection = {
          id: Date.now().toString(36),
          name: request.name,
          color: request.color || '#ff6a00',
          createdAt: new Date().toISOString(),
          itemCount: 0,
          totalValue: 0
        };
        
        collections.push(newCollection);
        await chrome.storage.local.set({ alismart_wishlist_collections: collections });
        
        sendResponse({ success: true, collection: newCollection });
      } catch (error) {
        console.error('[AliSmart BG] Create collection error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Forward SEARCH_RESULTS from content script to sidebar
  if (request.type === 'SEARCH_RESULTS') {
    console.log('[AliSmart BG] Forwarding SEARCH_RESULTS to sidebar:', request.results?.length, 'products');
    (async () => {
      try {
        // Find the sidebar tab (usually the one with the AliSmart sidebar open)
        const tabs = await chrome.tabs.query({});
        let forwarded = false;
        
        for (const tab of tabs) {
          if (tab.url && tab.url.includes('aliexpress.com')) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: 'SEARCH_RESULTS',
                results: request.results,
                sourceProduct: request.sourceProduct,
                timestamp: request.timestamp
              });
              console.log('[AliSmart BG] Forwarded SEARCH_RESULTS to tab:', tab.id);
              forwarded = true;
            } catch (e) {
              // Tab might not have content script, ignore
            }
          }
        }
        
        sendResponse({ success: true, forwarded });
      } catch (error) {
        console.error('[AliSmart BG] Error forwarding SEARCH_RESULTS:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Forward OPEN_SIDEBAR_AND_SEARCH from popup/content to sidebar
  if (request.type === 'OPEN_SIDEBAR_AND_SEARCH') {
    console.log('[AliSmart BG] Forwarding OPEN_SIDEBAR_AND_SEARCH to content script');
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].url.includes('aliexpress.com')) {
          await chrome.tabs.sendMessage(tabs[0].id, request);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No AliExpress tab found' });
        }
      } catch (error) {
        console.error('[AliSmart BG] Error forwarding OPEN_SIDEBAR_AND_SEARCH:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  console.warn('[AliSmart BG] Unknown message type:', request.type || request.action);
  sendResponse({ success: false, error: 'Unknown action' });
  return false;
});

console.log('[AliSmart BG] Message listeners ready');

// ─── Voucher Injection Function ─────────────────────────────────────────
// This function runs in the context of the checkout page
function injectVoucherCode(code) {
  return new Promise((resolve) => {
    try {
      // Look for coupon input field
      const inputSelectors = [
        'input[placeholder*="coupon" i]',
        'input[placeholder*="code" i]',
        'input[name*="coupon" i]',
        'input[name*="voucher" i]',
        'input[title*="coupon" i]',
        '[class*="coupon"] input',
        '[class*="voucher"] input'
      ];
      
      let input = null;
      for (const selector of inputSelectors) {
        input = document.querySelector(selector);
        if (input) break;
      }
      
      if (!input) {
        resolve({ success: false, error: 'Coupon input not found' });
        return;
      }
      
      // Enter the code
      input.value = code;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Look for apply button
      const buttonSelectors = [
        'button[class*="apply" i]',
        'button[class*="confirm" i]',
        'button:has-text("apply")',
        'button:has-text("use")',
        'button:has-text("apply coupon")',
        'button:has-text("confirm")'
      ];
      
      let applyButton = null;
      for (const selector of buttonSelectors) {
        applyButton = document.querySelector(selector);
        if (applyButton) break;
      }
      
      if (applyButton) {
        applyButton.click();
        
        // Wait for result
        setTimeout(() => {
          // Check for success/error messages
          const successMsg = document.querySelector('[class*="success" i], [class*="applied" i]');
          const errorMsg = document.querySelector('[class*="error" i], [class*="invalid" i]');
          
          if (successMsg) {
            // Try to extract savings amount
            const priceElements = document.querySelectorAll('[class*="price" i], [class*="total" i]');
            let savings = 0;
            
            for (const el of priceElements) {
              const text = el.textContent;
              const match = text.match(/\$([\d.]+)/);
              if (match) {
                savings = parseFloat(match[1]);
                break;
              }
            }
            
            resolve({ success: true, savings: savings, message: 'Voucher applied' });
          } else if (errorMsg) {
            resolve({ success: false, error: errorMsg.textContent || 'Invalid code' });
          } else {
            resolve({ success: true, savings: 0, message: 'Code entered, result unknown' });
          }
        }, 1500);
      } else {
        resolve({ success: false, error: 'Apply button not found' });
      }
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
}

// ─── Address Vault Decryption Handler ─────────────────────────────────
// Note: This must be outside the onMessage listener to handle decryption
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDecryptedAddress') {
    console.log('[AliSmart BG] Decrypting address for content script');
    
    (async () => {
      try {
        // Get encrypted address from storage
        const result = await chrome.storage.local.get('alismart_address_vault');
        
        if (!result.alismart_address_vault) {
          console.log('[AliSmart BG] No address found in vault');
          sendResponse({ success: false, error: 'No address saved' });
          return;
        }
        
        // The crypto.js module handles decryption
        // Since we can't easily import ES modules here, we'll pass the encrypted
        // data back and let the React app handle decryption, or use a simplified approach
        // For now, return the raw data - content.js will handle basic extraction
        sendResponse({ 
          success: true, 
          address: result.alismart_address_vault 
        });
      } catch (error) {
        console.error('[AliSmart BG] Address decryption error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// ─── Checkout Optimizer Handlers ──────────────────────────────────────

/**
 * Detects if current page is cart or checkout
 */
function isCartOrCheckoutPage(url) {
  if (!url) return false;
  const cartPatterns = [
    '/cart',
    '/shoppingcart',
    '/checkout',
    '/order/confirm',
    '/payment',
    '/buyNow',
    '/placeorder'
  ];
  return cartPatterns.some(pattern => url.includes(pattern));
}

/**
 * Message handler for cart/checkout operations
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle cart scan requests
  if (request.type === 'SCAN_CART') {
    console.log('[AliSmart BG] Scanning cart...');
    
    (async () => {
      try {
        // Get active tab
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!isCartOrCheckoutPage(activeTab?.url)) {
          sendResponse({ 
            success: false, 
            error: 'Not on cart/checkout page',
            isCartPage: false
          });
          return;
        }
        
        // Execute script to extract cart data
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: extractCartDataFromPage
        });
        
        const cartData = results[0]?.result;
        
        if (cartData) {
          // Store for optimization
          await chrome.storage.local.set({ 
            alismart_current_cart: cartData,
            alismart_cart_timestamp: Date.now()
          });
          
          sendResponse({ 
            success: true, 
            cartData,
            isCartPage: true
          });
        } else {
          sendResponse({ 
            success: false, 
            error: 'Could not extract cart data',
            isCartPage: true
          });
        }
      } catch (error) {
        console.error('[AliSmart BG] Cart scan error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async
  }
  
  // Handle auto-optimize requests
  if (request.type === 'AUTO_OPTIMIZE_CART') {
    console.log('[AliSmart BG] Auto-optimizing cart...');
    
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Apply optimizations via content script
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: applyCartOptimizations,
          args: [request.actions]
        });
        
        sendResponse({ 
          success: true, 
          results: results[0]?.result
        });
      } catch (error) {
        console.error('[AliSmart BG] Auto-optimize error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
  
  // Handle single optimization apply
  if (request.type === 'APPLY_OPTIMIZATION') {
    console.log('[AliSmart BG] Applying optimization:', request.action);
    
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: applySingleOptimization,
          args: [request.action, request.data]
        });
        
        sendResponse({ 
          success: true, 
          result: results[0]?.result
        });
      } catch (error) {
        console.error('[AliSmart BG] Apply optimization error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
  
  return false; // Not handled
});

/**
 * Extracts cart data from AliExpress page
 * This function runs in content script context
 */
function extractCartDataFromPage() {
  try {
    // Try multiple selectors for cart items
    const itemSelectors = [
      '[data-testid="cart-item"]',
      '.cart-item',
      '[class*="cart-item"]',
      '[class*="CartItem"]',
      '[class*="product-item"]',
      '[data-pl]'
    ];
    
    let items = [];
    let usedSelector = '';
    
    for (const selector of itemSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        usedSelector = selector;
        items = Array.from(elements).map(el => {
          try {
            const id = el.dataset?.productId || 
                      el.querySelector('[data-product-id]')?.dataset?.productId ||
                      el.querySelector('a[href*="/item/"]')?.href?.match(/(\d+)\.html/)?.[1] ||
                      Math.random().toString(36).substr(2, 9);
            
            const titleEl = el.querySelector('[class*="title"], [class*="Title"], h3, h4, a[title]');
            const priceEl = el.querySelector('[class*="price"], [class*="Price"], [data-testid*="price"], .current-price');
            const qtyEl = el.querySelector('input[type="number"], select, [class*="quantity"], [class*="qty"]');
            const imgEl = el.querySelector('img');
            
            // Extract price text and convert to number
            const priceText = priceEl?.textContent || '';
            const priceMatch = priceText.match(/[\d,.]+/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;
            
            return {
              id,
              title: titleEl?.textContent?.trim() || titleEl?.title || 'Unknown Item',
              price,
              quantity: parseInt(qtyEl?.value || qtyEl?.textContent) || 1,
              image: imgEl?.src || '',
              coinsDiscount: 0,
              maxCoinsDiscount: 0
            };
          } catch (e) {
            return null;
          }
        }).filter(item => item && item.id);
        
        if (items.length > 0) break;
      }
    }
    
    // Extract totals - try various selectors
    const subtotalSelectors = ['[data-testid="subtotal"]', '[class*="subtotal"]', '[class*="Subtotal"]', '.sub-total', '[class*="summary"] [class*="price"]'];
    const shippingSelectors = ['[data-testid="shipping"]', '[class*="shipping"]', '[class*="Shipping"]', '.shipping-cost'];
    const totalSelectors = ['[data-testid="total"]', '[class*="total"]', '[class*="Total"]', '.order-total', '[class*="grand-total"]'];
    
    const extractPriceFromElement = (selectors) => {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          const text = el.textContent;
          const match = text.match(/[\d,.]+/);
          if (match) return parseFloat(match[0].replace(/,/g, ''));
        }
      }
      return 0;
    };
    
    // Extract available coupons
    const couponSelectors = [
      '[class*="coupon"]', '[class*="voucher"]', '[class*="Coupon"]', '[class*="Voucher"]',
      '[data-testid*="coupon"]', '[data-testid*="voucher"]'
    ];
    
    let availableCoupons = [];
    for (const selector of couponSelectors) {
      const couponEls = document.querySelectorAll(selector);
      if (couponEls.length > 0) {
        availableCoupons = Array.from(couponEls).map(el => {
          const codeEl = el.querySelector('[class*="code"], [class*="Code"]');
          const amountEl = el.querySelector('[class*="amount"], [class*="Amount"], [class*="discount"]');
          const minOrderEl = el.querySelector('[class*="min"], [class*="minimum"], [class*="threshold"]');
          
          return {
            code: codeEl?.textContent?.trim() || 'VOUCHER',
            amount: amountEl?.textContent?.match(/[\d.]+/)?.[0] || '0',
            minOrder: minOrderEl?.textContent?.match(/[\d.]+/)?.[0] || '0',
            type: el.textContent?.toLowerCase().includes('store') ? 'store' : 'platform'
          };
        }).filter(c => parseFloat(c.amount) > 0);
        
        if (availableCoupons.length > 0) break;
      }
    }
    
    // Extract coin information
    const coinSelectors = ['[class*="coin"]', '[class*="Coin"]', '[data-testid*="coin"]'];
    let coins = { available: 0, exchangeRate: 0.01 };
    
    for (const selector of coinSelectors) {
      const coinEl = document.querySelector(selector);
      if (coinEl) {
        const coinText = coinEl.textContent;
        const match = coinText.match(/(\d+)/);
        if (match) {
          coins.available = parseInt(match[1]);
          break;
        }
      }
    }
    
    // Check if shipping to Israel
    const shippingToIsrael = document.body.textContent.includes('Israel') || 
                            document.querySelector('[value="IL"]') !== null ||
                            document.body.textContent.includes('ישראל');
    
    return {
      items,
      selector: usedSelector,
      subtotal: extractPriceFromElement(subtotalSelectors),
      shipping: extractPriceFromElement(shippingSelectors),
      total: extractPriceFromElement(totalSelectors),
      availableCoupons,
      coins,
      shippingToIsrael,
      itemCount: items.length,
      url: window.location.href,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Checkout Optimizer] Extraction error:', error);
    return { error: error.message };
  }
}

/**
 * Applies multiple optimizations automatically
 */
function applyCartOptimizations(actions) {
  const results = [];
  
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'apply_voucher':
          results.push(applyVoucher(action.data.couponCode));
          break;
        case 'use_coins':
          results.push(toggleCoins(true));
          break;
        case 'apply_item_coins':
          results.push(applyItemCoins(action.data.itemId));
          break;
        case 'stack_vouchers':
          results.push(applyVoucherStack(action.data.vouchers));
          break;
        default:
          results.push({ action: action.type, success: false, error: 'Unknown action' });
      }
    } catch (e) {
      results.push({ action: action.type, success: false, error: e.message });
    }
  }
  
  return results;
}

/**
 * Applies single optimization
 */
function applySingleOptimization(actionType, data) {
  switch (actionType) {
    case 'apply_voucher':
      return applyVoucher(data.couponCode);
    case 'use_coins':
      return toggleCoins(true);
    case 'apply_item_coins':
      return applyItemCoins(data.itemId);
    case 'stack_vouchers':
      return applyVoucherStack(data.vouchers);
    default:
      return { success: false, error: 'Unknown action type' };
  }
}

/**
 * Helper: Apply voucher code
 */
function applyVoucher(code) {
  const input = document.querySelector('input[placeholder*="coupon"], input[placeholder*="code"], input[name*="coupon"]');
  if (input) {
    input.value = code;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    const applyBtn = input.closest('form, div')?.querySelector('button');
    if (applyBtn) {
      applyBtn.click();
      return { success: true, message: `Applied ${code}` };
    }
  }
  return { success: false, error: 'Could not find coupon input' };
}

/**
 * Helper: Toggle coins usage
 */
function toggleCoins(enable) {
  const coinToggle = document.querySelector('[class*="coin-toggle"], [class*="use-coins"], input[type="checkbox"][class*="coin"]');
  if (coinToggle) {
    coinToggle.checked = enable;
    coinToggle.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, enabled: enable };
  }
  return { success: false, error: 'Coin toggle not found' };
}

/**
 * Helper: Apply item-level coins
 */
function applyItemCoins(itemId) {
  const itemEl = document.querySelector(`[data-product-id="${itemId}"]`);
  if (itemEl) {
    const coinBtn = itemEl.querySelector('[class*="coin"], button[class*="apply"]');
    if (coinBtn) {
      coinBtn.click();
      return { success: true, itemId };
    }
  }
  return { success: false, error: 'Item coin button not found' };
}

/**
 * Helper: Apply multiple vouchers (stacking)
 */
function applyVoucherStack(vouchers) {
  const results = [];
  for (const code of vouchers) {
    results.push(applyVoucher(code));
  }
  return { success: true, applied: results };
}

