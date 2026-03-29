import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * PriceAlertModal Component
 * מודל הגדרת התראת מחיר
 * 
 * מאפשר למשתמש להגדיר מחיר יעד למוצר ולקבל התראה כשהמחיר יורד
 */

export default function PriceAlertModal({ 
  isOpen, 
  onClose, 
  product, 
  onSave,
  existingAlert = null,
}) {
  const { t } = useTranslation();
  const [targetPrice, setTargetPrice] = useState('');
  const [dropPercent, setDropPercent] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // חישוב מחיר ברירת מחדל
  useEffect(() => {
    if (product?.price) {
      const currentPrice = parseFloat(product.price);
      const defaultTarget = currentPrice * 0.9; // 10% הנחה
      setTargetPrice(defaultTarget.toFixed(2));
    }
  }, [product]);

  // טעינת ערכים קיימים אם יש
  useEffect(() => {
    if (existingAlert) {
      setTargetPrice(existingAlert.targetPrice?.toFixed(2) || '');
      setDropPercent(calculateDropPercent(existingAlert.originalPrice, existingAlert.targetPrice));
      setIsActive(existingAlert.isActive !== false);
    }
  }, [existingAlert]);

  if (!isOpen || !product) return null;

  const currentPrice = parseFloat(product.price) || 0;
  const targetValue = parseFloat(targetPrice) || 0;
  const savings = currentPrice - targetValue;
  const percentDrop = currentPrice > 0 ? ((savings / currentPrice) * 100).toFixed(1) : 0;

  const handleSave = async () => {
    if (!targetValue || targetValue >= currentPrice) return;
    
    setIsSaving(true);
    
    const alertData = {
      productId: product.productId,
      productTitle: product.product_title || product.title,
      productImage: product.product_main_image_url || product.imageUrl || product.img,
      originalPrice: currentPrice,
      targetPrice: targetValue,
      isActive,
    };
    
    const result = await onSave(alertData);
    
    setIsSaving(false);
    
    if (result?.success !== false) {
      onClose();
    }
  };

  const handleDropPercentChange = (percent) => {
    setDropPercent(percent);
    const newTarget = currentPrice * (1 - percent / 100);
    setTargetPrice(newTarget.toFixed(2));
  };

  const handleTargetPriceChange = (value) => {
    setTargetPrice(value);
    const numeric = parseFloat(value);
    if (numeric > 0 && currentPrice > 0) {
      const percent = ((currentPrice - numeric) / currentPrice * 100);
      setDropPercent(Math.max(0, Math.min(90, percent)));
    }
  };

  const isValid = targetValue > 0 && targetValue < currentPrice;

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={modalStyles} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyles}>
          <div style={headerIconStyles}>🔔</div>
          <div>
            <h3 style={titleStyles}>{t('priceAlert.title', 'Price Alert')}</h3>
            <p style={subtitleStyles}>{t('priceAlert.subtitle', 'Get notified when the price drops')}</p>
          </div>
          <button onClick={onClose} style={closeButtonStyles}>×</button>
        </div>

        {/* Product Info */}
        <div style={productInfoStyles}>
          <img 
            src={product.product_main_image_url || product.imageUrl || product.img} 
            alt=""
            style={productImageStyles}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div style={productDetailsStyles}>
            <p style={productTitleStyles}>
              {(product.product_title || product.title || '').substring(0, 60)}
              {(product.product_title || product.title || '').length > 60 ? '...' : ''}
            </p>
            <p style={currentPriceStyles}>
              {t('priceAlert.currentPrice', 'Current')}: <strong>${currentPrice.toFixed(2)}</strong>
            </p>
          </div>
        </div>

        {/* Target Price Input */}
        <div style={inputSectionStyles}>
          <label style={labelStyles}>{t('priceAlert.targetPrice', 'Target Price')}</label>
          
          <div style={priceInputContainerStyles}>
            <span style={currencyStyles}>$</span>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => handleTargetPriceChange(e.target.value)}
              style={priceInputStyles}
              step="0.01"
              min="0.01"
              max={currentPrice - 0.01}
            />
          </div>

          {/* Quick Selectors */}
          <div style={quickSelectorsStyles}>
            <span style={quickLabelStyles}>{t('priceAlert.orSave', 'Or save')}:</span>
            {[5, 10, 15, 20, 25].map((percent) => (
              <button
                key={percent}
                onClick={() => handleDropPercentChange(percent)}
                style={percentButtonStyles(dropPercent === percent)}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>

        {/* Savings Preview */}
        {isValid && (
          <div style={savingsPreviewStyles}>
            <div style={savingsBoxStyles}>
              <span style={savingsLabelStyles}>{t('priceAlert.youSave', 'You save')}</span>
              <span style={savingsValueStyles}>${savings.toFixed(2)}</span>
              <span style={savingsPercentStyles}>({percentDrop}%)</span>
            </div>
          </div>
        )}

        {/* Status Toggle */}
        <div style={statusSectionStyles}>
          <label style={statusLabelStyles}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={checkboxStyles}
            />
            <span>{t('priceAlert.active', 'Alert active')}</span>
          </label>
        </div>

        {/* Info Note */}
        <div style={infoBoxStyles}>
          <span style={infoIconStyles}>ℹ️</span>
          <p style={infoTextStyles}>
            {t('priceAlert.info', 'We\'ll check the price every hour and notify you when it drops below your target.')}
          </p>
        </div>

        {/* Actions */}
        <div style={actionsStyles}>
          <button onClick={onClose} style={cancelButtonStyles}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button 
            onClick={handleSave} 
            disabled={!isValid || isSaving}
            style={saveButtonStyles(isValid && !isSaving)}
          >
            {isSaving 
              ? t('common.saving', 'Saving...')
              : existingAlert 
                ? t('priceAlert.update', 'Update Alert')
                : t('priceAlert.create', 'Create Alert')
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper
function calculateDropPercent(original, target) {
  if (!original || !target) return 10;
  return Math.round(((original - target) / original) * 100);
}

// Styles
const overlayStyles = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  padding: '20px',
};

const modalStyles = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '420px',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  animation: 'slideUp 0.3s ease',
};

const headerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '20px 20px 16px',
  borderBottom: '1px solid #f3f4f6',
  position: 'relative',
};

const headerIconStyles = {
  fontSize: '28px',
  lineHeight: 1,
};

const titleStyles = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#1f2937',
  margin: '0 0 4px 0',
};

const subtitleStyles = {
  fontSize: '13px',
  color: '#6b7280',
  margin: 0,
};

const closeButtonStyles = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: '#f3f4f6',
  color: '#6b7280',
  fontSize: '20px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const productInfoStyles = {
  display: 'flex',
  gap: '12px',
  padding: '16px 20px',
  backgroundColor: '#f9fafb',
};

const productImageStyles = {
  width: '60px',
  height: '60px',
  objectFit: 'cover',
  borderRadius: '8px',
  backgroundColor: '#e5e7eb',
};

const productDetailsStyles = {
  flex: 1,
  minWidth: 0,
};

const productTitleStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  margin: '0 0 6px 0',
  lineHeight: 1.4,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const currentPriceStyles = {
  fontSize: '13px',
  color: '#6b7280',
  margin: 0,
};

const inputSectionStyles = {
  padding: '20px',
};

const labelStyles = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '10px',
};

const priceInputContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '16px',
};

const currencyStyles = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#6b7280',
};

const priceInputStyles = {
  flex: 1,
  padding: '12px 16px',
  fontSize: '24px',
  fontWeight: 700,
  color: '#1f2937',
  border: '2px solid #e5e7eb',
  borderRadius: '10px',
  outline: 'none',
  transition: 'border-color 0.2s ease',
  textAlign: 'center',
};

const quickSelectorsStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
};

const quickLabelStyles = {
  fontSize: '13px',
  color: '#6b7280',
};

const percentButtonStyles = (isSelected) => ({
  padding: '6px 12px',
  borderRadius: '20px',
  border: isSelected ? '2px solid #ee0979' : '1px solid #e5e7eb',
  backgroundColor: isSelected ? '#fef2f2' : '#ffffff',
  color: isSelected ? '#ee0979' : '#6b7280',
  fontSize: '13px',
  fontWeight: isSelected ? 600 : 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
});

const savingsPreviewStyles = {
  padding: '0 20px 16px',
};

const savingsBoxStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '16px',
  backgroundColor: '#f0fdf4',
  borderRadius: '12px',
  border: '1px solid #bbf7d0',
};

const savingsLabelStyles = {
  fontSize: '14px',
  color: '#22c55e',
};

const savingsValueStyles = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#22c55e',
};

const savingsPercentStyles = {
  fontSize: '14px',
  color: '#22c55e',
  fontWeight: 500,
};

const statusSectionStyles = {
  padding: '0 20px 16px',
};

const statusLabelStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '14px',
  color: '#374151',
  cursor: 'pointer',
};

const checkboxStyles = {
  width: '18px',
  height: '18px',
  cursor: 'pointer',
};

const infoBoxStyles = {
  display: 'flex',
  gap: '10px',
  padding: '12px 16px',
  margin: '0 20px 20px',
  backgroundColor: '#eff6ff',
  borderRadius: '10px',
};

const infoIconStyles = {
  fontSize: '16px',
  lineHeight: 1,
};

const infoTextStyles = {
  fontSize: '12px',
  color: '#3b82f6',
  margin: 0,
  lineHeight: 1.5,
};

const actionsStyles = {
  display: 'flex',
  gap: '12px',
  padding: '0 20px 20px',
};

const cancelButtonStyles = {
  flex: 1,
  padding: '12px 20px',
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const saveButtonStyles = (isEnabled) => ({
  flex: 2,
  padding: '12px 20px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: isEnabled ? '#ee0979' : '#e5e7eb',
  color: isEnabled ? '#ffffff' : '#9ca3af',
  fontSize: '14px',
  fontWeight: 600,
  cursor: isEnabled ? 'pointer' : 'not-allowed',
  transition: 'all 0.2s ease',
});
