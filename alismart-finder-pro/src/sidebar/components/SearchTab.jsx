import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FilterBar from '../../components/FilterBar';
import SortDropdown from '../../components/SortDropdown';
import NoResults from '../../components/NoResults';
import ProductCard from '../../components/ProductCard';

/**
 * Search Tab Component with Filtering
 * טאב תוצאות החיפוש עם סינון ומיון
 * 
 * תכונות:
 * - מוצר מקור (מה שנלחץ)
 * - שורת סינון צפה (FilterBar)
 * - מיון תוצאות (SortDropdown)
 * - רשימת תוצאות חיפוש עם אנימציות
 * - אינדיקטור טעינה
 * - טיפול במצב ריק (NoResults)
 */

export default function SearchTab({
  results,
  filteredResults,
  filters,
  sortBy,
  currentProduct,
  isLoading,
  onProductClick,
  onFavoriteToggle,
  onFiltersChange,
  onSortChange,
  favorites,
  currency = 'USD',
}) {
  const { t, i18n } = useTranslation();
  const [animatedItems, setAnimatedItems] = useState([]);

  // אנימציית כניסה הדרגתית לתוצאות
  useEffect(() => {
    if (filteredResults && filteredResults.length > 0) {
      setAnimatedItems([]);
      filteredResults.forEach((_, index) => {
        setTimeout(() => {
          setAnimatedItems((prev) => [...prev, index]);
        }, index * 80);
      });
    }
  }, [filteredResults]);

  // בדיקה אם מוצר במועדפים
  const isFavorite = (productId) => {
    return favorites.some((f) => f.productId === productId);
  };

  // עיצוב מחיר
  const formatPrice = (price) => {
    if (!price) return 'לא זמין';
    const match = price.match(/[₪$€£]/);
    const symbol = match ? match[0] : '₪';
    const value = price.match(/[\d,.]+/)?.[0] || '0';
    return `${symbol}${value}`;
  };

  // מצב ריק - אין תוצאות חיפוש בכלל
  if (!results || results.length === 0) {
    return (
      <div style={loadingContainerStyles}>
        <div style={spinnerStyles}>
          <div style={spinnerInnerStyles} />
        </div>
        <p style={loadingTextStyles}>{t('search.loading')}</p>
        <p style={loadingSubtextStyles}>{t('search.loadingSubtitle')}</p>
      </div>
    );
  }

  // מצב ריק - יש תוצאות אבל הסינון מסנן הכל
  const hasActiveFilters = filters && (
    filters.priceMin !== '' || 
    filters.priceMax !== '' || 
    filters.freeShipping || 
    filters.topRated
  );

  if (filteredResults && filteredResults.length === 0 && hasActiveFilters) {
    return (
      <div style={containerStyles}>
        {/* מוצר מקור */}
        {currentProduct && (
          <div style={sourceProductStyles}>
            <p style={sourceLabelStyles}>{t('search.searchingFor')}</p>
            <div style={sourceCardStyles}>
              {currentProduct.imgUrl && (
                <img
                  src={currentProduct.imgUrl}
                  alt=""
                  style={sourceImageStyles}
                  onError={(e) => (e.target.style.display = 'none')}
                />
              )}
              <div style={sourceInfoStyles}>
                <p style={sourceTitleStyles}>
                  {currentProduct.title
                    ? currentProduct.title.substring(0, 60) + (currentProduct.title.length > 60 ? '...' : '')
                    : t('product.unknown', 'Unknown Product')}
                </p>
                {currentProduct.price && (
                  <p style={sourcePriceStyles}>
                    {t('search.currentPrice')} {formatPrice(currentProduct.price)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <FilterBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          resultsCount={0}
          currency={currency}
        />

        <NoResults
          onAdjustFilters={() => {}}
          onClearFilters={() => onFiltersChange?.({
            priceMin: '',
            priceMax: '',
            freeShipping: false,
            topRated: false,
          })}
        />
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* מוצר מקור */}
      {currentProduct && (
        <div style={sourceProductStyles}>
          <p style={sourceLabelStyles}>{t('search.searchingFor')}</p>
          <div style={sourceCardStyles}>
            {currentProduct.imgUrl && (
              <img
                src={currentProduct.imgUrl}
                alt=""
                style={sourceImageStyles}
                onError={(e) => (e.target.style.display = 'none')}
              />
            )}
            <div style={sourceInfoStyles}>
              <p style={sourceTitleStyles}>
                {currentProduct.title
                  ? currentProduct.title.substring(0, 60) + (currentProduct.title.length > 60 ? '...' : '')
                  : t('product.unknown', 'Unknown Product')}
              </p>
              {currentProduct.price && (
                <p style={sourcePriceStyles}>
                  {t('search.currentPrice')} {formatPrice(currentProduct.price)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        resultsCount={filteredResults?.length || 0}
        currency={currency}
      />

      {/* Sort Dropdown */}
      <div style={sortContainerStyles}>
        <SortDropdown
          value={sortBy}
          onChange={onSortChange}
        />
      </div>

      {/* רשימת תוצאות */}
      <div style={resultsListStyles}>
        {filteredResults?.map((product, index) => {
          const isAnimated = animatedItems.includes(index);
          const favorite = isFavorite(product.productId);

          return (
            <div
              key={product.productId || index}
              style={{
                ...productCardStyles,
                opacity: isAnimated ? 1 : 0,
                transform: isAnimated ? 'translateX(0)' : 'translateX(20px)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
              }}
            >
              {/* תגית Best Deal */}
              {product.isBestDeal && (
                <div style={bestDealBadgeStyles}>הצעה הטובה ביותר</div>
              )}

              {/* תמונת מוצר */}
              <div style={productImageContainerStyles}>
                <img
                  src={product.product_main_image_url || product.imageUrl || product.img}
                  alt=""
                  style={productImageStyles}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.classList.add('img-error');
                  }}
                />
                {product.rank && product.rank <= 3 && (
                  <div style={rankBadgeStyles(product.rank)}>#{product.rank}</div>
                )}
              </div>

              {/* פרטי מוצר */}
              <div style={productInfoStyles}>
                <h4 style={productTitleStyles}>
                  {(product.product_title || product.title || 'מוצר ללא שם').substring(0, 70)}
                  {(product.product_title || product.title || '').length > 70 ? '...' : ''}
                </h4>

                {/* תגיות */}
                <div style={badgesContainerStyles}>
                  {product.trustLevel && (
                    <span style={trustBadgeStyles(product.trustLevel.level)}>
                      {product.trustLevel.label}
                    </span>
                  )}
                  {product.savings && product.savings.percent > 0 && (
                    <span style={savingsBadgeStyles}>
                      חיסכון {product.savings.percent}%
                    </span>
                  )}
                </div>

                {/* מחירים */}
                <div style={pricesContainerStyles}>
                  <span style={finalPriceStyles}>
                    {formatPrice(product.price)}
                  </span>
                  {product.savings && product.savings.amount > 0 && (
                    <span style={savingsAmountStyles}>
                      חיסכון {formatPrice(product.savings.amount.toFixed(2))}
                    </span>
                  )}
                </div>

                {/* פעולות */}
                <div style={actionsContainerStyles}>
                  <button
                    onClick={() => onProductClick(product)}
                    style={viewButtonStyles}
                  >
                    צפה במוצר
                  </button>
                  <button
                    onClick={() => onFavoriteToggle(product)}
                    style={favoriteButtonStyles(favorite)}
                    aria-label={favorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill={favorite ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Styles
const containerStyles = {
  padding: '16px',
};

const loadingContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  textAlign: 'center',
};

const spinnerStyles = {
  width: '40px',
  height: '40px',
  marginBottom: '16px',
};

const spinnerInnerStyles = {
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  border: '3px solid #f3f3f3',
  borderTopColor: '#ee0979',
  animation: 'spin 1s linear infinite',
};

const loadingTextStyles = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#1a1a2e',
  marginBottom: '8px',
};

const loadingSubtextStyles = {
  fontSize: '13px',
  color: '#6b7280',
};

const emptyContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  textAlign: 'center',
};

const emptyIconStyles = {
  marginBottom: '16px',
};

const emptyTitleStyles = {
  fontSize: '18px',
  fontWeight: 600,
  color: '#1a1a2e',
  marginBottom: '8px',
};

const emptyTextStyles = {
  fontSize: '14px',
  color: '#6b7280',
  lineHeight: 1.5,
  maxWidth: '280px',
};

const sourceProductStyles = {
  marginBottom: '20px',
  paddingBottom: '16px',
  borderBottom: '1px solid #e5e7eb',
};

const sourceLabelStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: '8px',
  letterSpacing: '0.5px',
};

const sourceCardStyles = {
  display: 'flex',
  gap: '12px',
  padding: '12px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
};

const sourceImageStyles = {
  width: '60px',
  height: '60px',
  objectFit: 'cover',
  borderRadius: '6px',
  flexShrink: 0,
  backgroundColor: '#e5e7eb',
};

const sourceInfoStyles = {
  flex: 1,
  minWidth: 0,
};

const sourceTitleStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#1a1a2e',
  marginBottom: '4px',
  lineHeight: 1.4,
};

const sourcePriceStyles = {
  fontSize: '12px',
  color: '#6b7280',
};

const resultsHeaderStyles = {
  marginBottom: '12px',
};

const resultsCountStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#6b7280',
};

const sortContainerStyles = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: '16px',
  padding: '0 16px',
};

const resultsListStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const productCardStyles = {
  display: 'flex',
  gap: '12px',
  padding: '12px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  position: 'relative',
  transition: 'box-shadow 0.2s ease',
};

const bestDealBadgeStyles = {
  position: 'absolute',
  top: '-6px',
  right: '12px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  color: 'white',
  fontSize: '10px',
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '20px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  boxShadow: '0 2px 8px rgba(238, 9, 121, 0.3)',
};

const productImageContainerStyles = {
  position: 'relative',
  flexShrink: 0,
};

const productImageStyles = {
  width: '80px',
  height: '80px',
  objectFit: 'cover',
  borderRadius: '8px',
  backgroundColor: '#f3f4f6',
};

const rankBadgeStyles = (rank) => ({
  position: 'absolute',
  top: '-4px',
  left: '-4px',
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  background: rank === 1 ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : rank === 2 ? '#c0c0c0' : '#cd7f32',
  color: rank === 1 ? '#1a1a2e' : '#ffffff',
  fontSize: '11px',
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
});

const productInfoStyles = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};

const productTitleStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#1a1a2e',
  marginBottom: '6px',
  lineHeight: 1.4,
  marginTop: 0,
};

const badgesContainerStyles = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
  marginBottom: '8px',
};

const trustBadgeStyles = (level) => ({
  fontSize: '10px',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '4px',
  backgroundColor: level === 'high' ? '#d4edda' : level === 'medium' ? '#fff3cd' : '#f8f9fa',
  color: level === 'high' ? '#155724' : level === 'medium' ? '#856404' : '#6c757d',
});

const savingsBadgeStyles = {
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: '4px',
  backgroundColor: '#d4edda',
  color: '#155724',
};

const pricesContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
};

const finalPriceStyles = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#ee0979',
};

const savingsAmountStyles = {
  fontSize: '12px',
  color: '#28a745',
  fontWeight: 500,
};

const actionsContainerStyles = {
  display: 'flex',
  gap: '8px',
  marginTop: 'auto',
};

const viewButtonStyles = {
  flex: 1,
  padding: '8px 12px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.2s ease',
};

const favoriteButtonStyles = (isFavorite) => ({
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  border: `1px solid ${isFavorite ? '#ee0979' : '#e5e7eb'}`,
  backgroundColor: isFavorite ? 'rgba(238, 9, 121, 0.1)' : 'transparent',
  color: isFavorite ? '#ee0979' : '#6b7280',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  flexShrink: 0,
});
