import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import CouponCard from './CouponCard';
import { 
  fetchActiveCoupons, 
  copyCouponToClipboard,
  isCartOrCheckoutPage,
  extractCartAmount,
  detectCategoryFromProduct,
} from '../services/coupons';

/**
 * CouponList Component
 * רשימת קופונים לסיידבר
 * 
 * תכונות:
 * - זיהוי אוטומטי של דף עגלה/תשלום
 * - הצגת קופונים רלוונטיים לפי קטגוריה וסכום
 * - התראה עדינה כשנמצאו קופונים
 * - חישוב חיסכון כולל
 */

export default function CouponList({ 
  productTitle = '', 
  currentUrl = '',
  isCartPage: propIsCartPage,
  orderAmount: propOrderAmount,
  compact = false,
  maxCoupons = 5,
}) {
  const { t } = useTranslation();
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartPage, setIsCartPage] = useState(propIsCartPage || false);
  const [orderAmount, setOrderAmount] = useState(propOrderAmount || 0);
  const [totalSavings, setTotalSavings] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // זיהוי דף עגלה וסכום
  useEffect(() => {
    const detectCartState = () => {
      const url = currentUrl || window.location.href;
      const isCart = propIsCartPage !== undefined ? propIsCartPage : isCartOrCheckoutPage(url);
      setIsCartPage(isCart);

      if (isCart) {
        const amount = propOrderAmount || extractCartAmount();
        setOrderAmount(amount);
      }
    };

    detectCartState();

    // האזנה לשינויים בדף
    const observer = new MutationObserver(detectCartState);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [currentUrl, propIsCartPage, propOrderAmount]);

  // משיכת קופונים
  useEffect(() => {
    const loadCoupons = async () => {
      setIsLoading(true);

      const category = detectCategoryFromProduct(productTitle, currentUrl);
      const isNewUser = !localStorage.getItem('ALISMART_RETURNING_USER');

      const activeCoupons = await fetchActiveCoupons({
        category,
        orderAmount,
        isNewUser,
      });

      setCoupons(activeCoupons);

      // חישוב חיסכון כולל מקופון הטוב ביותר
      if (activeCoupons.length > 0) {
        const bestSavings = Math.max(...activeCoupons.map(c => c.estimatedSavings));
        setTotalSavings(bestSavings);
      }

      setIsLoading(false);

      // סימון משתמש כחוזר אחרי הטעינה הראשונה
      if (!isNewUser) {
        localStorage.setItem('ALISMART_RETURNING_USER', 'true');
      }
    };

    loadCoupons();
  }, [productTitle, currentUrl, orderAmount]);

  // העתקת קופון
  const handleCopyCoupon = useCallback(async (code) => {
    const success = await copyCouponToClipboard(code);
    
    if (success && isCartPage) {
      // ניסיון להחיל את הקופון אוטומטית בדף האלייאקספרס
      attemptAutoApply(code);
    }

    return success;
  }, [isCartPage]);

  // ניסיון החלת קופון אוטומטית
  const attemptAutoApply = (code) => {
    try {
      // חיפוש שדה הקופון בדף
      const couponInput = document.querySelector(
        'input[placeholder*="coupon"], input[placeholder*="promo"], input[placeholder*="קוד"], input[name*="coupon"]'
      );

      if (couponInput) {
        couponInput.value = code;
        couponInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // חיפוש כפתור החל
        const applyButton = couponInput.closest('form')?.querySelector('button') ||
                             document.querySelector('button:contains("Apply"), button:contains("החל")');
        
        if (applyButton) {
          setTimeout(() => applyButton.click(), 100);
        }
      }
    } catch (e) {
      // אוטו-אפליי לא קריטי
    }
  };

  // מצב טעינה
  if (isLoading) {
    return (
      <div style={loadingStyles}>
        <div style={loadingSpinnerStyles} />
        <span style={loadingTextStyles}>{t('coupon.searching', 'Searching for coupons...')}</span>
      </div>
    );
  }

  // אין קופונים זמינים
  if (coupons.length === 0) {
    return null; // לא מציג כלום אם אין קופונים
  }

  // מצב קומפקטי - רק הקופון הטוב ביותר
  if (compact) {
    const bestCoupon = coupons[0];
    return (
      <div style={compactContainerStyles}>
        <div style={compactHeaderStyles}>
          <span style={savingsBadgeStyles}>💰 {t('coupon.saveUpTo', 'Save up to')} {bestCoupon.formattedSavings}</span>
        </div>
        <CouponCard 
          coupon={bestCoupon} 
          onCopy={handleCopyCoupon} 
          compact={true}
        />
      </div>
    );
  }

  // רשימה מלאה
  const displayCoupons = expanded ? coupons : coupons.slice(0, maxCoupons);
  const applicableCoupons = coupons.filter(c => c.isApplicable);
  const nonApplicableCoupons = coupons.filter(c => !c.isApplicable);

  return (
    <div style={containerStyles}>
      {/* כותרת עם התראה */}
      <div style={headerStyles}>
        <div style={headerLeftStyles}>
          <div style={iconStyles}>🎟️</div>
          <div>
            <h4 style={titleStyles}>
              {isCartPage 
                ? t('coupon.foundForOrder', 'Found {{count}} coupons for your order!', { count: coupons.length })
                : t('coupon.availableCodes', '{{count}} coupon codes available', { count: coupons.length })
              }
            </h4>
            {totalSavings > 0 && (
              <p style={subtitleStyles}>
                {t('coupon.potentialSavings', 'Potential savings: {{amount}}', { amount: `$${totalSavings.toFixed(2)}` })}
              </p>
            )}
          </div>
        </div>
        
        {isCartPage && (
          <div style={pulseBadgeStyles}>
            {t('coupon.applyNow', 'Apply Now')}
          </div>
        )}
      </div>

      {/* קופונים ישימים */}
      {applicableCoupons.length > 0 && (
        <div style={sectionStyles}>
          <p style={sectionTitleStyles}>{t('coupon.bestForYou', 'Best for you')}</p>
          <div style={listStyles}>
            {applicableCoupons.slice(0, expanded ? undefined : 3).map((coupon, index) => (
              <CouponCard 
                key={coupon.id}
                coupon={coupon}
                onCopy={handleCopyCoupon}
              />
            ))}
          </div>
        </div>
      )}

      {/* קופונים לא ישימים עדיין */}
      {nonApplicableCoupons.length > 0 && (
        <div style={sectionStyles}>
          <p style={sectionTitleStylesSecondary}>
            {t('coupon.moreAvailable', '{{count}} more available', { count: nonApplicableCoupons.length })}
          </p>
          <div style={listStyles}>
            {nonApplicableCoupons.map((coupon) => (
              <CouponCard 
                key={coupon.id}
                coupon={coupon}
                onCopy={handleCopyCoupon}
              />
            ))}
          </div>
        </div>
      )}

      {/* כפתור הרחבה */}
      {coupons.length > maxCoupons && !expanded && (
        <button 
          onClick={() => setExpanded(true)}
          style={expandButtonStyles}
        >
          {t('coupon.showAll', 'Show all {{count}} coupons', { count: coupons.length })}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* טיפ */}
      {isCartPage && (
        <div style={tipStyles}>
          <span style={tipIconStyles}>💡</span>
          <span style={tipTextStyles}>{t('coupon.tip', 'Copy the code and paste it at checkout')}</span>
        </div>
      )}
    </div>
  );
}

// Styles
const containerStyles = {
  padding: '16px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
};

const headerStyles = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: '16px',
  paddingBottom: '12px',
  borderBottom: '1px solid #f3f4f6',
};

const headerLeftStyles = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
};

const iconStyles = {
  fontSize: '24px',
  lineHeight: 1,
};

const titleStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#1f2937',
  margin: '0 0 4px 0',
};

const subtitleStyles = {
  fontSize: '12px',
  color: '#22c55e',
  fontWeight: 500,
  margin: 0,
};

const pulseBadgeStyles = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#ee0979',
  backgroundColor: '#fef2f2',
  padding: '6px 12px',
  borderRadius: '20px',
  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
};

const sectionStyles = {
  marginBottom: '16px',
};

const sectionTitleStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  margin: '0 0 10px 0',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const sectionTitleStylesSecondary = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#9ca3af',
  margin: '0 0 10px 0',
};

const listStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const expandButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px dashed #d1d5db',
  backgroundColor: '#f9fafb',
  color: '#6b7280',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const tipStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 12px',
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  marginTop: '12px',
};

const tipIconStyles = {
  fontSize: '16px',
};

const tipTextStyles = {
  fontSize: '12px',
  color: '#3b82f6',
};

// Compact styles
const compactContainerStyles = {
  padding: '12px',
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
};

const compactHeaderStyles = {
  marginBottom: '10px',
};

const savingsBadgeStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#22c55e',
  backgroundColor: '#f0fdf4',
  padding: '4px 10px',
  borderRadius: '20px',
};

// Loading styles
const loadingStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '20px',
};

const loadingSpinnerStyles = {
  width: '20px',
  height: '20px',
  border: '2px solid #f3f4f6',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const loadingTextStyles = {
  fontSize: '13px',
  color: '#6b7280',
};
