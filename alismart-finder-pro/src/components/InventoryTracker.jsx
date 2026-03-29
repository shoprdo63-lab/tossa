import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * InventoryTracker Component
 * מעקב מלאי אמיתי עם זיהוי דחיפות מזויפת
 * 
 * תכונות:
 * - פס התקדמות מינימליסטי למלאי
 * - זיהוי טקטיקות שיווק מזויפות
 * - המלצות רכישה מבוססות מלאי אמיתי
 * - עיצוב Quiet Luxury - עובדות טכניות יבשות
 */

export default function InventoryTracker({ inventoryData }) {
  const { t, i18n } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const [previousStock, setPreviousStock] = useState(null);

  const isRTL = i18n.language === 'he';

  useEffect(() => {
    if (inventoryData?.productId) {
      // בדיקה אם יש נתוני מלאי קודמים לשימוש
      const key = `inventory_${inventoryData.productId}`;
      chrome.storage.local.get([key]).then(result => {
        if (result[key]) {
          setPreviousStock(result[key].totalStock);
        }
      });
      
      // שמירת נתוני מלאי נוכחיים
      chrome.storage.local.set({
        [key]: {
          totalStock: inventoryData.totalStock,
          timestamp: Date.now()
        }
      });
    }
  }, [inventoryData?.productId, inventoryData?.totalStock]);

  if (!inventoryData || inventoryData.stockStatus === 'unavailable') {
    return (
      <div style={unavailableContainerStyles(isRTL)}>
        <span style={unavailableIconStyles}>📦</span>
        <span style={unavailableTextStyles}>
          {t('inventory.unavailable', 'Stock status unavailable')}
        </span>
      </div>
    );
  }

  const { totalStock, stockStatus, variants, marketingTactics, hasFakeUrgency, recommendation, recommendationHe } = inventoryData;
  
  // חישוב אחוז מלאי לפס (מקסימום 200 לתצוגה)
  const stockPercentage = Math.min((totalStock / 200) * 100, 100);
  
  // קבלת צבע לפי סטטוס מלאי
  const getStockColor = () => {
    switch (stockStatus) {
      case 'out_of_stock': return '#ef4444';
      case 'low_stock': return '#f97316';
      case 'limited': return '#fbbf24';
      case 'moderate': return '#84cc16';
      case 'plenty': return '#22c55e';
      default: return '#94a3b8';
    }
  };

  // קבלת תווית סטטוס
  const getStatusLabel = () => {
    const labels = {
      out_of_stock: t('inventory.outOfStock', 'Out of Stock'),
      low_stock: t('inventory.lowStock', 'Low Stock'),
      limited: t('inventory.limited', 'Limited Stock'),
      moderate: t('inventory.moderate', 'Moderate Stock'),
      plenty: t('inventory.plenty', 'Plenty in Stock')
    };
    return labels[stockStatus] || stockStatus;
  };

  // חישוב שינוי במלאי
  const stockChange = previousStock !== null ? totalStock - previousStock : null;

  return (
    <div style={containerStyles(isRTL)}>
      {/* Header */}
      <div style={headerStyles}>
        <div style={titleContainerStyles}>
          <span style={warehouseIconStyles}>🏭</span>
          <div>
            <h3 style={titleStyles}>{t('inventory.title', 'Inventory Status')}</h3>
            <p style={subtitleStyles}>
              {t('inventory.warehouseChecked', 'Warehouse data checked')}
            </p>
          </div>
        </div>
        <div style={statusBadgeStyles(getStockColor())}>
          {getStatusLabel()}
        </div>
      </div>

      {/* Stock Progress Bar */}
      <div style={progressSectionStyles}>
        <div style={progressLabelsStyles}>
          <span style={stockCountStyles}>
            {totalStock.toLocaleString()} {t('inventory.units', 'units')}
          </span>
          {stockChange !== null && stockChange !== 0 && (
            <span style={changeStyles(stockChange < 0)}>
              {stockChange < 0 ? '↓' : '↑'} {Math.abs(stockChange)}
            </span>
          )}
        </div>
        
        <div style={progressBarContainerStyles}>
          <div style={progressBarTrackStyles}>
            <div 
              style={progressBarFillStyles(stockPercentage, getStockColor())}
            />
          </div>
          
          {/* Markers for reference */}
          <div style={markersStyles}>
            <span style={markerStyles}>0</span>
            <span style={markerStyles}>100</span>
            <span style={markerStyles}>200+</span>
          </div>
        </div>
      </div>

      {/* Marketing Tactics Warning */}
      {hasFakeUrgency && marketingTactics.length > 0 && (
        <div style={warningContainerStyles(isRTL)}>
          <div style={warningHeaderStyles}>
            <span style={warningIconStyles}>⚠️</span>
            <span style={warningTitleStyles}>
              {t('inventory.fakeUrgency', 'Marketing Tactics Detected')}
            </span>
          </div>
          
          <ul style={tacticsListStyles(isRTL)}>
            {marketingTactics.map((tactic, idx) => (
              <li key={idx} style={tacticItemStyles}>
                <span style={tacticIconStyles}>•</span>
                {isRTL ? tactic.descriptionHe : tactic.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      <div style={recommendationContainerStyles(getStockColor())}>
        <span style={recommendationIconStyles}>
          {stockStatus === 'low_stock' ? '⏰' : 
           stockStatus === 'out_of_stock' ? '❌' : 
           hasFakeUrgency ? '🤔' : '✓'}
        </span>
        <span style={recommendationTextStyles}>
          {isRTL ? recommendationHe : recommendation}
        </span>
      </div>

      {/* Variants Details */}
      {variants.length > 1 && (
        <button 
          onClick={() => setShowDetails(!showDetails)}
          style={detailsToggleStyles(isRTL)}
        >
          <span>
            {showDetails 
              ? t('inventory.hideVariants', 'Hide Variants') 
              : t('inventory.showVariants', 'Show {{count}} Variants', { count: variants.length })
            }
          </span>
          <span style={{ transform: showDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            ▼
          </span>
        </button>
      )}

      {showDetails && variants.length > 1 && (
        <div style={variantsContainerStyles}>
          {variants.map((variant, idx) => (
            <div key={idx} style={variantRowStyles(isRTL)}>
              <div style={variantInfoStyles}>
                <span style={variantNameStyles}>{variant.name || variant.value}</span>
                {variant.price && (
                  <span style={variantPriceStyles}>${variant.price}</span>
                )}
              </div>
              <div style={variantStockStyles}>
                <span style={variantStockBadgeStyles(variant.available)}>
                  {variant.available 
                    ? `${variant.stock} ${t('inventory.inStock', 'in stock')}` 
                    : t('inventory.out', 'Out')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip Info */}
      <p style={tooltipStyles}>
        {t('inventory.tooltip', 'We checked the warehouse data: {{count}} units actually available.', { count: totalStock })}
      </p>
    </div>
  );
}

// Styles
const containerStyles = (isRTL) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  padding: '18px',
  backgroundColor: '#f8fafc',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  direction: isRTL ? 'rtl' : 'ltr',
});

const unavailableContainerStyles = (isRTL) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  padding: '30px',
  backgroundColor: '#f1f5f9',
  borderRadius: '12px',
  direction: isRTL ? 'rtl' : 'ltr',
});

const unavailableIconStyles = {
  fontSize: '28px',
};

const unavailableTextStyles = {
  fontSize: '13px',
  color: '#6b7280',
  textAlign: 'center',
};

const headerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '10px',
};

const titleContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const warehouseIconStyles = {
  fontSize: '22px',
};

const titleStyles = {
  fontSize: '15px',
  fontWeight: 700,
  color: '#1f2937',
  margin: 0,
};

const subtitleStyles = {
  fontSize: '11px',
  color: '#6b7280',
  margin: '2px 0 0 0',
};

const statusBadgeStyles = (color) => ({
  padding: '4px 12px',
  backgroundColor: `${color}20`,
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: 600,
  color: color,
  whiteSpace: 'nowrap',
});

const progressSectionStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const progressLabelsStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const stockCountStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
};

const changeStyles = (isNegative) => ({
  fontSize: '12px',
  fontWeight: 600,
  color: isNegative ? '#ef4444' : '#22c55e',
});

const progressBarContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const progressBarTrackStyles = {
  height: '8px',
  backgroundColor: '#e2e8f0',
  borderRadius: '4px',
  overflow: 'hidden',
};

const progressBarFillStyles = (percentage, color) => ({
  height: '100%',
  width: `${percentage}%`,
  backgroundColor: color,
  borderRadius: '4px',
  transition: 'width 0.5s ease',
});

const markersStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '9px',
  color: '#94a3b8',
};

const markerStyles = {
  fontSize: '9px',
};

const warningContainerStyles = (isRTL) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '12px',
  backgroundColor: '#fffbeb',
  borderRadius: '10px',
  border: '1px solid #fcd34d',
  direction: isRTL ? 'rtl' : 'ltr',
});

const warningHeaderStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const warningIconStyles = {
  fontSize: '16px',
};

const warningTitleStyles = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#92400e',
};

const tacticsListStyles = (isRTL) => ({
  margin: 0,
  paddingLeft: isRTL ? 0 : '16px',
  paddingRight: isRTL ? '16px' : 0,
  listStyle: 'none',
});

const tacticItemStyles = {
  fontSize: '12px',
  color: '#78350f',
  lineHeight: 1.5,
  display: 'flex',
  alignItems: 'flex-start',
  gap: '6px',
};

const tacticIconStyles = {
  fontSize: '8px',
  marginTop: '4px',
};

const recommendationContainerStyles = (color) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 14px',
  backgroundColor: `${color}15`,
  borderRadius: '10px',
  borderLeft: `3px solid ${color}`,
});

const recommendationIconStyles = {
  fontSize: '18px',
};

const recommendationTextStyles = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  lineHeight: 1.4,
};

const detailsToggleStyles = (isRTL) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  backgroundColor: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
  textAlign: isRTL ? 'right' : 'left',
});

const variantsContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const variantRowStyles = (isRTL) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  backgroundColor: 'white',
  borderRadius: '8px',
  direction: isRTL ? 'rtl' : 'ltr',
});

const variantInfoStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const variantNameStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
};

const variantPriceStyles = {
  fontSize: '11px',
  color: '#6b7280',
};

const variantStockStyles = {
  display: 'flex',
  alignItems: 'center',
};

const variantStockBadgeStyles = (available) => ({
  padding: '3px 8px',
  backgroundColor: available ? '#dcfce7' : '#fee2e2',
  borderRadius: '12px',
  fontSize: '10px',
  fontWeight: 600,
  color: available ? '#166534' : '#991b1b',
});

const tooltipStyles = {
  fontSize: '11px',
  color: '#94a3b8',
  textAlign: 'center',
  margin: '4px 0 0 0',
  fontStyle: 'italic',
};
