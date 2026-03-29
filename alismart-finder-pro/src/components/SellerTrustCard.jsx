import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * SellerTrustCard Component
 * רכיב רדאר אמינות מוכר - מציג ציון אמינות ויזואלי
 * 
 * תכונות:
 * - מד-ציון (Gauge) חצי עיגול אלגנטי
 * - צבעים משתנים לפי רמת אמון
 * - תובנות חכמות (Verified Store, Response Rate, וכו')
 * - אזהרת Non-filtered Content במידת הצורך
 * - עיצוב Quiet Luxury
 */

export default function SellerTrustCard({ sellerData }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';

  if (!sellerData) return null;

  const {
    storeName,
    positiveFeedbackRate,
    storeOpenDate,
    followersCount,
    responseRate,
    sellerRating,
    isTopBrand,
    hasNonFilteredContent,
  } = sellerData;

  // חישוב ציון אמינות
  const trustScore = useMemo(() => {
    let score = 0;
    const breakdown = [];

    // 1. דירוג פידבק חיובי (עד 40 נקודות)
    if (positiveFeedbackRate) {
      const feedbackScore = Math.min(positiveFeedbackRate * 40, 40);
      score += feedbackScore;
      breakdown.push({
        label: t('trust.feedbackRate', 'Feedback Rate'),
        value: `${positiveFeedbackRate.toFixed(1)}%`,
        points: Math.round(feedbackScore),
        maxPoints: 40,
        status: positiveFeedbackRate >= 0.95 ? 'excellent' : positiveFeedbackRate >= 0.90 ? 'good' : 'warning'
      });
    }

    // 2. וותק החנות (עד 30 נקודות)
    if (storeOpenDate) {
      const yearsOpen = calculateYearsOpen(storeOpenDate);
      const yearsScore = Math.min(yearsOpen * 15, 30);
      score += yearsScore;
      breakdown.push({
        label: t('trust.storeAge', 'Store Age'),
        value: t('trust.yearsOpen', { count: yearsOpen }),
        points: Math.round(yearsScore),
        maxPoints: 30,
        status: yearsOpen >= 2 ? 'excellent' : yearsOpen >= 1 ? 'good' : 'warning'
      });
    }

    // 3. דירוג עליאקספרס (עד 30 נקודות)
    if (sellerRating) {
      const ratingScore = Math.min((sellerRating / 5) * 30, 30);
      score += ratingScore;
      breakdown.push({
        label: t('trust.aliRating', 'AliExpress Rating'),
        value: `${sellerRating}/5`,
        points: Math.round(ratingScore),
        maxPoints: 30,
        status: sellerRating >= 4.5 ? 'excellent' : sellerRating >= 4.0 ? 'good' : 'warning'
      });
    }

    return { score: Math.round(score), breakdown, maxScore: 100 };
  }, [sellerData, t]);

  // קביעת רמת אמון וצבע
  const trustLevel = useMemo(() => {
    const { score } = trustScore;
    if (score >= 80) return { level: 'high', color: '#22c55e', label: t('trust.high', 'Verified') };
    if (score >= 60) return { level: 'medium', color: '#f59e0b', label: t('trust.medium', 'Moderate') };
    return { level: 'low', color: '#ef4444', label: t('trust.low', 'Risky') };
  }, [trustScore, t]);

  // חישוב אחוז עבור Gauge
  const gaugePercentage = (trustScore.score / 100) * 100;
  const gaugeRotation = (gaugePercentage / 100) * 180 - 180; // -180 to 0 degrees

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div style={shieldIconStyles(trustLevel.color)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div style={headerTextStyles}>
          <h4 style={titleStyles}>{t('trust.sellerTrust', 'Seller Trust')}</h4>
          {storeName && <span style={storeNameStyles}>{storeName}</span>}
        </div>
      </div>

      {/* Gauge */}
      <div style={gaugeContainerStyles}>
        <div style={gaugeWrapperStyles}>
          {/* רקע אפור */}
          <div style={gaugeBackgroundStyles} />
          
          {/* קשת צבעונית */}
          <div 
            style={{
              ...gaugeArcStyles,
              background: `conic-gradient(from 180deg at 50% 100%, ${trustLevel.color} ${gaugePercentage * 1.8}deg, transparent 0deg)`,
            }} 
          />
          
          {/* מסכה ליצירת גליל חצי עיגול */}
          <div style={gaugeMaskStyles}>
            <div style={gaugeInnerStyles} />
          </div>
          
          {/* מחוגן */}
          <div 
            style={{
              ...gaugeNeedleStyles,
              transform: `translateX(-50%) rotate(${Math.max(-180, Math.min(0, gaugeRotation))}deg)`,
              backgroundColor: trustLevel.color,
            }} 
          />
          
          {/* מרכז המחוגן */}
          <div style={gaugeCenterStyles} />
          
          {/* ציון במרכז */}
          <div style={scoreContainerStyles}>
            <span style={{ ...scoreStyles, color: trustLevel.color }}>{trustScore.score}</span>
            <span style={maxScoreStyles}>/100</span>
          </div>
        </div>
        
        {/* תווית רמת אמון */}
        <div style={trustLabelStyles(trustLevel.color)}>
          {trustLevel.label}
        </div>
      </div>

      {/* תובנות חכמות */}
      <div style={insightsContainerStyles}>
        {trustScore.breakdown.map((item, index) => (
          <div key={index} style={insightRowStyles}>
            <div style={insightIconStyles(item.status)}>
              {item.status === 'excellent' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {item.status === 'good' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              )}
              {item.status === 'warning' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
            <div style={insightContentStyles}>
              <span style={insightLabelTextStyles}>{item.label}</span>
              <span style={insightValueStyles(item.status)}>{item.value}</span>
            </div>
            <span style={insightPointsStyles}>{item.points}pt</span>
          </div>
        ))}
      </div>

      {/* אזהרת Non-filtered Content */}
      {hasNonFilteredContent && (
        <div style={warningContainerStyles}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={warningTextStyles}>{t('trust.nonFilteredWarning', 'Store may contain non-filtered product images')}</span>
        </div>
      )}

      {/* תגית Top Brand */}
      {isTopBrand && (
        <div style={topBrandStyles}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>{t('trust.topBrand', 'Top Brand')}</span>
        </div>
      )}
    </div>
  );
}

// Helper functions
function calculateYearsOpen(dateString) {
  if (!dateString) return 0;
  try {
    const openDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - openDate);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
    return Math.floor(diffYears);
  } catch (e) {
    return 0;
  }
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
  gap: '10px',
  marginBottom: '16px',
};

const shieldIconStyles = (color) => ({
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: `0 2px 8px ${color}40`,
});

const headerTextStyles = {
  flex: 1,
};

const titleStyles = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 700,
  color: '#1f2937',
};

const storeNameStyles = {
  fontSize: '12px',
  color: '#6b7280',
  fontWeight: 500,
};

const gaugeContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: '16px',
};

const gaugeWrapperStyles = {
  position: 'relative',
  width: '140px',
  height: '70px',
  marginBottom: '8px',
};

const gaugeBackgroundStyles = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '140px',
  borderRadius: '140px 140px 0 0',
  backgroundColor: '#f3f4f6',
  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)',
};

const gaugeArcStyles = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '140px',
  borderRadius: '140px 140px 0 0',
  transformOrigin: '50% 100%',
};

const gaugeMaskStyles = {
  position: 'absolute',
  bottom: 0,
  left: '10px',
  right: '10px',
  height: '120px',
  borderRadius: '120px 120px 0 0',
  overflow: 'hidden',
};

const gaugeInnerStyles = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '120px',
  borderRadius: '120px 120px 0 0',
  backgroundColor: '#ffffff',
};

const gaugeNeedleStyles = {
  position: 'absolute',
  bottom: '5px',
  left: '50%',
  width: '4px',
  height: '60px',
  borderRadius: '2px',
  transformOrigin: '50% 100%',
  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  zIndex: 10,
};

const gaugeCenterStyles = {
  position: 'absolute',
  bottom: '0px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  backgroundColor: '#374151',
  zIndex: 11,
  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
};

const scoreContainerStyles = {
  position: 'absolute',
  bottom: '15px',
  left: 0,
  right: 0,
  textAlign: 'center',
  zIndex: 5,
};

const scoreStyles = {
  fontSize: '32px',
  fontWeight: 800,
  lineHeight: 1,
};

const maxScoreStyles = {
  fontSize: '14px',
  fontWeight: 500,
  color: '#9ca3af',
  marginLeft: '2px',
};

const trustLabelStyles = (color) => ({
  fontSize: '13px',
  fontWeight: 700,
  color: color,
  padding: '6px 16px',
  backgroundColor: `${color}15`,
  borderRadius: '20px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

const insightsContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const insightRowStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 10px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
};

const insightIconStyles = (status) => ({
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: status === 'excellent' ? '#dcfce7' : status === 'good' ? '#fef3c7' : '#fee2e2',
  color: status === 'excellent' ? '#166534' : status === 'good' ? '#92400e' : '#991b1b',
  flexShrink: 0,
});

const insightContentStyles = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

const insightLabelTextStyles = {
  fontSize: '11px',
  color: '#6b7280',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const insightValueStyles = (status) => ({
  fontSize: '13px',
  fontWeight: 600,
  color: status === 'excellent' ? '#166534' : status === 'good' ? '#92400e' : '#991b1b',
});

const insightPointsStyles = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#9ca3af',
  backgroundColor: '#f3f4f6',
  padding: '2px 6px',
  borderRadius: '4px',
};

const warningContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 12px',
  backgroundColor: '#fffbeb',
  border: '1px solid #fcd34d',
  borderRadius: '8px',
  marginTop: '12px',
};

const warningTextStyles = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#92400e',
  flex: 1,
};

const topBrandStyles = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  backgroundColor: '#f3e8ff',
  color: '#7c3aed',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 700,
  marginTop: '12px',
  width: 'fit-content',
};
