import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * SortDropdown Component
 * Dropdown לבחירת מיון תוצאות
 * 
 * אפשרויות מיון:
 * - Best Match (אלגוריתם מקורי)
 * - Price: Low to High
 * - Price: High to Low
 * - Rating: High to Low
 * - Shipping Speed
 */

const SORT_OPTIONS = [
  { value: 'best_match', icon: SparklesIcon },
  { value: 'price_asc', icon: ArrowUpIcon },
  { value: 'price_desc', icon: ArrowDownIcon },
  { value: 'rating_desc', icon: StarIcon },
  { value: 'shipping_speed', icon: TruckIcon },
];

export default function SortDropdown({ value, onChange }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange?.(optionValue);
    setIsOpen(false);
  };

  const currentOption = SORT_OPTIONS.find(opt => opt.value === value) || SORT_OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  return (
    <div ref={dropdownRef} style={containerStyles}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={triggerButtonStyles}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span style={sortLabelStyles}>{t('sort.sortBy', 'Sort by')}:</span>
        <span style={currentValueStyles}>
          <CurrentIcon size={14} />
          {t(`sort.options.${currentOption.value}`, currentOption.value)}
        </span>
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            marginRight: '4px'
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div style={dropdownMenuStyles} role="listbox">
          {SORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === value;
            
            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                style={{
                  ...optionStyles,
                  backgroundColor: isSelected ? 'rgba(238, 9, 121, 0.05)' : 'transparent',
                  color: isSelected ? '#ee0979' : '#374151',
                }}
                role="option"
                aria-selected={isSelected}
              >
                <Icon size={16} color={isSelected ? '#ee0979' : '#6b7280'} />
                <span style={optionTextStyles}>
                  {t(`sort.options.${option.value}`, option.value)}
                </span>
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ee0979" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Icons
function SparklesIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  );
}

function ArrowUpIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2">
      <line x1="12" y1="19" x2="12" y2="5"></line>
      <polyline points="5 12 12 5 19 12"></polyline>
    </svg>
  );
}

function ArrowDownIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <polyline points="19 12 12 19 5 12"></polyline>
    </svg>
  );
}

function StarIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color ? 'none' : 'currentColor'} stroke={color || "currentColor"} strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );
}

function TruckIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2">
      <rect x="1" y="3" width="15" height="13"></rect>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
      <circle cx="5.5" cy="18.5" r="2.5"></circle>
      <circle cx="18.5" cy="18.5" r="2.5"></circle>
    </svg>
  );
}

// Styles
const containerStyles = {
  position: 'relative',
};

const triggerButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  backgroundColor: '#f3f4f6',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  transition: 'all 0.2s ease',
};

const sortLabelStyles = {
  fontSize: '12px',
  color: '#6b7280',
};

const currentValueStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontWeight: 600,
  color: '#1f2937',
};

const dropdownMenuStyles = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  minWidth: '200px',
  backgroundColor: 'white',
  borderRadius: '12px',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
  border: '1px solid #e5e7eb',
  zIndex: 100,
  overflow: 'hidden',
  animation: 'fadeIn 0.2s ease',
};

const optionStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '12px 16px',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'all 0.15s ease',
  textAlign: 'left',
};

const optionTextStyles = {
  flex: 1,
};
