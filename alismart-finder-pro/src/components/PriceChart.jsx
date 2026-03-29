import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

/**
 * PriceChart Component
 * גרף היסטוריית מחירים מינימליסטי ויוקרתי
 * 
 * תכונות:
 * - עיצוב Quiet Luxury (קו דק, gradient עדין)
 * - אייקון ורוד-כתום
 * - Tooltip עם מחיר ותאריך
 * - תובנות חכמות (Lowest, Average, Current)
 * - רספונסיבי לרוחב ה-Sidebar
 * - תמיכה ב-RTL
 */

const CustomTooltip = ({ active, payload, label, t, currency = '$' }) => {
  if (active && payload && payload.length) {
    const price = payload[0].value;
    const date = new Date(label).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
    });
    
    return (
      <div style={tooltipStyles}>
        <p style={tooltipDateStyles}>{date}</p>
        <p style={tooltipPriceStyles}>
          {currency}{price.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

export default function PriceChart({ 
  priceHistory, 
  currency = 'USD',
  isCompact = false 
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';

  const currencySymbol = useMemo(() => {
    const symbols = { USD: '$', EUR: '€', GBP: '£', ILS: '₪' };
    return symbols[currency] || '$';
  }, [currency]);

  // מכין את הנתונים לגרף
  const chartData = useMemo(() => {
    if (!priceHistory || !Array.isArray(priceHistory) || priceHistory.length === 0) {
      return [];
    }

    // מיון לפי תאריך
    return priceHistory
      .map(item => ({
        date: item.date,
        price: typeof item.price === 'number' ? item.price : parseFloat(item.price),
        timestamp: new Date(item.date).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-90); // 90 ימים אחרונים
  }, [priceHistory]);

  // חישוב תובנות
  const insights = useMemo(() => {
    if (chartData.length === 0) return null;

    const prices = chartData.map(d => d.price);
    const current = prices[prices.length - 1];
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // מציאת התאריך של המחיר הנמוך ביותר
    const lowestItem = chartData.find(d => d.price === lowest);
    const daysSinceLowest = lowestItem 
      ? Math.floor((Date.now() - lowestItem.timestamp) / (1000 * 60 * 60 * 24))
      : null;

    return {
      current,
      lowest,
      highest,
      average,
      daysSinceLowest,
      isGoodDeal: current <= average * 1.05,
      isGreatDeal: current <= lowest * 1.02,
    };
  }, [chartData]);

  // אם אין נתונים
  if (chartData.length === 0) {
    return (
      <div style={noDataContainerStyles}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
          <path d="M3 3v18h18" />
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
        <p style={noDataTextStyles}>{t('chart.noData', 'No history data available')}</p>
      </div>
    );
  }

  // קביעת סקאלת ה-Y
  const yDomain = useMemo(() => {
    const prices = chartData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [chartData]);

  // פורמט לציר X
  const formatXAxis = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  // פורמט לציר Y
  const formatYAxis = (value) => {
    return `${currencySymbol}${value.toFixed(0)}`;
  };

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div style={titleContainerStyles}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ee0979" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
          <span style={titleStyles}>{t('chart.priceHistory', 'Price History')}</span>
        </div>
        <span style={daysBadgeStyles}>90 {t('chart.days', 'days')}</span>
      </div>

      {/* Chart */}
      <div style={chartContainerStyles}>
        <ResponsiveContainer width="100%" height={isCompact ? 120 : 180}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ee0979" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ee0979" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              minTickGap={30}
              reversed={isRTL}
            />
            <YAxis 
              domain={yDomain}
              tickFormatter={formatYAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              width={45}
              orientation={isRTL ? 'right' : 'left'}
            />
            <Tooltip 
              content={<CustomTooltip t={t} currency={currencySymbol} />}
              cursor={{ stroke: '#ee0979', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#ee0979"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#ee0979', stroke: '#fff', strokeWidth: 2 }}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      {insights && (
        <div style={insightsContainerStyles}>
          <div style={insightRowStyles}>
            <span style={insightLabelStyles}>{t('chart.lowest', 'Lowest')}:</span>
            <span style={insightValueStyles}>
              {currencySymbol}{insights.lowest.toFixed(2)}
              {insights.daysSinceLowest !== null && (
                <span style={insightSubStyles}>
                  {' '}
                  {insights.daysSinceLowest === 0 
                    ? t('chart.today', 'today')
                    : t('chart.daysAgo', { count: insights.daysSinceLowest })}
                </span>
              )}
            </span>
          </div>
          
          <div style={insightRowStyles}>
            <span style={insightLabelStyles}>{t('chart.average', 'Average')}:</span>
            <span style={insightValueStyles}>
              {currencySymbol}{insights.average.toFixed(2)}
            </span>
          </div>

          {/* Smart Deal Badge */}
          <div style={dealBadgeContainerStyles}>
            {insights.isGreatDeal ? (
              <span style={{ ...dealBadgeStyles, backgroundColor: '#dcfce7', color: '#166534' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {t('chart.greatDeal', 'Great deal! Lowest price')}
              </span>
            ) : insights.isGoodDeal ? (
              <span style={{ ...dealBadgeStyles, backgroundColor: '#fef3c7', color: '#92400e' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {t('chart.goodDeal', 'Good deal - Below average')}
              </span>
            ) : (
              <span style={{ ...dealBadgeStyles, backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {t('chart.averagePrice', 'Average price')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const containerStyles = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  padding: '16px',
  marginBottom: '16px',
};

const headerStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px',
};

const titleContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const titleStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#1f2937',
};

const daysBadgeStyles = {
  fontSize: '11px',
  fontWeight: 500,
  color: '#9ca3af',
  backgroundColor: '#f3f4f6',
  padding: '4px 8px',
  borderRadius: '6px',
};

const chartContainerStyles = {
  marginBottom: '12px',
};

const tooltipStyles = {
  backgroundColor: '#1f2937',
  padding: '8px 12px',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  border: 'none',
};

const tooltipDateStyles = {
  fontSize: '11px',
  color: '#9ca3af',
  margin: '0 0 4px 0',
};

const tooltipPriceStyles = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#ffffff',
  margin: 0,
};

const insightsContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  paddingTop: '12px',
  borderTop: '1px solid #e5e7eb',
};

const insightRowStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '13px',
};

const insightLabelStyles = {
  color: '#6b7280',
  fontWeight: 500,
};

const insightValueStyles = {
  color: '#1f2937',
  fontWeight: 600,
};

const insightSubStyles = {
  fontSize: '11px',
  color: '#9ca3af',
  fontWeight: 400,
};

const dealBadgeContainerStyles = {
  marginTop: '8px',
};

const dealBadgeStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
};

const noDataContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px',
  backgroundColor: '#f9fafb',
  borderRadius: '12px',
  gap: '12px',
};

const noDataTextStyles = {
  fontSize: '13px',
  color: '#9ca3af',
  fontWeight: 500,
};
