import React from 'react';

/**
 * Tab Navigation Component
 * ניווט טאבים בין חיפוש, מועדפים והגדרות
 * 
 * טקסט בעברית צחה:
 * - חיפוש
 * - מועדפים  
 * - הגדרות
 */

const TABS = [
  { id: 'search', label: 'חיפוש', icon: SearchIcon },
  { id: 'favorites', label: 'מועדפים', icon: HeartIcon },
  { id: 'checkout', label: 'צ\'קאאוט', icon: CheckoutIcon, conditional: true },
  { id: 'settings', label: 'הגדרות', icon: SettingsIcon },
];

export default function TabNavigation({ activeTab, onTabChange, isDarkMode, showCheckout = false }) {
  // Filter tabs based on conditions
  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'checkout') return showCheckout;
    return true;
  });
  return (
    <nav
      style={{
        ...navStyles,
        backgroundColor: isDarkMode ? '#1a1a2e' : '#ffffff',
        borderBottom: `1px solid ${isDarkMode ? '#2d2d44' : '#e5e7eb'}`,
      }}
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              ...tabButtonStyles,
              color: isActive
                ? '#ee0979'
                : isDarkMode
                ? '#adb5bd'
                : '#6b7280',
              backgroundColor: isActive
                ? isDarkMode
                  ? 'rgba(238, 9, 121, 0.1)'
                  : 'rgba(238, 9, 121, 0.05)'
                : 'transparent',
            }}
            aria-pressed={isActive}
          >
            <Icon
              size={18}
              color={
                isActive ? '#ee0979' : isDarkMode ? '#adb5bd' : '#6b7280'
              }
            />
            <span style={tabLabelStyles}>{tab.label}</span>
            
            {/* אינדיקטור פעילות */}
            {isActive && (
              <div
                style={{
                  ...activeIndicatorStyles,
                  background: 'linear-gradient(90deg, #ff6a00, #ee0979)',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

// Icons
function SearchIcon({ size, color }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
  );
}

function HeartIcon({ size, color }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  );
}

function SettingsIcon({ size, color }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
      <path d="m20.5 4.5-4.2 4.2m-6.6 6.6-4.2 4.2M4.5 3.5l4.2 4.2m6.6 6.6 4.2 4.2"></path>
    </svg>
  );
}

function CheckoutIcon({ size, color }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      <path d="M12 12v6"></path>
      <path d="M9 15h6"></path>
    </svg>
  );
}

// Styles
const navStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'stretch',
  padding: '0 12px',
  flexShrink: 0,
};

const tabButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  flex: 1,
  padding: '14px 8px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'inherit',
  transition: 'all 0.2s ease',
  position: 'relative',
  whiteSpace: 'nowrap',
};

const tabLabelStyles = {
  fontSize: '13px',
  fontWeight: 500,
};

const activeIndicatorStyles = {
  position: 'absolute',
  bottom: 0,
  left: '20%',
  right: '20%',
  height: '2px',
  borderRadius: '1px',
};
