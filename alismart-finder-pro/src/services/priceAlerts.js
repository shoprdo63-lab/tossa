/**
 * Price Alerts Service
 * שירות התראות מחיר
 * 
 * תכונות:
 * - ניהול התראות מחיר (הוספה, הסרה, עדכון)
 * - חישוב מחיר יעד
 * - מעקב אחר שינויי מחיר
 */

const STORAGE_KEY = 'ALISMART_PRICE_ALERTS';
const SETTINGS_KEY = 'ALISMART_PRICE_ALERT_SETTINGS';

/**
 * הגדרות ברירת מחדל להתראות
 */
const DEFAULT_SETTINGS = {
  enabled: true,
  checkInterval: 60, // דקות
  minDropPercent: 5, // אחוז מינימלי להתראה
  maxAlertsPerDay: 3, // מקסימום התראות ביום
  soundEnabled: true,
};

/**
 * מוסיף התראת מחיר חדשה
 * @param {Object} alertData - נתוני ההתראה
 * @returns {Promise<Object>} תוצאת הפעולה
 */
export async function addPriceAlert(alertData) {
  try {
    const { productId, productTitle, productImage, originalPrice, targetPrice } = alertData;
    
    if (!productId || !originalPrice) {
      return { success: false, error: 'Missing required fields' };
    }

    // קבלת התראות קיימות
    const alerts = await getPriceAlerts();
    
    // יצירת אובייקט התראה
    const alert = {
      productId,
      productTitle: productTitle || 'Unknown Product',
      productImage: productImage || '',
      originalPrice: parseFloat(originalPrice),
      targetPrice: targetPrice ? parseFloat(targetPrice) : calculateTargetPrice(originalPrice, 10),
      currentPrice: parseFloat(originalPrice),
      createdAt: Date.now(),
      lastCheck: null,
      lastNotification: null,
      history: [{ price: parseFloat(originalPrice), timestamp: Date.now() }],
      isActive: true,
    };

    alerts[productId] = alert;
    
    // שמירה
    await savePriceAlerts(alerts);
    
    // שליחה ל-Service Worker
    try {
      await chrome.runtime.sendMessage({
        type: 'ADD_PRICE_ALERT',
        alertData: alert,
      });
    } catch (e) {
      // Service Worker might be sleeping
    }

    return { success: true, alert };
  } catch (error) {
    console.error('[PriceAlerts] Failed to add alert:', error);
    return { success: false, error: error.message };
  }
}

/**
 * מסיר התראת מחיר
 * @param {string} productId - מזהה המוצר
 * @returns {Promise<Object>} תוצאת הפעולה
 */
export async function removePriceAlert(productId) {
  try {
    const alerts = await getPriceAlerts();
    
    if (alerts[productId]) {
      delete alerts[productId];
      await savePriceAlerts(alerts);
      
      // עדכון Service Worker
      try {
        await chrome.runtime.sendMessage({
          type: 'REMOVE_PRICE_ALERT',
          productId,
        });
      } catch (e) {
        // Ignore
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[PriceAlerts] Failed to remove alert:', error);
    return { success: false, error: error.message };
  }
}

/**
 * מקבל את כל התראות המחיר
 * @returns {Promise<Object>} מיפוי התראות לפי productId
 */
export async function getPriceAlerts() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || {};
  } catch (error) {
    console.error('[PriceAlerts] Failed to get alerts:', error);
    return {};
  }
}

/**
 * בודק האם יש התראה למוצר
 * @param {string} productId - מזהה המוצר
 * @returns {Promise<boolean>}
 */
export async function hasPriceAlert(productId) {
  const alerts = await getPriceAlerts();
  return !!alerts[productId];
}

/**
 * מקבל התראה ספציפית למוצר
 * @param {string} productId - מזהה המוצר
 * @returns {Promise<Object|null>}
 */
export async function getPriceAlert(productId) {
  const alerts = await getPriceAlerts();
  return alerts[productId] || null;
}

/**
 * מעדכן התראת מחיר
 * @param {string} productId - מזהה המוצר
 * @param {Object} updates - עדכונים להחיל
 * @returns {Promise<Object>} תוצאת הפעולה
 */
export async function updatePriceAlert(productId, updates) {
  try {
    const alerts = await getPriceAlerts();
    
    if (!alerts[productId]) {
      return { success: false, error: 'Alert not found' };
    }

    alerts[productId] = {
      ...alerts[productId],
      ...updates,
      updatedAt: Date.now(),
    };

    await savePriceAlerts(alerts);
    
    return { success: true, alert: alerts[productId] };
  } catch (error) {
    console.error('[PriceAlerts] Failed to update alert:', error);
    return { success: false, error: error.message };
  }
}

/**
 * מעדכן מחיר נוכחי להתראה ומחזיר האם יש ירידת מחיר משמעותית
 * @param {string} productId - מזהה המוצר
 * @param {number} newPrice - המחיר החדש
 * @returns {Promise<Object>} תוצאת העדכון
 */
export async function updateCurrentPrice(productId, newPrice) {
  try {
    const alert = await getPriceAlert(productId);
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    const oldPrice = alert.currentPrice;
    const priceDrop = oldPrice - newPrice;
    const percentDrop = (priceDrop / oldPrice) * 100;
    const targetPrice = alert.targetPrice;

    // עדכון היסטוריה
    const history = alert.history || [];
    history.push({ price: newPrice, timestamp: Date.now() });
    if (history.length > 30) history.shift();

    const updates = {
      currentPrice: newPrice,
      history,
      lastCheck: Date.now(),
    };

    // בדיקה האם המחיר ירד מתחת ליעד
    const targetReached = newPrice <= targetPrice;
    const significantDrop = percentDrop >= 5;

    await updatePriceAlert(productId, updates);

    return {
      success: true,
      priceChanged: oldPrice !== newPrice,
      priceDrop,
      percentDrop,
      targetReached,
      significantDrop,
      newPrice,
      targetPrice,
    };
  } catch (error) {
    console.error('[PriceAlerts] Failed to update price:', error);
    return { success: false, error: error.message };
  }
}

/**
 * מחשב מחיר יעד מומלץ
 * @param {number} originalPrice - המחיר המקורי
 * @param {number} desiredDropPercent - אחוז הירידה הרצוי (ברירת מחדל: 10%)
 * @returns {number} מחיר היעד
 */
export function calculateTargetPrice(originalPrice, desiredDropPercent = 10) {
  return originalPrice * (1 - desiredDropPercent / 100);
}

/**
 * מקבל הגדרות התראות
 * @returns {Promise<Object>} הגדרות
 */
export async function getAlertSettings() {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

/**
 * שומר הגדרות התראות
 * @param {Object} settings - הגדרות חדשות
 * @returns {Promise<Object>} תוצאת הפעולה
 */
export async function saveAlertSettings(settings) {
  try {
    const current = await getAlertSettings();
    const updated = { ...current, ...settings };
    await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
    return { success: true, settings: updated };
  } catch (error) {
    console.error('[PriceAlerts] Failed to save settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * פונקציית עזר - שמירת התראות
 */
async function savePriceAlerts(alerts) {
  await chrome.storage.local.set({ [STORAGE_KEY]: alerts });
}

/**
 * מפעיל בדיקת מחירים ידנית
 * @returns {Promise<Object>} תוצאת הבדיקה
 */
export async function triggerManualPriceCheck() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_PRICE_CHECK' });
    return response;
  } catch (error) {
    console.error('[PriceAlerts] Manual check failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * מקבל סטטיסטיקות על התראות
 * @returns {Promise<Object>} סטטיסטיקות
 */
export async function getAlertStats() {
  try {
    const alerts = await getPriceAlerts();
    const alertList = Object.values(alerts);
    
    if (alertList.length === 0) {
      return { total: 0, active: 0, notified: 0 };
    }

    const total = alertList.length;
    const active = alertList.filter(a => a.isActive).length;
    const notified = alertList.filter(a => a.lastNotification).length;
    const avgDrop = alertList.reduce((sum, a) => {
      if (a.originalPrice && a.targetPrice) {
        return sum + ((a.originalPrice - a.targetPrice) / a.originalPrice * 100);
      }
      return sum;
    }, 0) / total;

    return {
      total,
      active,
      notified,
      avgTargetDrop: avgDrop.toFixed(1),
    };
  } catch (error) {
    console.error('[PriceAlerts] Failed to get stats:', error);
    return { total: 0, active: 0, notified: 0 };
  }
}

/**
 * מנקה התראות ישנות או לא פעילות
 * @param {number} maxAgeDays - גיל מקסימלי בימים (ברירת מחדל: 30)
 * @returns {Promise<Object>} תוצאת הניקוי
 */
export async function cleanupOldAlerts(maxAgeDays = 30) {
  try {
    const alerts = await getPriceAlerts();
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    
    let removed = 0;
    
    for (const [productId, alert] of Object.entries(alerts)) {
      const age = now - alert.createdAt;
      if (age > maxAge && !alert.isActive) {
        delete alerts[productId];
        removed++;
      }
    }
    
    if (removed > 0) {
      await savePriceAlerts(alerts);
    }
    
    return { success: true, removed };
  } catch (error) {
    console.error('[PriceAlerts] Cleanup failed:', error);
    return { success: false, error: error.message };
  }
}
