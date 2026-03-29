import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import PriceAlertModal from './PriceAlertModal';
import { 
  addPriceAlert, 
  removePriceAlert, 
  hasPriceAlert 
} from '../services/priceAlerts';

/**
 * PriceAlertButton Component
 * כפתור פעמון להגדרת התראת מחיר
 * 
 * מוצג בכל ProductCard עם אייקון פעמון
 * פותח מודל הגדרת התראה בלחיצה
 */

export default function PriceAlertButton({ product, compact = false, onAlertChange }) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasAlert, setHasAlert] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [existingAlert, setExistingAlert] = useState(null);

  // בדיקה האם יש כבר התראה למוצר
  React.useEffect(() => {
    const checkAlert = async () => {
      if (!product?.productId) {
        setIsChecking(false);
        return;
      }
      
      try {
        const exists = await hasPriceAlert(product.productId);
        setHasAlert(exists);
        
        if (exists) {
          const { getPriceAlert } = await import('../services/priceAlerts');
          const alert = await getPriceAlert(product.productId);
          setExistingAlert(alert);
        }
      } catch (e) {
        console.error('[PriceAlertButton] Failed to check alert:', e);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkAlert();
  }, [product?.productId]);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSaveAlert = useCallback(async (alertData) => {
    let result;
    
    if (hasAlert && existingAlert) {
      // עדכון התראה קיימת
      const { updatePriceAlert } = await import('../services/priceAlerts');
      result = await updatePriceAlert(product.productId, {
        targetPrice: alertData.targetPrice,
        isActive: alertData.isActive,
      });
    } else {
      // יצירת התראה חדשה
      result = await addPriceAlert(alertData);
    }
    
    if (result.success) {
      setHasAlert(alertData.isActive);
      setExistingAlert(result.alert || { ...existingAlert, ...alertData });
      
      if (onAlertChange) {
        onAlertChange(product.productId, alertData.isActive);
      }
    }
    
    return result;
  }, [hasAlert, existingAlert, product?.productId, onAlertChange]);

  const handleRemoveAlert = useCallback(async (e) => {
    e.stopPropagation();
    
    if (!product?.productId) return;
    
    const result = await removePriceAlert(product.productId);
    
    if (result.success) {
      setHasAlert(false);
      setExistingAlert(null);
      
      if (onAlertChange) {
        onAlertChange(product.productId, false);
      }
    }
  }, [product?.productId, onAlertChange]);

  if (isChecking) {
    return (
      <button 
        style={compact ? compactButtonStyles : buttonStyles}
        disabled
      >
        <span style={{ opacity: 0.5 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <>
      {compact ? (
        // מצב קומפקטי - כפתור קטן
        <button
          onClick={handleOpenModal}
          onContextMenu={hasAlert ? handleRemoveAlert : undefined}
          style={compactButtonStyles}
          title={hasAlert 
            ? t('priceAlert.hasAlert', 'Price alert set (right-click to remove)') 
            : t('priceAlert.setAlert', 'Set price alert')
          }
        >
          {hasAlert ? (
            <span style={{ color: '#ee0979' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                <circle cx="12" cy="4" r="2" fill="#22c55e" />
              </svg>
            </span>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          )}
        </button>
      ) : (
        // מצב מלא - כפתור עם טקסט
        <button
          onClick={handleOpenModal}
          style={buttonStyles}
        >
          <span style={iconContainerStyles(hasAlert)}>
            {hasAlert ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                <circle cx="12" cy="4" r="2" fill="#22c55e" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            )}
          </span>
          <span style={textStyles}>
            {hasAlert 
              ? t('priceAlert.active', 'Alert Active')
              : t('priceAlert.notifyMe', 'Notify Me')
            }
          </span>
        </button>
      )}

      {/* מודל הגדרת התראה */}
      <PriceAlertModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        product={product}
        onSave={handleSaveAlert}
        existingAlert={existingAlert}
      />
    </>
  );
}

// Styles
const buttonStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  color: '#6b7280',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const compactButtonStyles = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  color: '#6b7280',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  padding: 0,
};

const iconContainerStyles = (hasAlert) => ({
  display: 'flex',
  alignItems: 'center',
  color: hasAlert ? '#ee0979' : '#6b7280',
});

const textStyles = {
  fontSize: '13px',
  fontWeight: 500,
};
