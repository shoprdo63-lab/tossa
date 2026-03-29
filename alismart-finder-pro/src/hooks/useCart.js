import { useState, useEffect, useCallback } from 'react';

/**
 * useCart Hook
 * ניהול מצב סל הקניות
 * 
 * תכונות:
 * - מאזין לעדכונים מה-Content Script
 * - שומר נתוני סל בזמן אמת
 * - מספק פונקציות לחיפוש אלטרנטיבות זולות
 */

export function useCart() {
  const [cartData, setCartData] = useState({
    isCartPage: false,
    orderAmount: 0,
    cartItems: [],
    itemCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // מאזין להודעות מה-Content Script
  useEffect(() => {
    const handleMessage = (request, sender, sendResponse) => {
      if (request.type === 'CART_DATA_UPDATED') {
        setCartData({
          isCartPage: request.isCartPage,
          orderAmount: request.orderAmount || 0,
          cartItems: request.cartItems || [],
          itemCount: request.itemCount || 0,
        });
        setLastUpdate(request.timestamp);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // בקשת נתונים ראשונית
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_CART_DATA' }).catch(() => {
          // Tab might not have content script
        });
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  /**
   * מפעיל חיפוש אלטרנטיבות זולות למוצר בסל
   */
  const findCheaperAlternative = useCallback(async (cartItem) => {
    if (!cartItem || !cartItem.productId) {
      return { success: false, error: 'Invalid item' };
    }

    setIsLoading(true);

    try {
      // כאן תתבצע קריאה ל-API החיפוש
      // זוהי דוגמה - יש להתאים ל-logic הקיים ב-useProductSearch
      const searchData = {
        productId: cartItem.productId,
        title: cartItem.title,
        imgUrl: cartItem.imageUrl,
        price: cartItem.price,
      };

      // שליחת הודעה ל-sidebar לפתיחת חיפוש
      chrome.runtime.sendMessage({
        type: 'SEARCH_CHEAPER_ALTERNATIVE',
        product: searchData,
      });

      return { 
        success: true, 
        message: 'Search initiated',
        product: searchData,
      };
    } catch (error) {
      console.error('[useCart] Failed to find cheaper alternative:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * מחשב חיסכון פוטנציאלי מבוסס על תוצאות חיפוש
   */
  const calculatePotentialSavings = useCallback((cartItem, searchResults) => {
    if (!cartItem?.price || !searchResults?.length) {
      return { amount: 0, percent: 0 };
    }

    const currentPrice = cartItem.price * (cartItem.quantity || 1);
    
    // מוצא את המחיר הזול ביותר בתוצאות
    const cheapestResult = searchResults.reduce((min, item) => {
      const itemPrice = item.priceValue || extractPrice(item.price);
      return itemPrice < min ? itemPrice : min;
    }, Infinity);

    if (cheapestResult === Infinity || cheapestResult >= currentPrice) {
      return { amount: 0, percent: 0 };
    }

    const savings = currentPrice - cheapestResult;
    const percent = Math.round((savings / currentPrice) * 100);

    return { amount: savings, percent };
  }, []);

  /**
   * בודק האם יש מוצרים בסל
   */
  const hasItems = cartData.itemCount > 0;

  /**
   * מחזיר את סך כל המחירים בסל
   */
  const totalCartValue = cartData.orderAmount;

  return {
    // State
    cartData,
    isLoading,
    lastUpdate,
    hasItems,
    totalCartValue,
    itemCount: cartData.itemCount,
    cartItems: cartData.cartItems,
    isCartPage: cartData.isCartPage,

    // Actions
    findCheaperAlternative,
    calculatePotentialSavings,
    refreshCartData: () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_CART_DATA' });
        }
      });
    },
  };
}

/**
 * עוזר לחילוץ מחיר ממחרוזת
 */
function extractPrice(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return 0;
  const match = priceStr.match(/[\d,.]+/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
}
