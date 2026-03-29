import React from 'react';
import { useTranslation } from 'react-i18next';
import { useFavoritesSync } from '../../hooks/useFavoritesSync';
import CloudSyncIndicator from '../../components/CloudSyncIndicator';

/**
 * Favorites Tab Component with Cloud Sync
 * טאב המוצרים השמורים עם סנכרון ענן
 * 
 * תכונות:
 * - סנכרון אוניברסלי למועדפים בכל המכשירים
 * - אינדיקטור סטטוס סנכרון
 * - ייצוא וייבוא מועדפים
 * - מצב אופליין
 */

export default function FavoritesTab({ onProductClick }) {
  const { t } = useTranslation();
  const {
    favorites,
    isLoading,
    syncStatus,
    lastSync,
    error,
    addFavorite,
    removeFavorite,
    forceSync,
    exportFavorites,
    importFavorites,
  } = useFavoritesSync();

  // טיפול בהסרת מועדף
  const handleRemove = async (productId) => {
    await removeFavorite(productId);
  };

  // ייצוא מועדפים
  const handleExport = () => {
    const data = exportFavorites();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alismart-favorites-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ייבוא מועדפים
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await importFavorites(data);
        if (result.success) {
          alert(t('cloud.restoreSuccess', 'Favorites restored successfully'));
        }
      } catch (err) {
        alert('Error importing favorites: ' + err.message);
      }
    };
    input.click();
  };

  // מצב טעינה
  if (isLoading) {
    return (
      <div style={loadingContainerStyles}>
        <div style={spinnerStyles} />
        <p style={loadingTextStyles}>{t('loading', 'Loading...')}</p>
      </div>
    );
  }

  // מצב ריק - אין מועדפים
  if (!favorites || favorites.length === 0) {
    return (
      <div style={containerStyles}>
        {/* Header with sync indicator */}
        <div style={headerStyles}>
          <div style={headerLeftStyles}>
            <h3 style={sectionTitleStyles}>{t('favorites.title', 'Favorites')}</h3>
            <CloudSyncIndicator status={syncStatus} lastSync={lastSync} />
          </div>
          <div style={headerActionsStyles}>
            <button onClick={handleImport} style={iconButtonStyles} title={t('cloud.import', 'Import')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        <div style={emptyContainerStyles}>
          <div style={emptyIconStyles}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#adb5bd"
              strokeWidth="1.5"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </div>
          <p style={emptyTitleStyles}>{t('favorites.empty', 'No favorites yet')}</p>
          <p style={emptyTextStyles}>
            {t('favorites.emptyDesc', 'When you find products you love, click the heart icon to save them here')}
          </p>
        </div>
      </div>
    );
  }

  // עיצוב מחיר
  const formatPrice = (price) => {
    if (!price) return t('common.notAvailable', 'N/A');
    const match = price.match(/[₪$€£]/);
    const symbol = match ? match[0] : '₪';
    const value = price.match(/[\d,.]+/)?.[0] || '0';
    return `${symbol}${value}`;
  };

  return (
    <div style={containerStyles}>
      {/* Header with sync indicator and actions */}
      <div style={headerStyles}>
        <div style={headerLeftStyles}>
          <h3 style={sectionTitleStyles}>{t('favorites.title', 'Favorites')}</h3>
          <CloudSyncIndicator status={syncStatus} lastSync={lastSync} />
        </div>
        <div style={headerActionsStyles}>
          {syncStatus === 'error' && (
            <button 
              onClick={forceSync} 
              style={retryButtonStyles}
              title={t('cloud.retrySync', 'Retry Sync')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
          <button onClick={handleExport} style={iconButtonStyles} title={t('cloud.export', 'Export')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button onClick={handleImport} style={iconButtonStyles} title={t('cloud.import', 'Import')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sync description */}
      <div style={syncInfoStyles}>
        <p style={countStyles}>
          {favorites.length} {t('favorites.items', 'products saved')}
        </p>
        {syncStatus === 'offline' && (
          <span style={offlineBadgeStyles}>{t('cloud.offline', 'Offline')}</span>
        )}
      </div>

      {/* רשימת מועדפים */}
      <div style={listStyles}>
        {favorites.map((product, index) => (
          <div
            key={product.productId || index}
            style={{
              ...cardStyles,
              animationDelay: `${index * 50}ms`,
            }}
            className="als-favorite-card"
          >
            {/* תמונה */}
            <div style={imageContainerStyles}>
              <img
                src={product.product_main_image_url || product.imageUrl || product.img}
                alt=""
                style={imageStyles}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.style.backgroundColor = '#e5e7eb';
                }}
              />
            </div>

            {/* פרטים */}
            <div style={infoStyles}>
              <h4 style={titleStyles}>
                {(product.product_title || product.title || t('product.unknown', 'Unknown Product')).substring(0, 60)}
                {(product.product_title || product.title || '').length > 60 ? '...' : ''}
              </h4>

              {product.price && (
                <p style={priceStyles}>{formatPrice(product.price)}</p>
              )}

              {product.savedAt && (
                <p style={dateStyles}>
                  {t('favorites.savedOn', 'Saved')} {new Date(product.savedAt).toLocaleDateString('he-IL')}
                  {product.source === 'cloud' && (
                    <span style={cloudBadgeStyles}> ☁️</span>
                  )}
                </p>
              )}
            </div>

            {/* פעולות */}
            <div style={actionsStyles}>
              <button
                onClick={() => onProductClick?.(product)}
                style={viewButtonStyles}
                title={t('favorites.view', 'View Product')}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </button>

              <button
                onClick={() => handleRemove(product.productId)}
                style={removeButtonStyles}
                title={t('favorites.remove', 'Remove')}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Styles
const containerStyles = {
  padding: '16px',
};

const headerStyles = {
  marginBottom: '16px',
  paddingBottom: '12px',
  borderBottom: '1px solid #e5e7eb',
};

const countStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#1a1a2e',
  margin: 0,
};

const listStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const cardStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px',
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
  animation: 'fadeIn 0.3s ease forwards',
  transition: 'box-shadow 0.2s ease',
};

const imageContainerStyles = {
  flexShrink: 0,
};

const imageStyles = {
  width: '60px',
  height: '60px',
  objectFit: 'cover',
  borderRadius: '6px',
  backgroundColor: '#f3f4f6',
};

const infoStyles = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
};

const titleStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#1a1a2e',
  margin: '0 0 4px 0',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const priceStyles = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#ee0979',
  margin: '0 0 2px 0',
};

const dateStyles = {
  fontSize: '11px',
  color: '#9ca3af',
  margin: 0,
};

const actionsStyles = {
  display: 'flex',
  gap: '6px',
  flexShrink: 0,
};

const viewButtonStyles = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  backgroundColor: 'transparent',
  color: '#6b7280',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const removeButtonStyles = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  border: '1px solid #fca5a5',
  backgroundColor: 'rgba(239, 68, 68, 0.05)',
  color: '#ef4444',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
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
  maxWidth: '260px',
};

// New styles for cloud sync
const loadingContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
};

const spinnerStyles = {
  width: '32px',
  height: '32px',
  border: '3px solid #f3f4f6',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const loadingTextStyles = {
  marginTop: '16px',
  fontSize: '14px',
  color: '#6b7280',
};

const headerLeftStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const sectionTitleStyles = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#1f2937',
  margin: 0,
};

const headerActionsStyles = {
  display: 'flex',
  gap: '8px',
};

const iconButtonStyles = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  backgroundColor: 'transparent',
  color: '#6b7280',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const retryButtonStyles = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '8px',
  border: '1px solid #fca5a5',
  backgroundColor: '#fef2f2',
  color: '#ef4444',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const syncInfoStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
};

const offlineBadgeStyles = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#6b7280',
  backgroundColor: '#f3f4f6',
  padding: '4px 10px',
  borderRadius: '12px',
};

const cloudBadgeStyles = {
  fontSize: '11px',
  color: '#3b82f6',
  marginLeft: '4px',
};
