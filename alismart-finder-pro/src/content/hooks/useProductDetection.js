import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook: useProductDetection
 * זיהוי מוצרים בדף באמצעות MutationObserver
 * עם debounce לביצועים ומניעת עומס על ה-DOM
 * 
 * @param {Function} onProductFound - קולבק שיופעל כשמוצר נמצא
 * @param {Object} options - אפשרויות
 * @returns {Object} פונקציות שליטה
 */

export function useProductDetection(onProductFound, options = {}) {
  const {
    debounceMs = 100,
    scanInterval = 2000,
    maxProducts = 1000
  } = options;
  
  const observerRef = useRef(null);
  const scanTimerRef = useRef(null);
  const processedCountRef = useRef(0);
  const isActiveRef = useRef(true);

  /**
   * בדיקת תקינות אלמנט מוצר
   */
  const isValidProductCard = useCallback((element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    
    // בדיקת מימדים
    const rect = element.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return false;
    if (rect.width > 600 || rect.height > 600) return false;
    
    // חייב להכיל תמונה או לינק למוצר
    const hasImage = element.querySelector('img') !== null;
    const hasProductLink = element.querySelector('a[href*="/item/"]') !== null;
    
    return hasImage || hasProductLink;
  }, []);

  /**
   * סורק את הדף למוצרים
   */
  const scanForProducts = useCallback(() => {
    if (!isActiveRef.current) return;
    if (processedCountRef.current >= maxProducts) return;
    
    const PRODUCT_SELECTORS = [
      '[data-pl]',
      '[data-product-id]',
      '.search-item',
      '.search-card-item',
      '.list-item',
      '.product-item',
      '.product-card',
      '[class*="ProductCard"]',
      '.grid-item',
      '[class*="gallery-item"]',
      '.item[role="listitem"]',
      'a[href*="/item/"]',
      '[class*="ProductContainer"]',
      '[class*="SearchProductContent"]'
    ];
    
    const candidates = [];
    
    // איסוף מועמדים
    PRODUCT_SELECTORS.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (isValidProductCard(el)) {
            candidates.push(el);
          }
        });
      } catch (e) {
        // סלקטור לא תקין
      }
    });
    
    // הסרת כפילויות
    const unique = [...new Set(candidates)];
    
    // קריאה לקולבק עבור כל מוצר חדש
    unique.forEach(el => {
      if (processedCountRef.current < maxProducts) {
        processedCountRef.current++;
        onProductFound?.(el);
      }
    });
    
    if (unique.length > 0) {
      console.log('[AliSmart] Scan found', unique.length, 'products (total:', processedCountRef.current, ')');
    }
  }, [isValidProductCard, onProductFound, maxProducts]);

  /**
   * Debounced scan
   */
  const debouncedScan = useCallback(() => {
    clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(scanForProducts, debounceMs);
  }, [scanForProducts, debounceMs]);

  /**
   * הפעלת זיהוי
   */
  const startDetection = useCallback(() => {
    if (observerRef.current) return;
    
    isActiveRef.current = true;
    
    // סריקה ראשונית
    scanForProducts();
    
    // הגדרת MutationObserver
    observerRef.current = new MutationObserver((mutations) => {
      let hasNewProducts = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // בדיקה אם ה-node מכיל מוצרים
            const isProduct = 
              node.matches?.('[data-pl], [data-product-id], .search-item, .product-card') ||
              node.querySelector?.('[data-pl], [data-product-id], .search-item, .product-card');
            
            if (isProduct) {
              hasNewProducts = true;
            }
          }
        });
      });
      
      if (hasNewProducts) {
        debouncedScan();
      }
    });
    
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[AliSmart] Product detection started');
  }, [scanForProducts, debouncedScan]);

  /**
   * עצירת זיהוי
   */
  const stopDetection = useCallback(() => {
    isActiveRef.current = false;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    
    clearTimeout(scanTimerRef.current);
    
    console.log('[AliSmart] Product detection stopped');
  }, []);

  /**
   * ניקוי
   */
  const reset = useCallback(() => {
    processedCountRef.current = 0;
  }, []);

  // ניהול מחזור החיים
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    startDetection,
    stopDetection,
    scanForProducts,
    reset,
    getCount: () => processedCountRef.current
  };
}
