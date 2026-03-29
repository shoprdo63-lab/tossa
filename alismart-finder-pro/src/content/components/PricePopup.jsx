import React from 'react';

export default function PricePopup({
  mode = 'save',
  currentPrice = 0,
  bestPrice = 0,
  savingsAmount = 0,
  savingsPercent = 0,
  isRTL = false,
  copy,
  onViewDeal
}) {
  const isSaveMode = mode === 'save';

  return (
    <div style={{ ...containerStyles, direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header with gradient brand */}
      <div style={headerStyles}>
        <div style={logoStyles}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span>AliSmart</span>
        </div>
        <span style={badgeStyles(isSaveMode)}>
          {isSaveMode ? `-${savingsPercent}%` : '✓'}
        </span>
      </div>

      {/* Content */}
      <div style={contentStyles}>
        {isSaveMode ? (
          <>
            <div style={priceRowStyles}>
              <span style={currentPriceStyles}>${currentPrice.toFixed(2)}</span>
              <span style={arrowStyles}>→</span>
              <span style={bestPriceStyles}>${bestPrice.toFixed(2)}</span>
            </div>
            <p style={savingsStyles}>
              {copy.savePrefix || 'Save'} <strong>${savingsAmount.toFixed(2)}</strong>
            </p>
          </>
        ) : (
          <p style={bestDealStyles}>
            {copy.currentBestMessage || 'Best deal found!'}
          </p>
        )}
      </div>

      {/* Action Button */}
      {isSaveMode && (
        <button type="button" style={buttonStyles} onClick={onViewDeal}>
          <span>{copy.viewDeal || 'View Deal'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: '6px' }}>
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const containerStyles = {
  width: '280px',
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: '16px',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(238, 9, 121, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08)',
  padding: '0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#1a1a2e',
  overflow: 'hidden'
};

const headerStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  background: 'linear-gradient(135deg, rgba(255, 106, 0, 0.08) 0%, rgba(238, 9, 121, 0.08) 100%)',
  borderBottom: '1px solid rgba(255, 106, 0, 0.1)'
};

const logoStyles = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '14px',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text'
};

const badgeStyles = (isSaveMode) => ({
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: 700,
  background: isSaveMode 
    ? 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)'
    : 'linear-gradient(135deg, #00d084 0%, #00b894 100%)',
  color: '#ffffff',
  boxShadow: '0 2px 8px rgba(238, 9, 121, 0.3)'
});

const contentStyles = {
  padding: '16px'
};

const priceRowStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  marginBottom: '8px'
};

const currentPriceStyles = {
  fontSize: '16px',
  fontWeight: 500,
  color: '#8888a0',
  textDecoration: 'line-through'
};

const arrowStyles = {
  fontSize: '14px',
  color: '#ff6a00',
  fontWeight: 600
};

const bestPriceStyles = {
  fontSize: '20px',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text'
};

const savingsStyles = {
  margin: '0',
  fontSize: '13px',
  color: '#00d084',
  textAlign: 'center',
  fontWeight: 500
};

const bestDealStyles = {
  margin: '0',
  fontSize: '14px',
  color: '#00d084',
  textAlign: 'center',
  fontWeight: 600
};

const buttonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'calc(100% - 32px)',
  margin: '0 16px 16px',
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
  border: 'none',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 15px rgba(238, 9, 121, 0.4)',
  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 20px rgba(238, 9, 121, 0.5)'
  }
};
