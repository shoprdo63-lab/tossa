import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * CartSummary Component
 * תזכורת סל חכמה עם אפשרות החלפה למוצרים זולים יותר
 * 
 * תכונות:
 * - הצגת מוצרים בסל הקניות
 * - חישוב חיסכון פוטנציאלי
 * - כפתור "מצא זול יותר" לכל מוצר
 * - עיצוב מניע לפעולה
 */

export default function CartSummary({ 
  cartItems = [], 
  cartTotal = 0, 
  onFindCheaper,
  isLoading = false,
}) {
  const { t } = useTranslation();
  const [searchingItemId, setSearchingItemId] = useState(null);
  const [potentialSavings, setPotentialSavings] = useState({});

  const itemCount = cartItems.length;
  
  if (itemCount === 0) {
    return (
      <div style={emptyContainerStyles}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <p style={emptyTextStyles}>{t('cart.empty', 'Your cart is empty')}</p>
        <p style={emptySubtextStyles}>{t('cart.emptySubtext', 'Add items to see savings opportunities')}</p>
      </div>
    );
  }

  const handleFindCheaper = async (item) => {
    setSearchingItemId(item.productId);
    
    try {
      const result = await onFindCheaper?.(item);
      
      if (result?.savings) {
        setPotentialSavings(prev => ({
          ...prev,
          [item.productId]: result.savings
        }));
      }
    } finally {
      setSearchingItemId(null);
    }
  };

  // חישוב חיסכון כולל
  const totalPotentialSavings = Object.values(potentialSavings).reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div style={headerLeftStyles}>
          <div style={cartIconWrapperStyles}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {itemCount > 0 && (
              <span style={itemCountBadgeStyles}>{itemCount}</span>
            )}
          </div>
          <div>
            <h3 style={titleStyles}>{t('cart.title', 'Your Cart')}</h3>
            <p style={subtitleStyles}>
              {t('cart.itemCount', { count: itemCount })} · {t('cart.total', { amount: cartTotal.toFixed(2) })}
            </p>
          </div>
        </div>
        
        {totalPotentialSavings > 0 && (
          <div style={savingsBadgeStyles}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {t('cart.potentialSavings', { amount: totalPotentialSavings.toFixed(2) })}
          </div>
        )}
      </div>

      {/* Savings Alert */}
      {totalPotentialSavings > 0 && (
        <div style={savingsAlertStyles}>
          <div style={savingsAlertIconStyles}>💰</div>
          <div style={savingsAlertContentStyles}>
            <p style={savingsAlertTitleStyles}>{t('cart.savingsOpportunity', 'Savings Opportunity!')}</p>
            <p style={savingsAlertTextStyles}>
              {t('cart.couldSave', { amount: totalPotentialSavings.toFixed(2) })}
            </p>
          </div>
        </div>
      )}

      {/* Cart Items */}
      <div style={itemsListStyles}>
        {cartItems.map((item, index) => (
          <div key={item.productId || index} style={itemStyles}>
            {/* Item Image */}
            <div style={itemImageWrapperStyles}>
              <img
                src={item.imageUrl || item.product_main_image_url}
                alt={item.title}
                style={itemImageStyles}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.style.backgroundColor = '#f3f4f6';
                }}
              />
              {item.quantity > 1 && (
                <span style={quantityBadgeStyles}>×{item.quantity}</span>
              )}
            </div>

            {/* Item Details */}
            <div style={itemDetailsStyles}>
              <p style={itemTitleStyles}>
                {(item.title || item.product_title || '').substring(0, 60)}
                {(item.title || item.product_title || '').length > 60 ? '...' : ''}
              </p>
              <p style={itemPriceStyles}>${(item.price * (item.quantity || 1)).toFixed(2)}</p>
              
              {/* Savings info for this item */}
              {potentialSavings[item.productId] && (
                <div style={itemSavingsStyles}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={itemSavingsTextStyles}>
                    {t('cart.itemSavings', { amount: potentialSavings[item.productId].amount.toFixed(2) })}
                  </span>
                </div>
              )}
            </div>

            {/* Find Cheaper Button */}
            <button
              onClick={() => handleFindCheaper(item)}
              disabled={searchingItemId === item.productId}
              style={findCheaperButtonStyles(searchingItemId === item.productId)}
            >
              {searchingItemId === item.productId ? (
                <div style={miniSpinnerStyles} />
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                    <path d="M8 11h6" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span>{t('cart.findCheaper', 'Find Cheaper')}</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Footer Action */}
      <div style={footerStyles}>
        <button 
          style={saveAllButtonStyles}
          onClick={() => cartItems.forEach(item => handleFindCheaper(item))}
          disabled={isLoading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {t('cart.saveOnAll', 'Save on All Items')}
        </button>
      </div>
    </div>
  );
}

// Styles
const containerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '16px',
};

const emptyContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
  gap: '12px',
  textAlign: 'center',
};

const emptyTextStyles = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#6b7280',
  margin: 0,
};

const emptySubtextStyles = {
  fontSize: '13px',
  color: '#9ca3af',
  margin: 0,
};

const headerStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: '12px',
  borderBottom: '1px solid #e5e7eb',
};

const headerLeftStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const cartIconWrapperStyles = {
  position: 'relative',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#fef3c7',
  color: '#f59e0b',
  borderRadius: '10px',
};

const itemCountBadgeStyles = {
  position: 'absolute',
  top: '-4px',
  right: '-4px',
  width: '18px',
  height: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#ee0979',
  color: 'white',
  fontSize: '10px',
  fontWeight: 700,
  borderRadius: '50%',
  border: '2px solid white',
};

const titleStyles = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#1f2937',
  margin: '0 0 2px 0',
};

const subtitleStyles = {
  fontSize: '13px',
  color: '#6b7280',
  margin: 0,
};

const savingsBadgeStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  backgroundColor: '#dcfce7',
  color: '#166534',
  fontSize: '12px',
  fontWeight: 600,
  borderRadius: '20px',
};

const savingsAlertStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  backgroundColor: 'linear-gradient(135deg, #fef3c7, #fde68a)',
  background: '#fef3c7',
  borderRadius: '12px',
  border: '1px solid #fcd34d',
};

const savingsAlertIconStyles = {
  fontSize: '24px',
  lineHeight: 1,
};

const savingsAlertContentStyles = {
  flex: 1,
};

const savingsAlertTitleStyles = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#92400e',
  margin: '0 0 2px 0',
};

const savingsAlertTextStyles = {
  fontSize: '13px',
  color: '#a16207',
  margin: 0,
};

const itemsListStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const itemStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px',
  backgroundColor: '#f9fafb',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
};

const itemImageWrapperStyles = {
  position: 'relative',
  width: '60px',
  height: '60px',
  borderRadius: '8px',
  overflow: 'hidden',
  flexShrink: 0,
  backgroundColor: '#f3f4f6',
};

const itemImageStyles = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const quantityBadgeStyles = {
  position: 'absolute',
  bottom: '2px',
  right: '2px',
  padding: '2px 6px',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  fontSize: '10px',
  fontWeight: 600,
  borderRadius: '4px',
};

const itemDetailsStyles = {
  flex: 1,
  minWidth: 0,
};

const itemTitleStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  margin: '0 0 4px 0',
  lineHeight: 1.4,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const itemPriceStyles = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#1f2937',
  margin: '0 0 4px 0',
};

const itemSavingsStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  color: '#22c55e',
  fontWeight: 600,
};

const itemSavingsTextStyles = {
  fontSize: '11px',
};

const findCheaperButtonStyles = (isLoading) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  backgroundColor: isLoading ? '#f3f4f6' : '#ee0979',
  color: isLoading ? '#9ca3af' : 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: isLoading ? 'not-allowed' : 'pointer',
  transition: 'all 0.2s ease',
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

const miniSpinnerStyles = {
  width: '14px',
  height: '14px',
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: 'white',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const footerStyles = {
  paddingTop: '12px',
  borderTop: '1px solid #e5e7eb',
};

const saveAllButtonStyles = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '14px 20px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};
