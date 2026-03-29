import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area
} from 'recharts';
import { getMarketTrend, prepareChartData } from '../services/api.js';

/**
 * PriceTrendChart Component
 * גרף השוואת ירידות מחיר - Price Drop Trend Analysis
 * 
 * תכונות:
 * - Multi-line chart עם מוצר נוכחי vs ממוצע שוק
 * - ממוצע נע (7 ימים)
 * - המלצת קנייה חכמה
 * - מד חום (Hot/Cold Market Indicator)
 * - עיצוב Quiet Luxury - נקי ומינימליסטי
 */

export default function PriceTrendChart({ product, similarProducts = [] }) {
  const { t, i18n } = useTranslation();
  const [trendData, setTrendData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const isRTL = i18n.language === 'he';

  useEffect(() => {
    loadTrendData();
  }, [product, similarProducts]);

  const loadTrendData = async () => {
    if (!product) return;
    
    setIsLoading(true);
    try {
      const data = await getMarketTrend(similarProducts, product);
      if (data) {
        setTrendData(data);
        const prepared = prepareChartData(data);
        setChartData(prepared);
      }
    } catch (error) {
      console.error('[PriceTrendChart] Failed to load trend data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={loadingContainerStyles}>
        <div style={spinnerStyles} />
        <span style={loadingTextStyles}>{t('trends.analyzing', 'Analyzing market trends...')}</span>
      </div>
    );
  }

  if (!trendData || chartData.length === 0) {
    return (
      <div style={emptyContainerStyles}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
          <path d="M3 3v18h18" />
          <path d="M18 9l-5 5-4-4-3 3" />
        </svg>
        <p style={emptyTextStyles}>{t('trends.noData', 'Insufficient data for trend analysis')}</p>
      </div>
    );
  }

  const { trends, buyingAdvice, marketStatus, currentProduct, marketAverage } = trendData;
  
  // מחירים לציר Y
  const prices = chartData.map(d => d.productPrice || d.marketAverage).filter(Boolean);
  const minPrice = Math.min(...prices) * 0.95;
  const maxPrice = Math.max(...prices) * 1.05;

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={tooltipStyles}>
          <p style={tooltipLabelStyles}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={tooltipItemStyles(entry.color)}>
              <span style={tooltipDotStyles(entry.color)} />
              {entry.name}: ${entry.value?.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={containerStyles(isRTL)}>
      {/* Header with Market Status */}
      <div style={headerStyles}>
        <div>
          <h3 style={titleStyles}>{t('trends.priceTrend', 'Price Trend Analysis')}</h3>
          <p style={subtitleStyles}>{t('trends.vsMarket', 'vs Market Average')}</p>
        </div>
        
        {/* Market Heat Indicator */}
        <div style={heatIndicatorStyles}>
          <div 
            style={heatBadgeStyles(marketStatus.color)}
            title={isRTL ? marketStatus.labelHe : marketStatus.label}
          >
            <span style={heatIconStyles}>{marketStatus.status === 'hot' ? '🔥' : marketStatus.status === 'cold' ? '❄️' : '📊'}</span>
            <span style={heatLabelStyles}>{isRTL ? marketStatus.labelHe : marketStatus.label}</span>
            <div style={heatMeterStyles}>
              <div 
                style={{
                  ...heatMeterFillStyles,
                  width: `${marketStatus.score}%`,
                  backgroundColor: marketStatus.color
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Buying Advice Card */}
      <div style={adviceCardStyles(buyingAdvice.action)}>
        <div style={adviceIconStyles}>{buyingAdvice.icon}</div>
        <div style={adviceContentStyles}>
          <p style={adviceMessageStyles}>
            {isRTL ? buyingAdvice.messageHe : buyingAdvice.message}
          </p>
          <div style={adviceMetaStyles}>
            <span style={confidenceStyles}>
              {t('trends.confidence', 'Confidence')}: {buyingAdvice.confidence}%
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={chartContainerStyles}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#f1f5f9" 
              vertical={false}
            />
            <XAxis 
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              interval={6}
            />
            <YAxis 
              domain={[minPrice, maxPrice]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* ממוצע שוק - קו מקווקו עדין */}
            <Line
              type="monotone"
              dataKey="marketAverage"
              name={t('trends.marketAverage', 'Market Average')}
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: '#94a3b8' }}
              connectNulls
            />
            
            {/* מוצר נוכחי - קו עבה ורוד-כתום */}
            <Line
              type="monotone"
              dataKey="productPrice"
              name={t('trends.thisProduct', 'This Product')}
              stroke="#ee0979"
              strokeWidth={3}
              dot={{ r: 3, fill: '#ee0979', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#ee0979', stroke: '#fff', strokeWidth: 2 }}
              connectNulls
            />
            
            {/* קו ייחוס - ממוצע נע */}
            {trends.currentMovingAvg7 > 0 && (
              <ReferenceLine 
                y={trends.currentMovingAvg7} 
                stroke="#ff6a00" 
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={legendStyles}>
        <div style={legendItemStyles}>
          <span style={{ ...legendDotStyles, backgroundColor: '#ee0979' }} />
          <span style={legendTextStyles}>{t('trends.thisProduct', 'This Product')}</span>
        </div>
        <div style={legendItemStyles}>
          <span style={{ 
            ...legendDotStyles, 
            backgroundColor: 'transparent',
            border: '2px dashed #94a3b8'
          }} />
          <span style={legendTextStyles}>{t('trends.marketAverage', 'Market Average')}</span>
        </div>
      </div>

      {/* Trend Stats */}
      <div style={statsContainerStyles}>
        <div style={statBoxStyles}>
          <span style={statLabelStyles}>{t('trends.change30d', '30-Day Change')}</span>
          <span style={{
            ...statValueStyles,
            color: trends.currentChange < 0 ? '#22c55e' : trends.currentChange > 0 ? '#ef4444' : '#6b7280'
          }}>
            {trends.currentChange > 0 ? '+' : ''}{trends.currentChange.toFixed(1)}%
          </span>
        </div>
        <div style={statBoxStyles}>
          <span style={statLabelStyles}>{t('trends.vsMarket', 'vs Market')}</span>
          <span style={{
            ...statValueStyles,
            color: trends.vsMarket < 0 ? '#22c55e' : '#ef4444'
          }}>
            {trends.vsMarket > 0 ? '+' : ''}{trends.vsMarket.toFixed(1)}%
          </span>
        </div>
        <div style={statBoxStyles}>
          <span style={statLabelStyles}>{t('trends.volatility', 'Volatility')}</span>
          <span style={statValueStyles}>{trends.volatility.toFixed(1)}%</span>
        </div>
      </div>

      {/* Toggle Details */}
      <button 
        onClick={() => setShowDetails(!showDetails)}
        style={toggleButtonStyles}
      >
        {showDetails ? t('trends.hideDetails', 'Hide Details') : t('trends.showDetails', 'Show Market Details')}
        <span style={{ transform: showDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {/* Similar Products List (Collapsible) */}
      {showDetails && trendData.similarProducts && (
        <div style={detailsContainerStyles}>
          <h4 style={detailsTitleStyles}>{t('trends.similarProducts', 'Similar Products Compared')}</h4>
          {trendData.similarProducts.map((p, index) => (
            <div key={index} style={productRowStyles}>
              <span style={productIndexStyles}>{index + 1}</span>
              <span style={productNameStyles} title={p.name}>
                {p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name}
              </span>
              <span style={productPriceStyles}>${p.currentPrice.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p style={disclaimerStyles}>
        {t('trends.disclaimer', 'Based on historical data. Past performance does not guarantee future results.')}
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
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  direction: isRTL ? 'rtl' : 'ltr',
});

const loadingContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
  gap: '12px',
};

const spinnerStyles = {
  width: '32px',
  height: '32px',
  border: '3px solid #f3f4f6',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const loadingTextStyles = {
  fontSize: '14px',
  color: '#6b7280',
};

const emptyContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
  gap: '12px',
};

const emptyTextStyles = {
  fontSize: '14px',
  color: '#9ca3af',
  textAlign: 'center',
};

const headerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
};

const titleStyles = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#1f2937',
  margin: 0,
};

const subtitleStyles = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '4px 0 0 0',
};

const heatIndicatorStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
};

const heatBadgeStyles = (color) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  padding: '10px 14px',
  backgroundColor: `${color}15`,
  borderRadius: '12px',
  border: `1px solid ${color}30`,
  minWidth: '100px',
});

const heatIconStyles = {
  fontSize: '20px',
};

const heatLabelStyles = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#374151',
  textAlign: 'center',
};

const heatMeterStyles = {
  width: '80px',
  height: '4px',
  backgroundColor: '#e5e7eb',
  borderRadius: '2px',
  overflow: 'hidden',
};

const heatMeterFillStyles = {
  height: '100%',
  borderRadius: '2px',
  transition: 'width 0.5s ease',
};

const adviceCardStyles = (action) => ({
  display: 'flex',
  gap: '12px',
  padding: '14px 16px',
  backgroundColor: action === 'buy' ? '#dcfce7' : action === 'wait' ? '#fef3c7' : '#f3f4f6',
  borderRadius: '12px',
  border: `1px solid ${action === 'buy' ? '#bbf7d0' : action === 'wait' ? '#fcd34d' : '#e5e7eb'}`,
});

const adviceIconStyles = {
  fontSize: '24px',
  flexShrink: 0,
};

const adviceContentStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: 1,
};

const adviceMessageStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#1f2937',
  margin: 0,
  lineHeight: 1.4,
};

const adviceMetaStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const confidenceStyles = {
  fontSize: '12px',
  color: '#6b7280',
};

const chartContainerStyles = {
  height: '200px',
  width: '100%',
};

const tooltipStyles = {
  backgroundColor: 'white',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
};

const tooltipLabelStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
};

const tooltipItemStyles = (color) => ({
  fontSize: '13px',
  color: '#475569',
  margin: '2px 0',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

const tooltipDotStyles = (color) => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: color,
});

const legendStyles = {
  display: 'flex',
  justifyContent: 'center',
  gap: '20px',
  padding: '8px 0',
  borderTop: '1px solid #f1f5f9',
};

const legendItemStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const legendDotStyles = {
  width: '12px',
  height: '12px',
  borderRadius: '50%',
};

const legendTextStyles = {
  fontSize: '12px',
  color: '#6b7280',
};

const statsContainerStyles = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'space-between',
};

const statBoxStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '12px',
  backgroundColor: '#f8fafc',
  borderRadius: '10px',
  flex: 1,
};

const statLabelStyles = {
  fontSize: '11px',
  color: '#6b7280',
  textAlign: 'center',
};

const statValueStyles = {
  fontSize: '16px',
  fontWeight: 700,
};

const toggleButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 500,
  color: '#475569',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const detailsContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '12px',
  backgroundColor: '#f8fafc',
  borderRadius: '10px',
};

const detailsTitleStyles = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  margin: '0 0 8px 0',
};

const productRowStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 0',
  borderBottom: '1px solid #e2e8f0',
};

const productIndexStyles = {
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#e2e8f0',
  borderRadius: '50%',
  fontSize: '11px',
  fontWeight: 600,
  color: '#64748b',
  flexShrink: 0,
};

const productNameStyles = {
  fontSize: '12px',
  color: '#475569',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const productPriceStyles = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  flexShrink: 0,
};

const disclaimerStyles = {
  fontSize: '11px',
  color: '#94a3b8',
  textAlign: 'center',
  margin: 0,
  paddingTop: '8px',
  borderTop: '1px solid #f1f5f9',
};
