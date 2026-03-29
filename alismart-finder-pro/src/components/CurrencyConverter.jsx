import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_CURRENCIES,
  loadCurrencySettings,
  saveCurrencySettings,
  getExchangeRates,
  calculatePriceWithFees
} from '../services/api.js';

/**
 * CurrencyConverter Component
 * ממיר מטבעות ועמלות בנקים
 * 
 * תכונות:
 * - בחירת מטבע מקומי
 * - הגדרת אחוז עמלת בנק
 * - תצוגת שער חליפין עדכני
 * - חישוב מחיר סופי כולל עמלות
 * - עיצוב Quiet Luxury
 */

export default function CurrencyConverter({ usdPrice = 0, showPreview = true }) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState({ code: 'ILS', bankFee: 2.5 });
  const [exchangeRate, setExchangeRate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [calculation, setCalculation] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const isRTL = i18n.language === 'he';

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (exchangeRate && usdPrice > 0) {
      const calc = calculatePriceWithFees({
        usdPrice,
        targetCurrency: settings.code,
        bankFeePercent: settings.bankFee,
        exchangeRates: { rates: { [settings.code]: exchangeRate } }
      });
      setCalculation(calc);
    }
  }, [settings, exchangeRate, usdPrice]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const savedSettings = await loadCurrencySettings();
      setSettings(savedSettings);
      
      // טעינת שער חליפין
      const rates = await getExchangeRates();
      const rate = rates?.rates?.[savedSettings.code];
      setExchangeRate(rate);
    } catch (error) {
      console.error('[CurrencyConverter] Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCurrencyChange = async (currencyCode) => {
    const newSettings = { ...settings, code: currencyCode };
    setSettings(newSettings);
    await saveCurrencySettings(newSettings);
    
    // עדכון שער
    const rates = await getExchangeRates();
    const rate = rates?.rates?.[currencyCode];
    setExchangeRate(rate);
  };

  const handleFeeChange = async (feePercent) => {
    const newSettings = { ...settings, bankFee: parseFloat(feePercent) };
    setSettings(newSettings);
    await saveCurrencySettings(newSettings);
  };

  if (isLoading) {
    return (
      <div style={loadingStyles}>
        <div style={spinnerStyles} />
      </div>
    );
  }

  const currency = SUPPORTED_CURRENCIES[settings.code];
  const currencyName = isRTL ? currency.nameHe : currency.name;

  return (
    <div style={containerStyles(isRTL)}>
      {/* Header */}
      <div style={headerStyles}>
        <div style={titleContainerStyles}>
          <span style={currencyIconStyles}>{currency.symbol}</span>
          <div>
            <h3 style={titleStyles}>{t('currency.title', 'Currency Converter')}</h3>
            <p style={subtitleStyles}>
              {exchangeRate && (
                <>
                  {t('currency.rate', 'Rate')}: 1 USD = {exchangeRate.toFixed(3)} {currency.symbol}
                </>
              )}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          style={settingsButtonStyles}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={settingsPanelStyles}>
          {/* Currency Selector */}
          <div style={settingRowStyles}>
            <label style={settingLabelStyles}>{t('currency.localCurrency', 'Local Currency')}</label>
            <select
              value={settings.code}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              style={selectStyles}
            >
              {Object.values(SUPPORTED_CURRENCIES).map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {isRTL ? curr.nameHe : curr.name} ({curr.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Bank Fee Slider */}
          <div style={settingRowStyles}>
            <label style={settingLabelStyles}>
              {t('currency.bankFee', 'Bank Conversion Fee')}
              <span style={feeValueStyles}>{settings.bankFee.toFixed(1)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.bankFee}
              onChange={(e) => handleFeeChange(e.target.value)}
              style={sliderStyles}
            />
            <div style={sliderLabelsStyles}>
              <span>0%</span>
              <span>2.5%</span>
              <span>5%</span>
            </div>
          </div>
        </div>
      )}

      {/* Price Preview */}
      {showPreview && usdPrice > 0 && calculation && (
        <div style={previewCardStyles}>
          <div style={priceRowStyles}>
            <span style={priceLabelStyles}>{t('currency.original', 'Original')}</span>
            <span style={originalPriceStyles}>${usdPrice.toFixed(2)} USD</span>
          </div>
          
          <div style={conversionArrowStyles}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </div>

          <div style={finalPriceContainerStyles}>
            <span style={finalPriceLabelStyles}>{t('currency.finalPrice', 'Final Price')}</span>
            <span style={finalPriceStyles}>
              {currency.symbol}{calculation.finalPrice.toFixed(2)}
            </span>
            <span style={feeNoteStyles}>
              {t('currency.includesFee', 'Includes {{fee}}% bank fee', { fee: settings.bankFee.toFixed(1) })}
            </span>
          </div>

          {/* Breakdown */}
          <div style={breakdownStyles}>
            <div style={breakdownRowStyles}>
              <span style={breakdownLabelStyles}>{t('currency.converted', 'Converted')}</span>
              <span style={breakdownValueStyles}>
                {currency.symbol}{calculation.convertedPrice.toFixed(2)}
              </span>
            </div>
            <div style={breakdownRowStyles}>
              <span style={breakdownLabelStyles}>{t('currency.bankFeeAmount', 'Bank Fee')}</span>
              <span style={breakdownFeeStyles}>
                +{currency.symbol}{calculation.bankFee.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No Price Message */}
      {showPreview && usdPrice <= 0 && (
        <div style={noPriceStyles}>
          <p>{t('currency.noPrice', 'Select a product to see conversion')}</p>
        </div>
      )}

      {/* Disclaimer */}
      <p style={disclaimerStyles}>
        {t('currency.disclaimer', 'Exchange rate is for estimation only. Actual rate depends on settlement date.')}
      </p>
    </div>
  );
}

// Styles
const containerStyles = (isRTL) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px',
  backgroundColor: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  direction: isRTL ? 'rtl' : 'ltr',
});

const loadingStyles = {
  display: 'flex',
  justifyContent: 'center',
  padding: '40px',
};

const spinnerStyles = {
  width: '28px',
  height: '28px',
  border: '3px solid #f3f4f6',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const headerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};

const titleContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const currencyIconStyles = {
  fontSize: '32px',
  fontWeight: 300,
  color: '#ee0979',
};

const titleStyles = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#1f2937',
  margin: 0,
};

const subtitleStyles = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '4px 0 0 0',
};

const settingsButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  color: '#64748b',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const settingsPanelStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '16px',
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
};

const settingRowStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const settingLabelStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
};

const feeValueStyles = {
  color: '#ee0979',
  fontWeight: 700,
};

const selectStyles = {
  padding: '10px 12px',
  fontSize: '14px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  backgroundColor: 'white',
  color: '#374151',
  cursor: 'pointer',
};

const sliderStyles = {
  width: '100%',
  height: '6px',
  WebkitAppearance: 'none',
  appearance: 'none',
  background: 'linear-gradient(to right, #e2e8f0, #ee0979)',
  borderRadius: '3px',
  outline: 'none',
  cursor: 'pointer',
};

const sliderLabelsStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '11px',
  color: '#94a3b8',
  marginTop: '4px',
};

const previewCardStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  backgroundColor: '#fef7ff',
  borderRadius: '12px',
  border: '1px solid #f3e8ff',
};

const priceRowStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const priceLabelStyles = {
  fontSize: '13px',
  color: '#6b7280',
};

const originalPriceStyles = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#374151',
};

const conversionArrowStyles = {
  display: 'flex',
  justifyContent: 'center',
};

const finalPriceContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '12px',
  backgroundColor: 'white',
  borderRadius: '10px',
  border: '1px solid #e9d5ff',
};

const finalPriceLabelStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#7c3aed',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const finalPriceStyles = {
  fontSize: '36px',
  fontWeight: 800,
  color: '#1f2937',
  letterSpacing: '-0.5px',
};

const feeNoteStyles = {
  fontSize: '11px',
  color: '#6b7280',
};

const breakdownStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  paddingTop: '12px',
  borderTop: '1px dashed #e2e8f0',
};

const breakdownRowStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '13px',
};

const breakdownLabelStyles = {
  color: '#6b7280',
};

const breakdownValueStyles = {
  fontWeight: 600,
  color: '#374151',
};

const breakdownFeeStyles = {
  fontWeight: 600,
  color: '#f59e0b',
};

const noPriceStyles = {
  display: 'flex',
  justifyContent: 'center',
  padding: '30px',
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  color: '#94a3b8',
  fontSize: '13px',
};

const disclaimerStyles = {
  fontSize: '11px',
  color: '#94a3b8',
  textAlign: 'center',
  margin: 0,
  lineHeight: 1.4,
};
