import React from 'react';

/**
 * Sidebar Header Component
 * הכותרת העליונה של ה-Sidebar
 * 
 * כולל:
 * - לוגו AliSmart
 * - כפתור סגירה (X)
 * - כפתור החלפת מצב יום/לילה
 */

export default function SidebarHeader({ isDarkMode, onToggleTheme, onClose }) {
  return (
    <header
      className="als-sidebar-header"
      style={{
        ...headerStyles,
        backgroundColor: isDarkMode ? '#1a1a2e' : '#ffffff',
        borderBottom: `1px solid ${isDarkMode ? '#2d2d44' : '#e5e7eb'}`,
      }}
    >
      {/* לוגו ושם המותג */}
      <div style={logoContainerStyles}>
        {/* אייקון חיפוש כלוגו */}
        <div style={logoIconStyles}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </div>
        
        <div style={logoTextStyles}>
          <span
            style={{
              ...brandNameStyles,
              color: isDarkMode ? '#f8f9fa' : '#1a1a2e',
            }}
          >
            AliSmart
          </span>
          <span style={proBadgeStyles}>Pro</span>
        </div>
      </div>

      {/* כפתורים */}
      <div style={actionsStyles}>
        {/* כפתור מצב יום/לילה */}
        <button
          onClick={onToggleTheme}
          style={{
            ...iconButtonStyles,
            color: isDarkMode ? '#adb5bd' : '#6b7280',
          }}
          aria-label={isDarkMode ? 'מעבר למצב יום' : 'מעבר למצב לילה'}
          title={isDarkMode ? 'מעבר למצב יום' : 'מעבר למצב לילה'}
        >
          {isDarkMode ? (
            // אייקון שמש
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            // אייקון ירח
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>

        {/* כפתור סגירה */}
        <button
          onClick={onClose}
          style={{
            ...iconButtonStyles,
            color: isDarkMode ? '#adb5bd' : '#6b7280',
          }}
          aria-label="סגור"
          title="סגור"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </header>
  );
}

// Styles
const headerStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  flexShrink: 0,
};

const logoContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const logoIconStyles = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  flexShrink: 0,
};

const logoTextStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const brandNameStyles = {
  fontSize: '18px',
  fontWeight: 700,
  letterSpacing: '-0.5px',
};

const proBadgeStyles = {
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: '4px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  color: 'white',
};

const actionsStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const iconButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};
