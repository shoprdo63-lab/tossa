/**
 * Background Service Worker
 * שירות רקע - Service Worker
 * 
 * תכונות:
 * - מעקב מחירים (Price Alerts) עם Alarms API
 * - בדיקת מחירים תקופתית למוצרים במעקב
 * - שליחת התראות על ירידת מחיר
 */

// ===== CONFIGURATION =====
const ALARM_NAME = 'priceCheck';
const CHECK_INTERVAL_MINUTES = 60; // בדיקה כל שעה
const MIN_PRICE_DROP_PERCENT = 5; // ירידה מינימלית של 5% להתראה
const NOTIFICATION_ICON = 'icons/icon128.png';

// ===== INITIALIZATION =====
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated:', details.reason);
  
  // אתחול מערכת התראות מחיר
  setupPriceCheckAlarm();
  
  // אתחול storage אם צריך
  chrome.storage.local.get(['priceAlerts', 'alertSettings'], (result) => {
    if (!result.priceAlerts) {
      chrome.storage.local.set({ priceAlerts: {} });
    }
    if (!result.alertSettings) {
      chrome.storage.local.set({ 
        alertSettings: { 
          enabled: true, 
          checkInterval: CHECK_INTERVAL_MINUTES,
          minDropPercent: MIN_PRICE_DROP_PERCENT 
        } 
      });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Extension started');
  setupPriceCheckAlarm();
});

// ===== ALARMS SETUP =====
function setupPriceCheckAlarm() {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: CHECK_INTERVAL_MINUTES
      });
      console.log('[Background] Price check alarm set for every', CHECK_INTERVAL_MINUTES, 'minutes');
    }
  });
}

// ===== ALARM HANDLER =====
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[Background] Running scheduled price check...');
    performPriceCheck();
  }
});

// ===== PRICE CHECK LOGIC =====
async function performPriceCheck() {
  try {
    // בדיקה האם התראות מופעלות
    const { alertSettings } = await chrome.storage.local.get('alertSettings');
    if (!alertSettings?.enabled) {
      console.log('[Background] Price alerts disabled, skipping check');
      return;
    }

    // קבלת רשימת ההתראות
    const { priceAlerts } = await chrome.storage.local.get('priceAlerts');
    const alerts = priceAlerts || {};
    const productIds = Object.keys(alerts);
    
    if (productIds.length === 0) {
      console.log('[Background] No price alerts configured');
      return;
    }

    console.log('[Background] Checking', productIds.length, 'products for price changes');

    // בדיקת כל מוצר (באצוות קטנות כדי לא להעמיס)
    const batchSize = 5;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      await Promise.all(batch.map(productId => checkSingleProduct(productId, alerts[productId])));
      
      // דיליי קצר בין אצוות
      if (i + batchSize < productIds.length) {
        await delay(2000);
      }
    }

    console.log('[Background] Price check completed');
  } catch (error) {
    console.error('[Background] Price check failed:', error);
  }
}

async function checkSingleProduct(productId, alertData) {
  try {
    // וידוא שיש הגבלת תדירות התראות (לא יותר מאחת ליום)
    if (alertData.lastNotification) {
      const lastNotify = new Date(alertData.lastNotification);
      const hoursSince = (Date.now() - lastNotify.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return; // כבר שלחנו התראה היום
      }
    }

    // קריאה ל-API לבדיקת מחיר נוכחי
    const currentPrice = await fetchProductPrice(productId);
    
    if (!currentPrice || currentPrice <= 0) {
      console.log('[Background] Could not get price for', productId);
      return;
    }

    // חישוב אחוז השינוי
    const originalPrice = alertData.originalPrice;
    const targetPrice = alertData.targetPrice || (originalPrice * 0.95);
    
    const priceDrop = originalPrice - currentPrice;
    const percentDrop = (priceDrop / originalPrice) * 100;

    console.log(`[Background] ${productId}: $${originalPrice} → $${currentPrice} (${percentDrop.toFixed(1)}% change)`);

    // בדיקה האם המחיר ירד מתחת ליעד
    if (currentPrice <= targetPrice && percentDrop >= MIN_PRICE_DROP_PERCENT) {
      await sendPriceDropNotification(productId, alertData, currentPrice, percentDrop);
      
      // עדכון timestamp התראה אחרונה
      const { priceAlerts } = await chrome.storage.local.get('priceAlerts');
      if (priceAlerts && priceAlerts[productId]) {
        priceAlerts[productId].lastNotification = Date.now();
        priceAlerts[productId].notifiedPrice = currentPrice;
        await chrome.storage.local.set({ priceAlerts });
      }
    }

    // שמירת המחיר הנוכחי להיסטוריה
    await storePriceHistory(productId, currentPrice);

  } catch (error) {
    console.error('[Background] Failed to check product', productId, ':', error);
  }
}

// ===== PRICE FETCHING =====
async function fetchProductPrice(productId) {
  try {
    // שימוש ב-API proxy לקבלת מחיר עדכני
    // ניתן להתאים לפי המערכת הקיימת
    const response = await fetch(
      `https://alismart-proxy.vercel.app/api/product-price?productId=${encodeURIComponent(productId)}`,
      { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // חילוץ המחיר מהתשובה
    const price = data.price || data.sale_price || data.original_price || null;
    
    if (price) {
      // המרה למספר
      const numericPrice = parseFloat(String(price).replace(/[^\d.]/g, ''));
      return numericPrice;
    }
    
    return null;
  } catch (error) {
    console.error('[Background] Price fetch failed:', error);
    return null;
  }
}

// ===== NOTIFICATIONS =====
async function sendPriceDropNotification(productId, alertData, currentPrice, percentDrop) {
  const title = chrome.i18n.getMessage('priceDropTitle') || '💰 Price Drop Alert!';
  const productName = alertData.productTitle || 'Your tracked product';
  const formattedPrice = `$${currentPrice.toFixed(2)}`;
  const formattedOriginal = `$${alertData.originalPrice.toFixed(2)}`;
  const savings = `$${(alertData.originalPrice - currentPrice).toFixed(2)}`;
  
  const message = chrome.i18n.getMessage('priceDropMessage', [
    productName.substring(0, 40),
    formattedPrice,
    formattedOriginal,
    savings
  ]) || `${productName.substring(0, 40)}... is now ${formattedPrice} (was ${formattedOriginal}, save ${savings})`;

  const notificationId = `price-drop-${productId}-${Date.now()}`;
  
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: alertData.productImage || NOTIFICATION_ICON,
    title: title,
    message: message,
    priority: 2,
    requireInteraction: false,
    buttons: [
      { title: chrome.i18n.getMessage('viewProduct') || 'View Product' }
    ]
  });

  console.log('[Background] Price drop notification sent for', productId);
}

// ===== NOTIFICATION CLICK HANDLER =====
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('price-drop-')) {
    const productId = notificationId.replace('price-drop-', '').split('-')[0];
    openProductPage(productId);
  }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('price-drop-') && buttonIndex === 0) {
    const productId = notificationId.replace('price-drop-', '').split('-')[0];
    openProductPage(productId);
  }
});

async function openProductPage(productId) {
  try {
    const url = `https://www.aliexpress.com/item/${productId}.html`;
    await chrome.tabs.create({ url });
  } catch (error) {
    console.error('[Background] Failed to open product page:', error);
  }
}

// ===== STORAGE HELPERS =====
async function storePriceHistory(productId, price) {
  try {
    const key = `priceHistory_${productId}`;
    const { [key]: history } = await chrome.storage.local.get(key);
    
    const newHistory = history || [];
    newHistory.push({
      price: price,
      timestamp: Date.now()
    });
    
    // שמירת 30 נקודות אחרונות בלבד
    if (newHistory.length > 30) {
      newHistory.shift();
    }
    
    await chrome.storage.local.set({ [key]: newHistory });
  } catch (error) {
    console.error('[Background] Failed to store price history:', error);
  }
}

// ===== MESSAGE HANDLERS =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping check
  if (request.type === 'PING') {
    sendResponse({ status: 'alive', timestamp: Date.now() });
    return true;
  }

  // Manual price check trigger
  if (request.type === 'TRIGGER_PRICE_CHECK') {
    performPriceCheck();
    sendResponse({ triggered: true });
    return true;
  }

  // Add price alert
  if (request.type === 'ADD_PRICE_ALERT') {
    addPriceAlert(request.alertData).then(result => {
      sendResponse(result);
    });
    return true;
  }

  // Remove price alert
  if (request.type === 'REMOVE_PRICE_ALERT') {
    removePriceAlert(request.productId).then(result => {
      sendResponse(result);
    });
    return true;
  }

  // Get all alerts
  if (request.type === 'GET_PRICE_ALERTS') {
    getAllPriceAlerts().then(alerts => {
      sendResponse({ alerts });
    });
    return true;
  }

  return false;
});

async function addPriceAlert(alertData) {
  try {
    const { priceAlerts } = await chrome.storage.local.get('priceAlerts');
    const alerts = priceAlerts || {};
    
    alerts[alertData.productId] = {
      ...alertData,
      createdAt: Date.now(),
      lastCheck: null,
      lastNotification: null,
    };
    
    await chrome.storage.local.set({ priceAlerts: alerts });
    
    // הפעלת בדיקה מיידית
    checkSingleProduct(alertData.productId, alerts[alertData.productId]);
    
    return { success: true };
  } catch (error) {
    console.error('[Background] Failed to add price alert:', error);
    return { success: false, error: error.message };
  }
}

async function removePriceAlert(productId) {
  try {
    const { priceAlerts } = await chrome.storage.local.get('priceAlerts');
    if (priceAlerts && priceAlerts[productId]) {
      delete priceAlerts[productId];
      await chrome.storage.local.set({ priceAlerts });
    }
    return { success: true };
  } catch (error) {
    console.error('[Background] Failed to remove price alert:', error);
    return { success: false, error: error.message };
  }
}

async function getAllPriceAlerts() {
  try {
    const { priceAlerts } = await chrome.storage.local.get('priceAlerts');
    return priceAlerts || {};
  } catch (error) {
    console.error('[Background] Failed to get price alerts:', error);
    return {};
  }
}

// ===== UTILITIES =====
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== KEEP ALIVE =====
// שמירה על ה-Service Worker במצב ער כדי למנוע "sleep"
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'KEEP_ALIVE') {
    sendResponse({ alive: true });
    return true;
  }
});

// ===== SAVINGS TRACKING =====
// מעקב חיסכון וסטטיסטיקות

/**
 * טעינת נתוני חיסכון
 */
async function loadSavingsData() {
  try {
    const result = await chrome.storage.local.get(['SAVINGS_DATA']);
    return result.SAVINGS_DATA || {
      totalSaved: 0,
      smartChoices: 0,
      couponsFound: 0,
      couponsUsed: 0,
      productsTracked: 0,
      weeklyActivity: [],
      monthlyStats: {},
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('[Background] Failed to load savings data:', error);
    return null;
  }
}

/**
 * שמירת נתוני חיסכון
 */
async function saveSavingsData(data) {
  try {
    await chrome.storage.local.set({
      SAVINGS_DATA: {
        ...data,
        lastUpdated: Date.now()
      }
    });
  } catch (error) {
    console.error('[Background] Failed to save savings data:', error);
  }
}

/**
 * רישום חיסכון חדש
 */
async function trackSavingsEvent(type, amount = 0, product = null) {
  const data = await loadSavingsData();
  if (!data) return null;
  
  // עדכון סך הכל
  if (amount > 0) {
    data.totalSaved += amount;
  }
  
  // עדכון מונים
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
  }
  
  // עדכון פעילות יומית
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
  
  // שמירת רק 30 ימים
  if (data.weeklyActivity.length > 30) {
    data.weeklyActivity = data.weeklyActivity.slice(-30);
  }
  
  await saveSavingsData(data);
  
  // שידור לכל הלשוניות
  chrome.runtime.sendMessage({
    type: 'SAVINGS_UPDATED',
    data: data
  }).catch(() => {});
  
  console.log('[Background] Savings tracked:', { type, amount, total: data.totalSaved });
  return data;
}

// האזנה לאירועי חיסכון
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRACK_SAVINGS') {
    trackSavingsEvent(request.savingsType, request.amount, request.product)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'GET_SAVINGS_STATS') {
    loadSavingsData()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Ping כל 20 שניות מה-content script אם needed
setInterval(() => {
  // Service Worker יישאר פעיל כל עוד יש alarm פעיל
}, 20000);

console.log('[Background] Service Worker loaded');
