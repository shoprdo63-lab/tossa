import React, { useState, useCallback } from 'react';

export default function HeaderPopup({ 
  isRTL = false, 
  productData = {}, 
  onSearch,
  copy = {} 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch?.(searchQuery);
    }
  }, [searchQuery, onSearch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
    <div 
      style={{ 
        ...containerStyles, 
        direction: isRTL ? 'rtl' : 'ltr',
        boxShadow: isFocused 
          ? '0 8px 32px rgba(238, 9, 121, 0.2), 0 0 0 3px rgba(255, 106, 0, 0.1)' 
          : '0 8px 32px rgba(238, 9, 121, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08)'
      }}
    >
      {/* Logo */}
      <div style={logoStyles}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span>AliSmart</span>
      </div>

      {/* Search Bar */}
      <form 
        onSubmit={handleSubmit}
        style={{
          ...searchBarStyles,
          borderColor: isFocused ? '#ff6a00' : 'transparent',
          background: isFocused ? 'white' : 'rgba(0, 0, 0, 0.03)'
        }}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke={isFocused ? '#ff6a00' : '#888'}
          strokeWidth="2"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={copy.searchPlaceholder || 'Search similar products...'}
          style={inputStyles}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={clearButtonStyles}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </form>

      {/* Action Button */}
      <button 
        type="submit"
        onClick={handleSubmit}
        style={actionButtonStyles}
        disabled={!searchQuery.trim()}
      >
        <span>{copy.search || 'Search'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: '4px' }}>
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const containerStyles = {
  position: 'fixed',
  top: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 16px',
  background: 'rgba(255, 255, 255, 0.98)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: '50px',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  boxShadow: '0 8px 32px rgba(238, 9, 121, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08)',
  zIndex: 2147483645,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  maxWidth: '600px',
  width: '90%',
  transition: 'box-shadow 0.2s ease'
};

const logoStyles = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '15px',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  flexShrink: 0,
  whiteSpace: 'nowrap'
};

const searchBarStyles = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 14px',
  background: 'rgba(0, 0, 0, 0.03)',
  borderRadius: '25px',
  border: '1px solid transparent',
  transition: 'all 0.2s ease'
};

const inputStyles = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  outline: 'none',
  fontSize: '14px',
  color: '#1a1a2e',
  minWidth: '120px',
  fontFamily: 'inherit'
};

const clearButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
  margin: 0,
  borderRadius: '50%',
  transition: 'background 0.2s ease'
};

const actionButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 16px',
  background: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
  border: 'none',
  borderRadius: '25px',
  color: 'white',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 2px 8px rgba(238, 9, 121, 0.3)',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  ':hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(238, 9, 121, 0.4)'
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed'
  }
};
