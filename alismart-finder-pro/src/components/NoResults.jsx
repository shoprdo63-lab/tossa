import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * NoResults Component
 * תצוגת מצב ריק כשאין תוצאות מתאימות לסינון
 * 
 * מציג:
 * - איור נקי (ללא דמויות)
 * - הודעה על אפשרות לשנות סינון
 * - כפתור לניקוי סינון
 */

export default function NoResults({ onAdjustFilters, onClearFilters }) {
  const { t } = useTranslation();

  return (
    <div style={containerStyles}>
      {/* Icon - magnifying glass with question mark (no figures) */}
      <div style={iconContainerStyles}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d1d5db"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
      </div>

      {/* Title */}
      <h3 style={titleStyles}>
        {t('noResults.title', 'No matches found')}
      </h3>

      {/* Description */}
      <p style={descriptionStyles}>
        {t('noResults.description', 'Try adjusting your filters to see more results')}
      </p>

      {/* Actions */}
      <div style={actionsStyles}>
        <button
          onClick={onAdjustFilters}
          style={primaryButtonStyles}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          {t('noResults.adjustFilters', 'Adjust Filters')}
        </button>

        {onClearFilters && (
          <button
            onClick={onClearFilters}
            style={secondaryButtonStyles}
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
            {t('filters.clear', 'Clear All')}
          </button>
        )}
      </div>

      {/* Tips */}
      <div style={tipsContainerStyles}>
        <p style={tipsTitleStyles}>{t('filters.tips', 'Filter Tips')}:</p>
        <ul style={tipsListStyles}>
          <li style={tipItemStyles}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {t('filters.tipPrice', 'Try widening the price range')}
          </li>
          <li style={tipItemStyles}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {t('filters.tipFreeShipping', 'Disable "Free Shipping" filter')}
          </li>
          <li style={tipItemStyles}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {t('filters.tipTopRated', 'Try disabling "Top Rated" filter')}
          </li>
        </ul>
      </div>
    </div>
  );
}

// Styles
const containerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  textAlign: 'center',
  minHeight: '400px',
};

const iconContainerStyles = {
  width: '100px',
  height: '100px',
  borderRadius: '50%',
  backgroundColor: '#f3f4f6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '24px',
};

const titleStyles = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#1f2937',
  margin: '0 0 12px 0',
};

const descriptionStyles = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0 0 24px 0',
  maxWidth: '280px',
  lineHeight: 1.5,
};

const actionsStyles = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  justifyContent: 'center',
  marginBottom: '32px',
};

const primaryButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 20px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: 'inherit',
};

const secondaryButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 20px',
  backgroundColor: 'transparent',
  color: '#6b7280',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontFamily: 'inherit',
};

const tipsContainerStyles = {
  backgroundColor: '#f9fafb',
  borderRadius: '12px',
  padding: '16px 20px',
  maxWidth: '320px',
  width: '100%',
};

const tipsTitleStyles = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: '0 0 12px 0',
};

const tipsListStyles = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const tipItemStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#6b7280',
};
