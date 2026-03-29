import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  calculateFinalLandingPrice,
  formatPriceBreakdown,
  compareShippingOptions,
  TAX_RULES_BY_COUNTRY,
  extractShippingInfoFromPage,
  parsePrice
} from '../services/utils.js';

/**
 * ShippingCalculator Component
 * מחשבון משלוח ומכס - מחיר "הכל כלול"
 * 
 * תכונות:
 * - חישוב Landed Cost כולל מע"מ ומכס
 * - פירוט אלגנטי של עלויות
 * - השוואת אפשרויות משלוח
 * - התראות חכמות על סף המכס
 * - עיצוב Quiet Luxury עם white space
 */

export default function ShippingCalculator({ product, countryCode = 'IL', shippingOptions = [] }) {
  const { t, i18n } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [selectedShipping, setSelectedShipping] = useState(0);
  const [calculation, setCalculation] = useState(null);
  const [shippingInfo, setShippingInfo] = useState(null);
  const [comparedOptions, setComparedOptions] = useState([]);

  const isRTL = i18n.language === 'he';
  const currency = product?.currency || 'USD';
  const productPrice = product?.priceValue || parsePrice(product?.price || '0');

  useEffect(() => {
    // חילוץ נתוני משלוח מהדף
    const info = extractShippingInfoFromPage();
    setShippingInfo(info);
  }, []);

  useEffect(() => {
    if (!productPrice) return;

    // חישוב מחיר סופי
    const shippingCost = shippingOptions[selectedShipping]?.priceValue || 0;
    const calc = calculateFinalLandingPrice({
      productPrice,
      shippingCost,
      quantity,
      countryCode,
      currency
    });
    setCalculation(calc);

    // השוואת אפשרויות משלוח
    if (shippingOptions.length > 1) {
      const compared = compareShippingOptions(shippingOptions, productPrice, countryCode);
      setComparedOptions(compared);
    }
  }, [productPrice, quantity, selectedShipping, shippingOptions, countryCode, currency]);

  if (!productPrice || !calculation) {
    return (
      <div style={emptyStyles}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
          <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
        <p style={emptyTextStyles}>{t('shipping.noProductData', 'No product data available')}</p>
      </div>
    );
  }

  const formatted = formatPriceBreakdown(calculation, i18n.language);
  const hasTaxes = calculation.totalTaxes > 0;
  const warning = calculation.thresholdWarning;

  return (
    <div style={containerStyles(isRTL)}>
      {/* Header - Total Landed Cost */}
      <div style={totalCardStyles}>
        <div style={totalLabelStyles}>{formatted.total.label}</div>
        <div style={totalValueStyles}>{formatted.total.value}</div>
        {calculation.isOverThreshold && (
          <div style={taxBadgeStyles}>
            {t('shipping.includesTaxes', 'Includes taxes & customs')}
          </div>
        )}
      </div>

      {/* Quantity Selector */}
      <div style={quantityContainerStyles}>
        <label style={quantityLabelStyles}>{t('shipping.quantity', 'Quantity')}:</label>
        <div style={quantityControlsStyles}>
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            style={quantityButtonStyles}
            disabled={quantity <= 1}
          >
            −
          </button>
          <span style={quantityValueStyles}>{quantity}</span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            style={quantityButtonStyles}
          >
            +
          </button>
        </div>
      </div>

      {/* Threshold Warning */}
      {warning && (
        <div style={warningStyles(warning.severity)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {warning.severity === 'warning' ? (
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            ) : (
              <circle cx="12" cy="12" r="10" />
            )}
          </svg>
          <span>{warning.message}</span>
        </div>
      )}

      {/* Cost Breakdown */}
      <div style={breakdownCardStyles}>
        <div style={breakdownTitleStyles}>{t('shipping.costBreakdown', 'Cost Breakdown')}</div>
        
        {/* Product Price */}
        <div style={breakdownRowStyles}>
          <span style={breakdownLabelStyles}>{formatted.product.label}</span>
          <span style={breakdownValueStyles}>{formatted.product.value}</span>
        </div>

        {/* Shipping */}
        <div style={breakdownRowStyles}>
          <span style={breakdownLabelStyles}>
            {formatted.shipping.label}
            {formatted.shipping.isFree && (
              <span style={freeTagStyles}>{t('shipping.free', 'FREE')}</span>
            )}
          </span>
          <span style={breakdownValueStyles}>{formatted.shipping.value}</span>
        </div>

        {/* Subtotal */}
        <div style={subtotalRowStyles}>
          <span style={subtotalLabelStyles}>{t('shipping.subtotal', 'Subtotal')}</span>
          <span style={subtotalValueStyles}>${calculation.subtotal.toFixed(2)}</span>
        </div>

        {/* Taxes (if any) */}
        {hasTaxes && (
          <div style={taxesSectionStyles}>
            <div style={taxDividerStyles} />
            <div style={taxesTitleStyles}>{t('shipping.taxesAndFees', 'Taxes & Fees')}</div>
            
            {calculation.breakdown.vat > 0 && (
              <div style={taxRowStyles}>
                <span style={taxLabelStyles}>
                  {formatted.taxes.vat.label}
                  <span style={taxRateStyles}>({(calculation.rules.vatRate * 100).toFixed(0)}%)</span>
                </span>
                <span style={taxValueStyles}>{formatted.taxes.vat.value}</span>
              </div>
            )}
            
            {calculation.breakdown.customs > 0 && (
              <div style={taxRowStyles}>
                <span style={taxLabelStyles}>{formatted.taxes.customs.label}</span>
                <span style={taxValueStyles}>{formatted.taxes.customs.value}</span>
              </div>
            )}
            
            {calculation.breakdown.handlingFee > 0 && (
              <div style={taxRowStyles}>
                <span style={taxLabelStyles}>{formatted.taxes.handling.label}</span>
                <span style={taxValueStyles}>{formatted.taxes.handling.value}</span>
              </div>
            )}
          </div>
        )}

        {/* Final Total */}
        <div style={finalTotalRowStyles}>
          <span style={finalTotalLabelStyles}>{formatted.total.label}</span>
          <span style={finalTotalValueStyles}>{formatted.total.value}</span>
        </div>
      </div>

      {/* Shipping Options Comparison */}
      {comparedOptions.length > 1 && (
        <div style={shippingOptionsCardStyles}>
          <div style={shippingOptionsTitleStyles}>{t('shipping.shippingOptions', 'Shipping Options')}</div>
          {comparedOptions.map((option, index) => (
            <div
              key={index}
              onClick={() => setSelectedShipping(index)}
              style={shippingOptionStyles(selectedShipping === index, option.isBestValue)}
            >
              <div style={shippingOptionHeaderStyles}>
                <span style={shippingOptionNameStyles}>{option.name || option.method}</span>
                {option.isBestValue && (
                  <span style={bestValueBadgeStyles}>{t('shipping.bestValue', 'Best Value')}</span>
                )}
              </div>
              <div style={shippingOptionDetailsStyles}>
                <span style={shippingOptionTimeStyles}>{option.deliveryTime}</span>
                <span style={shippingOptionPriceStyles}>${option.totalCost.toFixed(2)}</span>
              </div>
              {option.isOverThreshold && (
                <span style={includesTaxesTagStyles}>{t('shipping.includesTaxes', 'Includes taxes')}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Country Info */}
      <div style={countryInfoStyles}>
        <span style={countryFlagStyles}>🌍</span>
        <span style={countryNameStyles}>
          {isRTL ? calculation.rules.nameHe : calculation.rules.name}
        </span>
        <span style={thresholdInfoStyles}>
          {t('shipping.taxFreeThreshold', 'Tax-free threshold')}: ${calculation.rules.customsThreshold}
        </span>
      </div>

      {/* Disclaimer */}
      <div style={disclaimerStyles}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>{formatted.disclaimer}</span>
      </div>
    </div>
  );
}

// Styles
const containerStyles = (isRTL) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '16px',
  direction: isRTL ? 'rtl' : 'ltr',
});

const emptyStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 16px',
  gap: '12px',
};

const emptyTextStyles = {
  fontSize: '14px',
  color: '#9ca3af',
  margin: 0,
};

const totalCardStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px 24px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  borderRadius: '16px',
  color: 'white',
  textAlign: 'center',
};

const totalLabelStyles = {
  fontSize: '13px',
  fontWeight: 500,
  opacity: 0.9,
  marginBottom: '4px',
};

const totalValueStyles = {
  fontSize: '32px',
  fontWeight: 700,
  letterSpacing: '-0.5px',
};

const taxBadgeStyles = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '4px 10px',
  backgroundColor: 'rgba(255,255,255,0.2)',
  borderRadius: '20px',
  marginTop: '8px',
};

const quantityContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
};

const quantityLabelStyles = {
  fontSize: '14px',
  fontWeight: 500,
  color: '#374151',
};

const quantityControlsStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const quantityButtonStyles = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '18px',
  fontWeight: 500,
  color: '#374151',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const quantityValueStyles = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#1f2937',
  minWidth: '24px',
  textAlign: 'center',
};

const warningStyles = (severity) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 16px',
  backgroundColor: severity === 'warning' ? '#fef3c7' : '#dbeafe',
  border: `1px solid ${severity === 'warning' ? '#fcd34d' : '#93c5fd'}`,
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 500,
  color: severity === 'warning' ? '#92400e' : '#1e40af',
});

const breakdownCardStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '20px',
  backgroundColor: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const breakdownTitleStyles = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#1f2937',
  marginBottom: '4px',
};

const breakdownRowStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const breakdownLabelStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  color: '#6b7280',
};

const breakdownValueStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
};

const freeTagStyles = {
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 6px',
  backgroundColor: '#dcfce7',
  color: '#166534',
  borderRadius: '4px',
};

const subtotalRowStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '12px',
  borderTop: '1px dashed #e5e7eb',
};

const subtotalLabelStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
};

const subtotalValueStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
};

const taxesSectionStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const taxDividerStyles = {
  height: '1px',
  backgroundColor: '#f3f4f6',
  margin: '4px 0',
};

const taxesTitleStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const taxRowStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingLeft: '8px',
};

const taxLabelStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '13px',
  color: '#6b7280',
};

const taxRateStyles = {
  fontSize: '11px',
  color: '#9ca3af',
};

const taxValueStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#ef4444',
};

const finalTotalRowStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '12px',
  borderTop: '2px solid #e5e7eb',
};

const finalTotalLabelStyles = {
  fontSize: '15px',
  fontWeight: 700,
  color: '#1f2937',
};

const finalTotalValueStyles = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#1f2937',
};

const shippingOptionsCardStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const shippingOptionsTitleStyles = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#1f2937',
  marginBottom: '4px',
};

const shippingOptionStyles = (isSelected, isBestValue) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '14px 16px',
  backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
  border: `2px solid ${isSelected ? '#3b82f6' : isBestValue ? '#22c55e' : '#e5e7eb'}`,
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s',
});

const shippingOptionHeaderStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const shippingOptionNameStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
};

const bestValueBadgeStyles = {
  fontSize: '10px',
  fontWeight: 700,
  padding: '3px 8px',
  backgroundColor: '#dcfce7',
  color: '#166534',
  borderRadius: '12px',
};

const shippingOptionDetailsStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const shippingOptionTimeStyles = {
  fontSize: '12px',
  color: '#6b7280',
};

const shippingOptionPriceStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#1f2937',
};

const includesTaxesTagStyles = {
  fontSize: '10px',
  color: '#9ca3af',
};

const countryInfoStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 16px',
  backgroundColor: '#f3f4f6',
  borderRadius: '10px',
};

const countryFlagStyles = {
  fontSize: '18px',
};

const countryNameStyles = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  flex: 1,
};

const thresholdInfoStyles = {
  fontSize: '11px',
  color: '#6b7280',
};

const disclaimerStyles = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  padding: '12px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  fontSize: '11px',
  color: '#9ca3af',
  lineHeight: 1.4,
};
