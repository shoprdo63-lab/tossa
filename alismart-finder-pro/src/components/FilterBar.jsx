import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * FilterBar Component
 * שורת סינון צפה עם אפשרויות סינון מתקדמות
 * 
 * תכונות:
 * - טווח מחירים (min/max)
 * - משלוח חינם toggle
 * - דירוג גבוה toggle
 * - עיצוב Quiet Luxury עם custom toggles
 * - מובייל-פרנדלי
 */

export default function FilterBar({ 
  filters, 
  onFiltersChange, 
  resultsCount,
  currency = 'USD'
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync with parent
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Debounced update to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange?.(localFilters);
    }, 300);
    return () => clearTimeout(timer);
  }, [localFilters, onFiltersChange]);

  const handlePriceMinChange = (e) => {
    const value = e.target.value === '' ? '' : parseFloat(e.target.value);
    setLocalFilters(prev => ({ ...prev, priceMin: value }));
  };

  const handlePriceMaxChange = (e) => {
    const value = e.target.value === '' ? '' : parseFloat(e.target.value);
    setLocalFilters(prev => ({ ...prev, priceMax: value }));
  };

  const handleToggleFreeShipping = () => {
    setLocalFilters(prev => ({ ...prev, freeShipping: !prev.freeShipping }));
  };

  const handleToggleTopRated = () => {
    setLocalFilters(prev => ({ ...prev, topRated: !prev.topRated }));
  };

  const handleClearFilters = () => {
    setLocalFilters({
      priceMin: '',
      priceMax: '',
      freeShipping: false,
      topRated: false,
    });
  };

  const hasActiveFilters = 
    localFilters.priceMin !== '' || 
    localFilters.priceMax !== '' || 
    localFilters.freeShipping || 
    localFilters.topRated;

  return (
    <div style={containerStyles}>
      {/* Header with expand/collapse */}
      <div style={headerStyles}>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          style={expandButtonStyles}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ 
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span style={filterLabelStyles}>
            {t('filters.title', 'Filters')}
            {hasActiveFilters && (
              <span style={activeIndicatorStyles}>•</span>
            )}
          </span>
        </button>

        <span style={resultsCountStyles}>
          {t('filters.results', { count: resultsCount })}
        </span>
      </div>

      {/* Expandable filter section */}
      <div style={{
        ...filterSectionStyles,
        maxHeight: isExpanded ? '300px' : '0',
        opacity: isExpanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}>
        {/* Price Range */}
        <div style={filterGroupStyles}>
          <label style={groupLabelStyles}>{t('filters.priceRange', 'Price Range')}</label>
          <div style={priceInputContainerStyles}>
            <div style={priceInputWrapperStyles}>
              <span style={currencySymbolStyles}>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '₪'}</span>
              <input
                type="number"
                placeholder={t('filters.min', 'Min')}
                value={localFilters.priceMin}
                onChange={handlePriceMinChange}
                style={priceInputStyles}
                min="0"
                step="0.01"
              />
            </div>
            <span style={priceSeparatorStyles}>-</span>
            <div style={priceInputWrapperStyles}>
              <span style={currencySymbolStyles}>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '₪'}</span>
              <input
                type="number"
                placeholder={t('filters.max', 'Max')}
                value={localFilters.priceMax}
                onChange={handlePriceMaxChange}
                style={priceInputStyles}
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Toggles Row */}
        <div style={togglesRowStyles}>
          {/* Free Shipping Toggle */}
          <label style={toggleLabelStyles}>
            <button
              onClick={handleToggleFreeShipping}
              style={{
                ...customToggleStyles,
                backgroundColor: localFilters.freeShipping ? '#ee0979' : '#e5e7eb'
              }}
              aria-checked={localFilters.freeShipping}
              role="switch"
            >
              <div style={{
                ...toggleKnobStyles,
                transform: localFilters.freeShipping ? 'translateX(20px)' : 'translateX(2px)'
              }} />
            </button>
            <span style={toggleTextStyles}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              {t('filters.freeShipping', 'Free Shipping')}
            </span>
          </label>

          {/* Top Rated Toggle */}
          <label style={toggleLabelStyles}>
            <button
              onClick={handleToggleTopRated}
              style={{
                ...customToggleStyles,
                backgroundColor: localFilters.topRated ? '#ee0979' : '#e5e7eb'
              }}
              aria-checked={localFilters.topRated}
              role="switch"
            >
              <div style={{
                ...toggleKnobStyles,
                transform: localFilters.topRated ? 'translateX(20px)' : 'translateX(2px)'
              }} />
            </button>
            <span style={toggleTextStyles}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              {t('filters.topRated', 'Top Rated 4.5+')}
            </span>
          </label>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button onClick={handleClearFilters} style={clearButtonStyles}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            {t('filters.clear', 'Clear All')}
          </button>
        )}
      </div>
    </div>
  );
}

// Styles
const containerStyles = {
  backgroundColor: '#ffffff',
  borderBottom: '1px solid #e5e7eb',
  padding: '12px 16px',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};

const headerStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const expandButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
  padding: '4px',
};

const filterLabelStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const activeIndicatorStyles = {
  color: '#ee0979',
  fontSize: '20px',
  lineHeight: 0,
};

const resultsCountStyles = {
  fontSize: '12px',
  color: '#6b7280',
  fontWeight: 500,
};

const filterSectionStyles = {
  marginTop: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const filterGroupStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const groupLabelStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const priceInputContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const priceInputWrapperStyles = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  padding: '8px 12px',
  flex: 1,
};

const currencySymbolStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#6b7280',
  marginRight: '4px',
};

const priceInputStyles = {
  border: 'none',
  background: 'none',
  fontSize: '14px',
  fontWeight: 500,
  color: '#1f2937',
  width: '100%',
  outline: 'none',
  fontFamily: 'inherit',
};

const priceSeparatorStyles = {
  fontSize: '14px',
  color: '#9ca3af',
  fontWeight: 500,
};

const togglesRowStyles = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
};

const toggleLabelStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
};

const customToggleStyles = {
  width: '44px',
  height: '24px',
  borderRadius: '12px',
  border: 'none',
  cursor: 'pointer',
  position: 'relative',
  transition: 'background-color 0.2s ease',
  padding: 0,
};

const toggleKnobStyles = {
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  backgroundColor: 'white',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  transition: 'transform 0.2s ease',
  position: 'absolute',
  top: '2px',
};

const toggleTextStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const clearButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  backgroundColor: 'transparent',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  color: '#6b7280',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  alignSelf: 'flex-start',
};
