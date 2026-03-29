import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * ActiveFilters Component
 * מציג את הבחירות הנוכחיות של המשתמש (צבע, מידה, דגם) ב-Sidebar
 * 
 * תכונות:
 * - תצוגת תגיות עם הבחירות מהדף המקורי
 * - עיצוב Quiet Luxury עם צבעי המותג
 * - כפתור ניקוי לכל בחירה בנפרד
 * - אנימציית כניסה חלקה
 */

export default function ActiveFilters({ variantFilters, onClearFilter }) {
  const { t } = useTranslation();

  if (!variantFilters) return null;

  const { color, size, model, other } = variantFilters;
  
  // בדיקה אם יש בחירות פעילות
  const hasActiveFilters = color || size || model || Object.keys(other || {}).length > 0;
  
  if (!hasActiveFilters) return null;

  return (
    <div style={containerStyles}>
      {/* כותרת */}
      <div style={headerStyles}>
        <span style={titleStyles}>{t('activeFilters.searchingFor', 'Searching for')}:</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ee0979" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>

      {/* רשימת מסננים פעילים */}
      <div style={filtersContainerStyles}>
        {/* צבע */}
        {color && (
          <div style={filterTagStyles}>
            <span style={filterLabelStyles}>{t('activeFilters.color', 'Color')}:</span>
            <span style={filterValueStyles}>{color}</span>
            <button 
              onClick={() => onClearFilter?.('color')}
              style={clearButtonStyles}
              aria-label={t('activeFilters.clearColor', 'Clear color filter')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}

        {/* מידה */}
        {size && (
          <div style={{...filterTagStyles, backgroundColor: '#fef3c7', borderColor: '#fcd34d'}}>
            <span style={{...filterLabelStyles, color: '#92400e'}}>{t('activeFilters.size', 'Size')}:</span>
            <span style={{...filterValueStyles, color: '#78350f'}}>{size}</span>
            <button 
              onClick={() => onClearFilter?.('size')}
              style={{...clearButtonStyles, color: '#92400e'}}
              aria-label={t('activeFilters.clearSize', 'Clear size filter')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}

        {/* דגם */}
        {model && (
          <div style={{...filterTagStyles, backgroundColor: '#e0f2fe', borderColor: '#7dd3fc'}}>
            <span style={{...filterLabelStyles, color: '#0369a1'}}>{t('activeFilters.model', 'Model')}:</span>
            <span style={{...filterValueStyles, color: '#075985'}}>{model}</span>
            <button 
              onClick={() => onClearFilter?.('model')}
              style={{...clearButtonStyles, color: '#0369a1'}}
              aria-label={t('activeFilters.clearModel', 'Clear model filter')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}

        {/* וריאציות נוספות */}
        {other && Object.entries(other).map(([key, value]) => (
          <div key={key} style={{...filterTagStyles, backgroundColor: '#f3f4f6', borderColor: '#d1d5db'}}>
            <span style={{...filterLabelStyles, color: '#4b5563'}}>{key}:</span>
            <span style={{...filterValueStyles, color: '#374151'}}>{value}</span>
            <button 
              onClick={() => onClearFilter?.(key)}
              style={{...clearButtonStyles, color: '#6b7280'}}
              aria-label={t('activeFilters.clear', 'Clear filter')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Styles
const containerStyles = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  padding: '12px 16px',
  marginBottom: '16px',
  animation: 'fadeIn 0.3s ease',
};

const headerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '10px',
};

const titleStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const filtersContainerStyles = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
};

const filterTagStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  backgroundColor: '#fce7f3',
  border: '1px solid #fbcfe8',
  borderRadius: '8px',
  fontSize: '13px',
  animation: 'slideIn 0.2s ease',
};

const filterLabelStyles = {
  fontWeight: 600,
  color: '#be185d',
  textTransform: 'capitalize',
};

const filterValueStyles = {
  color: '#9d174d',
  fontWeight: 500,
};

const clearButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '18px',
  height: '18px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: '4px',
  color: '#be185d',
  padding: 0,
  marginLeft: '2px',
  transition: 'background-color 0.15s ease',
};
