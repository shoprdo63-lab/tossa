import { useState, useEffect, useCallback } from 'react';
import { 
  fetchActiveCoupons, 
  copyCouponToClipboard,
  isCartOrCheckoutPage,
  extractCartAmount,
  detectCategoryFromProduct,
} from '../services/coupons';

/**
 * useCoupons Hook
 * ניהול קופונים - זיהוי אוטומטי וחישוב חיסכון
 * 
 * תכונות:
 * - זיהוי אוטומטי של דף עגלה/תשלום
 * - חישוב קופונים רלוונטיים
 * - העתקה ללוח
 * - חישוב חיסכון כולל
 */

export function useCoupons(options = {}) {
  const { 
    productTitle = '', 
    currentUrl = '',
    autoDetect = true,
  } = options;

  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCartPage, setIsCartPage] = useState(false);
  const [orderAmount, setOrderAmount] = useState(0);
  const [bestCoupon, setBestCoupon] = useState(null);
  const [totalPotentialSavings, setTotalPotentialSavings] = useState(0);
  const [lastCopied, setLastCopied] = useState(null);

  /**
   * זיהוי מצב העגלה
   */
  useEffect(() => {
    if (!autoDetect) return;

    const detectCartState = () => {
      const url = currentUrl || window.location.href;
      const cartDetected = isCartOrCheckoutPage(url);
      setIsCartPage(cartDetected);

      if (cartDetected) {
        const amount = extractCartAmount();
        setOrderAmount(amount);
      }
    };

    detectCartState();

    // האזנה לשינויים ב-URL
    const handleUrlChange = () => detectCartState();
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [currentUrl, autoDetect]);

  /**
   * טעינת קופונים
   */
  const loadCoupons = useCallback(async (forceOrderAmount = null) => {
    setIsLoading(true);

    try {
      const category = detectCategoryFromProduct(productTitle, currentUrl);
      const isNewUser = !localStorage.getItem('ALISMART_RETURNING_USER');
      const amount = forceOrderAmount !== null ? forceOrderAmount : orderAmount;

      const activeCoupons = await fetchActiveCoupons({
        category,
        orderAmount: amount,
        isNewUser,
      });

      setCoupons(activeCoupons);

      // מציאת הקופון הטוב ביותר
      if (activeCoupons.length > 0) {
        const applicable = activeCoupons.filter(c => c.isApplicable);
        if (applicable.length > 0) {
          const best = applicable.reduce((max, c) => 
            c.estimatedSavings > max.estimatedSavings ? c : max
          );
          setBestCoupon(best);
          setTotalPotentialSavings(best.estimatedSavings);
        } else {
          setBestCoupon(activeCoupons[0]);
          setTotalPotentialSavings(0);
        }
      } else {
        setBestCoupon(null);
        setTotalPotentialSavings(0);
      }

      // סימון משתמש כחוזר
      if (!isNewUser) {
        localStorage.setItem('ALISMART_RETURNING_USER', 'true');
      }

      return activeCoupons;
    } catch (error) {
      console.error('[useCoupons] Failed to load coupons:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [productTitle, currentUrl, orderAmount]);

  // טעינה אוטומטית
  useEffect(() => {
    if (autoDetect) {
      loadCoupons();
    }
  }, [loadCoupons, autoDetect]);

  /**
   * העתקת קופון
   */
  const copyCoupon = useCallback(async (code) => {
    const success = await copyCouponToClipboard(code);
    
    if (success) {
      setLastCopied(code);
      
      // ניסיון החלה אוטומטית בדף עגלה
      if (isCartPage) {
        attemptAutoApply(code);
      }
      
      // ניקוי מצב אחרי 2 שניות
      setTimeout(() => setLastCopied(null), 2000);
    }

    return success;
  }, [isCartPage]);

  /**
   * ניסיון החלת קופון אוטומטית
   */
  const attemptAutoApply = (code) => {
    try {
      // חיפוש שדה הקופון
      const selectors = [
        'input[placeholder*="coupon" i]',
        'input[placeholder*="promo" i]',
        'input[placeholder*="קוד" i]',
        'input[name*="coupon" i]',
        'input[data-spm*="coupon"]',
        'input[class*="coupon"]',
      ];

      let couponInput = null;
      for (const selector of selectors) {
        couponInput = document.querySelector(selector);
        if (couponInput) break;
      }

      if (couponInput) {
        // מילוי הקוד
        couponInput.value = code;
        couponInput.dispatchEvent(new Event('input', { bubbles: true }));
        couponInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // חיפוש כפתור החל
        const applyButton = couponInput.closest('div, form')?.querySelector('button');
        
        if (applyButton) {
          setTimeout(() => applyButton.click(), 150);
        }

        return true;
      }
    } catch (e) {
      // שקט - אוטו-אפליי לא קריטי
    }
    return false;
  };

  /**
   * חישוב חיסכון מקופון ספציפי
   */
  const calculateSavings = useCallback((couponCode) => {
    const coupon = coupons.find(c => c.code === couponCode);
    if (!coupon) return 0;
    return calculateEstimatedSavings(coupon, orderAmount);
  }, [coupons, orderAmount]);

  /**
   * בדיקה האם קופון ישים
   */
  const isCouponApplicable = useCallback((couponCode) => {
    const coupon = coupons.find(c => c.code === couponCode);
    if (!coupon) return false;
    return coupon.isApplicable;
  }, [coupons]);

  /**
   * רענון ידני
   */
  const refresh = useCallback(async () => {
    // עדכון סכום העגלה
    if (isCartPage) {
      const newAmount = extractCartAmount();
      setOrderAmount(newAmount);
      return loadCoupons(newAmount);
    }
    return loadCoupons();
  }, [isCartPage, loadCoupons]);

  return {
    // State
    coupons,
    isLoading,
    isCartPage,
    orderAmount,
    bestCoupon,
    totalPotentialSavings,
    lastCopied,
    applicableCoupons: coupons.filter(c => c.isApplicable),
    nonApplicableCoupons: coupons.filter(c => !c.isApplicable),
    hasCoupons: coupons.length > 0,
    
    // Actions
    loadCoupons,
    copyCoupon,
    calculateSavings,
    isCouponApplicable,
    refresh,
  };
}

/**
 * פונקציית עזר לחישוב חיסכון
 */
function calculateEstimatedSavings(coupon, orderAmount) {
  if (orderAmount === 0) return 0;
  if (!coupon.isApplicable) return 0;
  
  if (coupon.discountType === 'percentage') {
    const savings = (orderAmount * coupon.discount) / 100;
    return coupon.maxDiscount ? Math.min(savings, coupon.maxDiscount) : savings;
  }
  
  if (coupon.discountType === 'fixed') {
    return Math.min(coupon.discount, orderAmount);
  }
  
  if (coupon.discountType === 'shipping') {
    return 8; // הערכת משלוח
  }
  
  return 0;
}
