import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatCurrency';
import { cleanProductUrl } from '../utils/cleanUrl';
import { checkForFigures } from '../utils/privacyCheck';

/**
 * ProductCard Component
 * כרטיס מוצר גלובלי עם תמיכה בריבוי שפות
 * 
 * תכונות:
 * - פורמט מטבע דינמי לפי שפה
 * - Trust Score עם פרוגרס-בר
 * - Privacy Mode (blur לתמונות עם דמויות)
 * - עיצוב "Quiet Luxury" עם gradient
 * - ניקוי URL מפרמטרי מעקב
 */

export default function ProductCard({ 
  product, 
  index, 
  sourceProduct,
  onViewDeal,
  onFavoriteToggle,
  onFindSimilar,
  isFavorite,
  isBestDeal = false 
}) {
  const { t, i18n } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [imageBlurred, setImageBlurred] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSearchingSimilar, setIsSearchingSimilar] = useState(false);

  const currentLang = i18n.language;
  const currency = product.currency || 'USD';

  // בדיקת פרטיות תמונה בעת טעינה
  useEffect(() => {
    if (product.product_main_image_url || product.imageUrl) {
      checkForFigures(product.product_main_image_url || product.imageUrl)
        .then(hasFigures => {
          if (hasFigures) {
            setImageBlurred(true);
          }
        })
        .catch(() => {
          // במקרה של שגיאה, לא מטשטשים
          setImageBlurred(false);
        });
    }
  }, [product.product_main_image_url, product.imageUrl]);

  // חישוב נתוני מוצר
  const price = product.priceValue || extractPrice(product.price);
  const originalPrice = product.original_price ? extractPrice(product.original_price) : null;
  const discount = originalPrice && originalPrice > price 
    ? Math.round(((originalPrice - price) / originalPrice) * 100) 
    : null;

  // Trust Score
  const rating = parseFloat(product.rating || product.evaluate_rate || 0);
  const orders = parseInt(product.orders || product.sales || 0);
  const trustScore = calculateTrustScore(rating, orders);
  const trustLevel = getTrustLevel(trustScore);

  // עיצוב מחיר לפי שפה
  const formattedPrice = formatCurrency(price, currency, currentLang);
  const formattedOriginalPrice = originalPrice 
    ? formatCurrency(originalPrice, currency, currentLang) 
    : null;

  // ניקוי URL
  const rawUrl = product.product_detail_url || product.url || 
                 `https://www.aliexpress.com/item/${product.productId}.html`;
  const cleanUrl = cleanProductUrl(rawUrl);

  // טיפול בלחיצה על צפייה במוצר
  const handleViewDeal = () => {
    onViewDeal?.({ ...product, cleanUrl });
    window.open(cleanUrl, '_blank', 'noopener,noreferrer');
  };

  // טיפול בלחיצה על מועדפים
  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    onFavoriteToggle?.(product);
  };

  // טיפול בלחיצה על חיפוש דומים
  const handleFindSimilar = async (e) => {
    e.stopPropagation();
    
    const imageUrl = product.product_main_image_url || product.imageUrl || product.img;
    if (!imageUrl || !onFindSimilar) return;
    
    setIsSearchingSimilar(true);
    
    try {
      await onFindSimilar({
        ...product,
        imgUrl: imageUrl,
        title: product.product_title || product.title,
      });
    } finally {
      setIsSearchingSimilar(false);
    }
  };

  // הסרת blur בלחיצה (אם המשתמש רוצה לראות)
  const handleImageClick = () => {
    if (imageBlurred) {
      setImageBlurred(false);
    }
  };

  return (
    <div
      className="als-product-card-global"
      style={{
        ...cardStyles,
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 8px 24px rgba(0, 0, 0, 0.12)' 
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badge - Best Deal */}
      {isBestDeal && (
        <div style={bestDealBadgeStyles}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          {t('product.bestDeal')}
        </div>
      )}

      {/* Rank Badge */}
      {index < 3 && (
        <div style={rankBadgeStyles(index)}>
          #{index + 1}
        </div>
      )}

      {/* Image Section */}
      <div style={imageContainerStyles}>
        <div style={imageWrapperStyles}>
          <img
            src={product.product_main_image_url || product.imageUrl || product.img}
            alt={product.product_title || product.title || 'Product'}
            style={{
              ...imageStyles,
              filter: imageBlurred ? 'blur(8px)' : 'none',
              opacity: imageLoaded ? 1 : 0,
            }}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.style.backgroundColor = '#f3f4f6';
            }}
          />
          
          {/* Privacy Blur Indicator */}
          {imageBlurred && (
            <div style={privacyOverlayStyles} onClick={handleImageClick}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
              <span style={privacyTextStyles}>Privacy Mode</span>
              <span style={privacySubtextStyles}>Click to reveal</span>
            </div>
          )}
          
          {/* Loading Skeleton */}
          {!imageLoaded && !imageBlurred && (
            <div style={skeletonStyles} />
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          style={{
            ...favoriteButtonStyles,
            color: isFavorite ? '#ee0979' : '#9ca3af',
            backgroundColor: isFavorite ? 'rgba(238, 9, 121, 0.1)' : 'white',
          }}
          aria-label={isFavorite ? t('product.removeFromFavorites') : t('product.addToFavorites')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>

        {/* Find Similar Button - appears on hover */}
        {onFindSimilar && (
          <button
            onClick={handleFindSimilar}
            disabled={isSearchingSimilar}
            style={{
              ...findSimilarButtonStyles,
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? 'translateY(0)' : 'translateY(10px)',
              pointerEvents: isHovered ? 'auto' : 'none',
            }}
            title={t('product.findSimilar', 'Find similar items')}
            aria-label={t('product.findSimilar', 'Find similar items')}
          >
            {isSearchingSimilar ? (
              <div style={miniSpinnerStyles} />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="8" height="8" rx="1" />
                  <rect x="13" y="13" width="8" height="8" rx="1" />
                  <path d="M11 7h2a2 2 0 0 1 2 2v2" />
                  <path d="M7 11v2a2 2 0 0 0 2 2h2" />
                </svg>
                <span style={findSimilarTextStyles}>{t('product.findSimilar')}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Content Section */}
      <div style={contentStyles}>
        {/* Title */}
        <h3 style={titleStyles}>
          {(product.product_title || product.title || 'Product')
            .substring(0, currentLang === 'he' ? 50 : 70)}
          {(product.product_title || product.title || '').length > (currentLang === 'he' ? 50 : 70) ? '...' : ''}
        </h3>

        {/* Trust Score Bar */}
        <div style={trustContainerStyles}>
          <div style={trustHeaderStyles}>
            <span style={trustLabelStyles(trustLevel.color)}>
              {t(`product.trust.${trustLevel.key}`)}
            </span>
            <span style={trustScoreStyles}>{trustScore}%</span>
          </div>
          <div style={trustBarContainerStyles}>
            <div 
              style={{
                ...trustBarStyles,
                width: `${trustScore}%`,
                backgroundColor: trustLevel.color,
              }} 
            />
          </div>
          {rating > 0 && (
            <div style={ratingRowStyles}>
              <span style={starsStyles}>{'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}</span>
              <span style={ratingTextStyles}>{rating.toFixed(1)}</span>
              {orders > 0 && (
                <span style={ordersStyles}>
                  ({t('product.orders', { count: orders.toLocaleString() })})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Price Section */}
        <div style={priceContainerStyles}>
          <div style={priceRowStyles}>
            <span style={currentPriceStyles}>{formattedPrice}</span>
            {formattedOriginalPrice && (
              <span style={originalPriceStyles}>{formattedOriginalPrice}</span>
            )}
          </div>
          
          {discount && (
            <div style={savingsBadgeStyles}>
              {t('product.savings', { percent: discount })}
            </div>
          )}
        </div>

        {/* View Deal Button */}
        <button
          onClick={handleViewDeal}
          style={{
            ...viewDealButtonStyles,
            opacity: isHovered ? 1 : 0.9,
            transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          <span>{t('product.viewProduct')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * חישוב Trust Score לפי דירוג וכמות הזמנות
 */
function calculateTrustScore(rating, orders) {
  const ratingScore = Math.min((rating / 5) * 60, 60); // עד 60 נקודות על דירוג
  const ordersScore = Math.min((orders / 1000) * 40, 40); // עד 40 נקודות על הזמנות
  return Math.round(ratingScore + ordersScore);
}

/**
 * קבלת רמת אמון לפי ציון
 */
function getTrustLevel(score) {
  if (score >= 80) return { key: 'high', color: '#22c55e' };
  if (score >= 50) return { key: 'medium', color: '#f59e0b' };
  return { key: 'low', color: '#9ca3af' };
}

/**
 * חילוץ ערך מחיר
 */
function extractPrice(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return 0;
  const match = priceStr.match(/[\d,.]+/);
  return match ? parseFloat(match[0].replace(',', '')) : 0;
}

// Styles
const cardStyles = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
  position: 'relative',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

const bestDealBadgeStyles = {
  position: 'absolute',
  top: '12px',
  left: '12px',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  color: 'white',
  fontSize: '11px',
  fontWeight: 700,
  borderRadius: '20px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  boxShadow: '0 2px 8px rgba(238, 9, 121, 0.3)',
};

const rankBadgeStyles = (index) => ({
  position: 'absolute',
  top: '12px',
  right: '12px',
  zIndex: 10,
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 800,
  color: index === 0 ? '#1a1a2e' : index === 1 ? '#374151' : '#4b5563',
  background: index === 0 
    ? 'linear-gradient(135deg, #ffd700, #ffaa00)' 
    : index === 1 
      ? 'linear-gradient(135deg, #e5e7eb, #d1d5db)' 
      : 'linear-gradient(135deg, #fde68a, #fcd34d)',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
});

const imageContainerStyles = {
  position: 'relative',
  padding: '12px',
  backgroundColor: '#f9fafb',
};

const imageWrapperStyles = {
  position: 'relative',
  width: '100%',
  aspectRatio: '1',
  borderRadius: '12px',
  overflow: 'hidden',
  backgroundColor: '#f3f4f6',
};

const imageStyles = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transition: 'all 0.3s ease',
};

const privacyOverlayStyles = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  cursor: 'pointer',
  gap: '4px',
};

const privacyTextStyles = {
  color: 'white',
  fontSize: '12px',
  fontWeight: 600,
};

const privacySubtextStyles = {
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '10px',
};

const skeletonStyles = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

const favoriteButtonStyles = {
  position: 'absolute',
  bottom: '20px',
  right: '20px',
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  transition: 'all 0.2s ease',
};

const contentStyles = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const titleStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#1f2937',
  lineHeight: 1.4,
  margin: 0,
  minHeight: '40px',
};

const trustContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const trustHeaderStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const trustLabelStyles = (color) => ({
  fontSize: '11px',
  fontWeight: 600,
  color: color,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

const trustScoreStyles = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#6b7280',
};

const trustBarContainerStyles = {
  height: '4px',
  backgroundColor: '#e5e7eb',
  borderRadius: '2px',
  overflow: 'hidden',
};

const trustBarStyles = {
  height: '100%',
  borderRadius: '2px',
  transition: 'width 0.5s ease',
};

const ratingRowStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
};

const starsStyles = {
  color: '#fbbf24',
  letterSpacing: '-1px',
};

const ratingTextStyles = {
  fontWeight: 600,
  color: '#374151',
};

const ordersStyles = {
  color: '#9ca3af',
};

const priceContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const priceRowStyles = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
};

const currentPriceStyles = {
  fontSize: '20px',
  fontWeight: 800,
  color: '#ee0979',
  letterSpacing: '-0.5px',
};

const originalPriceStyles = {
  fontSize: '14px',
  fontWeight: 500,
  color: '#9ca3af',
  textDecoration: 'line-through',
};

const savingsBadgeStyles = {
  display: 'inline-flex',
  padding: '4px 10px',
  backgroundColor: '#dcfce7',
  color: '#166534',
  fontSize: '11px',
  fontWeight: 700,
  borderRadius: '6px',
  width: 'fit-content',
};

const viewDealButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 20px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  marginTop: '4px',
};

const findSimilarButtonStyles = {
  position: 'absolute',
  bottom: '62px',
  right: '20px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  backgroundColor: 'white',
  color: '#6b7280',
  border: '1px solid #e5e7eb',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  transition: 'all 0.3s ease',
};

const findSimilarTextStyles = {
  fontSize: '11px',
};

const miniSpinnerStyles = {
  width: '14px',
  height: '14px',
  border: '2px solid #e5e7eb',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};
