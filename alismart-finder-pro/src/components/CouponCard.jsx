import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * CouponCard Component
 * קומפוננטת כרטיס קופון עם עיצוב "תלוש גזירה"
 * 
 * תכונות:
 * - גבול מקווקו (dashed border) למראה קופון
 * - כפתור "העתק והחל" עם אנימציית הצלחה
 * - הצגת חיסכון משוער
 * - שקיפות לגבי תנאי השימוש
 */

export default function CouponCard({ coupon, onCopy, compact = false }) {
  const { t, i18n } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isRTL = i18n.language === 'he';

  const handleCopy = useCallback(async () => {
    const success = await onCopy(coupon.code);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [coupon.code, onCopy]);

  // קביעת צבע לפי סוג הקופון
  const getCouponColor = () => {
    if (coupon.discountType === 'shipping') return '#22c55e'; // ירוק - משלוח
    if (coupon.isVIP) return '#8b5cf6'; // סגול - VIP
    if (coupon.isNewUser) return '#f59e0b'; // כתום - משתמש חדש
    return '#ee0979'; // ורוד - רגיל
  };

  const couponColor = getCouponColor();
  const isApplicable = coupon.isApplicable !== false;

  if (compact) {
    // מצב קומפקטי לרשימה
    return (
      <div 
        style={{
          ...compactStyles,
          opacity: isApplicable ? 1 : 0.6,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={compactCodeStyles(couponColor)}>
          <span style={codeTextStyles}>{coupon.code}</span>
        </div>
        <div style={compactInfoStyles}>
          <span style={compactSavingsStyles(couponColor)}>
            {coupon.formattedSavings}
          </span>
          <button 
            onClick={handleCopy}
            style={compactCopyButtonStyles(isCopied, couponColor)}
            disabled={!isApplicable}
          >
            {isCopied ? '✓' : '📋'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      style={{
        ...containerStyles,
        borderColor: couponColor,
        opacity: isApplicable ? 1 : 0.7,
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* חלק שמאלי - הקוד */}
      <div style={codeSectionStyles(couponColor)}>
        <span style={dashedBorderStyles(isRTL ? 'right' : 'left')} />
        <div style={codeContainerStyles}>
          <span style={couponCodeStyles}>{coupon.code}</span>
          {coupon.isNewUser && (
            <span style={badgeStyles('#f59e0b')}>{t('coupon.newUser', 'New User')}</span>
          )}
          {coupon.isVIP && (
            <span style={badgeStyles('#8b5cf6')}>VIP</span>
          )}
          {coupon.discountType === 'shipping' && (
            <span style={badgeStyles('#22c55e')}>{t('coupon.freeShipping', 'Free Shipping')}</span>
          )}
        </div>
        <span style={dashedBorderStyles(isRTL ? 'right' : 'left')} />
      </div>

      {/* קו מקווקו - "גזירה" */}
      <div style={tearLineStyles}>
        <div style={holeStyles} />
        <div style={dashedLineStyles(couponColor)} />
        <div style={holeStyles} />
      </div>

      {/* חלק ימני - פרטים */}
      <div style={detailsSectionStyles}>
        <p style={descriptionStyles}>
          {isRTL ? coupon.descriptionHe || coupon.description : coupon.description}
        </p>

        {/* חיסכון משוער */}
        {coupon.estimatedSavings > 0 && (
          <div style={savingsContainerStyles}>
            <span style={savingsLabelStyles}>{t('coupon.save', 'Save')}:</span>
            <span style={savingsAmountStyles(couponColor)}>
              {coupon.formattedSavings}
            </span>
          </div>
        )}

        {/* תנאים */}
        <div style={conditionsStyles}>
          {coupon.minOrder > 0 && (
            <span style={conditionItemStyles}>
              {t('coupon.minOrder', 'Min.')} ${coupon.minOrder}
            </span>
          )}
          {coupon.maxDiscount && (
            <span style={conditionItemStyles}>
              {t('coupon.max', 'Max')} ${coupon.maxDiscount}
            </span>
          )}
        </div>

        {/* כפתור העתקה */}
        <button
          onClick={handleCopy}
          style={copyButtonStyles(isCopied, couponColor)}
          disabled={!isApplicable}
        >
          {isCopied ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{t('coupon.copied', 'Copied!')}</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{t('coupon.copyApply', 'Copy & Apply')}</span>
            </>
          )}
        </button>

        {!isApplicable && coupon.minOrder > 0 && (
          <p style={warningStyles}>
            {t('coupon.needMore', 'Need ${{amount}} more', { amount: coupon.minOrder - (coupon.orderAmount || 0) })}
          </p>
        )}
      </div>

      {/* אנימציית הצלחה */}
      {isCopied && (
        <div style={successOverlayStyles}>
          <div style={successAnimationStyles}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={couponColor} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p style={successTextStyles}>{t('coupon.codeCopied', 'Code copied!')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const containerStyles = {
  display: 'flex',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '2px dashed',
  overflow: 'hidden',
  position: 'relative',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
};

const codeSectionStyles = (color) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '16px 12px',
  backgroundColor: `${color}10`,
  minWidth: '100px',
});

const codeContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
};

const dashedBorderStyles = (side) => ({
  width: '4px',
  height: '20px',
  backgroundImage: `radial-gradient(circle, #e5e7eb 2px, transparent 2px)`,
  backgroundSize: '4px 8px',
  backgroundRepeat: 'repeat-y',
  backgroundPosition: side === 'left' ? 'right' : 'left',
});

const couponCodeStyles = {
  fontFamily: 'monospace',
  fontSize: '14px',
  fontWeight: 700,
  color: '#1f2937',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const badgeStyles = (color) => ({
  fontSize: '9px',
  fontWeight: 600,
  color: color,
  backgroundColor: `${color}15`,
  padding: '2px 6px',
  borderRadius: '4px',
  textTransform: 'uppercase',
});

const tearLineStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  position: 'relative',
  backgroundColor: '#ffffff',
};

const holeStyles = {
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  backgroundColor: '#f3f4f6',
  margin: '-6px 0',
  zIndex: 1,
};

const dashedLineStyles = (color) => ({
  flex: 1,
  width: '0',
  borderLeft: `2px dashed ${color}40`,
  margin: '4px 0',
});

const detailsSectionStyles = {
  flex: 1,
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const descriptionStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  margin: 0,
  lineHeight: 1.4,
};

const savingsContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const savingsLabelStyles = {
  fontSize: '11px',
  color: '#6b7280',
  fontWeight: 500,
};

const savingsAmountStyles = (color) => ({
  fontSize: '16px',
  fontWeight: 700,
  color: color,
});

const conditionsStyles = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const conditionItemStyles = {
  fontSize: '10px',
  color: '#9ca3af',
  backgroundColor: '#f3f4f6',
  padding: '2px 8px',
  borderRadius: '4px',
};

const copyButtonStyles = (isCopied, color) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '10px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: isCopied ? '#22c55e' : color,
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: isCopied ? 'default' : 'pointer',
  transition: 'all 0.2s ease',
  marginTop: '4px',
});

const warningStyles = {
  fontSize: '11px',
  color: '#f59e0b',
  margin: 0,
  marginTop: '4px',
};

const successOverlayStyles = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'fadeIn 0.2s ease',
  borderRadius: '12px',
};

const successAnimationStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  animation: 'scaleIn 0.3s ease',
};

const successTextStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#22c55e',
  margin: 0,
};

// Compact styles
const compactStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px dashed #e5e7eb',
  transition: 'all 0.2s ease',
};

const compactCodeStyles = (color) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontFamily: 'monospace',
  fontSize: '12px',
  fontWeight: 700,
  color: color,
  letterSpacing: '0.5px',
});

const codeTextStyles = {
  backgroundColor: '#f3f4f6',
  padding: '4px 8px',
  borderRadius: '4px',
};

const compactInfoStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const compactSavingsStyles = (color) => ({
  fontSize: '13px',
  fontWeight: 700,
  color: color,
});

const compactCopyButtonStyles = (isCopied, color) => ({
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: isCopied ? '#22c55e' : color,
  color: '#ffffff',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
});
