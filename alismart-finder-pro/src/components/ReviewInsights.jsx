import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { summarizeReviews } from '../services/api.js';

/**
 * ReviewInsights Component
 * סיכום AI חכם של ביקורות מוצרים
 * 
 * תכונות:
 * - Pros/Cons מבוססי AI (Local Ollama/LM Studio או Cloud API)
 * - מד שביעות רצון
 * - ורדיקט סופי
 * - עיצוב מינימליסטי ומקצועי
 * - פרטיות: מעדיף AI מקומי, שולח רק טקסט ציבורי
 */

export default function ReviewInsights({ productId, reviews = [] }) {
  const { t, i18n } = useTranslation();
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isRTL = i18n.language === 'he';

  useEffect(() => {
    if (reviews.length > 0 && !insights && !isLoading) {
      generateInsights();
    }
  }, [reviews]);

  const generateInsights = async () => {
    if (!reviews.length) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // שימוש בפונקציה המאוחדת שתומכת ב-AI מקומי וחיצוני
      const data = await summarizeReviews(reviews, i18n.language);
      setInsights(data);
    } catch (err) {
      console.error('[ReviewInsights] Failed to generate:', err);
      setError(err.message);
      // Fallback - חישוב בסיסי מקומי
      setInsights(calculateBasicInsights(reviews));
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback - חישוב מקומי אם ה-API נכשל
  const calculateBasicInsights = (reviewList) => {
    const positive = reviewList.filter(r => r.rating >= 4).length;
    const negative = reviewList.filter(r => r.rating <= 2).length;
    const neutral = reviewList.length - positive - negative;
    
    const satisfactionRate = Math.round((positive / reviewList.length) * 100);

    // ניתוח מילים נפוצות
    const allText = reviewList.map(r => r.content?.toLowerCase() || '').join(' ');
    
    const positiveKeywords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'quality', 'fast', 'recommend', 'love', 'nice', 'טוב', 'מעולה', 'איכות', 'מהיר'];
    const negativeKeywords = ['bad', 'poor', 'terrible', 'slow', 'broken', 'defective', 'waste', 'disappointing', 'small', 'different', 'רע', 'איטי', 'שבור', 'קטן'];

    const pros = positiveKeywords
      .filter(kw => allText.includes(kw))
      .slice(0, 3)
      .map(kw => t(`insights.keywords.${kw}`, kw));

    const cons = negativeKeywords
      .filter(kw => allText.includes(kw))
      .slice(0, 3)
      .map(kw => t(`insights.keywords.${kw}`, kw));

    return {
      satisfactionRate,
      totalReviews: reviewList.length,
      pros: pros.length ? pros : [t('insights.defaultPro', 'Generally positive reviews')],
      cons: cons.length ? cons : [t('insights.noCons', 'No major issues reported')],
      verdict: satisfactionRate >= 80 
        ? t('insights.verdicts.highlyRecommended', 'Highly recommended')
        : satisfactionRate >= 60
        ? t('insights.verdicts.mixed', 'Mixed reviews - consider alternatives')
        : t('insights.verdicts.caution', 'Proceed with caution'),
      breakdown: { positive, neutral, negative }
    };
  };

  if (!reviews.length) {
    return (
      <div style={emptyStyles}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <p style={emptyTextStyles}>{t('insights.noReviews', 'No reviews available')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={loadingStyles}>
        <div style={spinnerStyles} />
        <p style={loadingTextStyles}>{t('insights.analyzing', 'Analyzing reviews...')}</p>
        <p style={loadingSubtextStyles}>{t('insights.processing', 'Processing {{count}} reviews', { count: reviews.length })}</p>
      </div>
    );
  }

  if (error && !insights) {
    return (
      <div style={errorStyles}>
        <p style={errorTextStyles}>{t('insights.error', 'Failed to analyze reviews')}</p>
        <button onClick={generateInsights} style={retryButtonStyles}>
          {t('insights.retry', 'Try Again')}
        </button>
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div style={containerStyles(isRTL)}>
      {/* Header - Satisfaction Rate */}
      <div style={headerStyles}>
        <div style={satisfactionContainerStyles}>
          <div style={satisfactionLabelStyles}>
            {t('insights.satisfaction', 'Customer Satisfaction')}
          </div>
          <div style={satisfactionBarContainerStyles}>
            <div 
              style={{
                ...satisfactionBarStyles,
                width: `${insights.satisfactionRate}%`,
                backgroundColor: getSatisfactionColor(insights.satisfactionRate),
              }} 
            />
          </div>
          <div style={satisfactionValueStyles(getSatisfactionColor(insights.satisfactionRate))}>
            {insights.satisfactionRate}%
          </div>
        </div>
        
        <div style={statsStyles}>
          <span style={statItemStyles}>{t('insights.totalReviews', { count: insights.totalReviews })}</span>
          {insights.breakdown && (
            <span style={breakdownStyles}>
              👍 {insights.breakdown.positive} · 
              😐 {insights.breakdown.neutral} · 
              👎 {insights.breakdown.negative}
            </span>
          )}
          {insights.source && (insights.source === 'ollama' || insights.source === 'lmstudio') && (
            <span style={localAiIndicatorStyles} title={isRTL ? 'ניתוח AI מקומי - הפרטיות שמורה' : 'Local AI analysis - Privacy protected'}>
              🔒 {isRTL ? 'AI מקומי' : 'Local AI'}
            </span>
          )}
        </div>
      </div>

      {/* Verdict */}
      <div style={verdictContainerStyles(getSatisfactionColor(insights.satisfactionRate))}>
        <div style={verdictIconStyles}>
          {insights.satisfactionRate >= 80 ? '✓' : insights.satisfactionRate >= 60 ? '?' : '⚠'}
        </div>
        <div style={verdictTextStyles}>
          <div style={verdictLabelStyles}>{t('insights.verdict', 'Verdict')}</div>
          <div style={verdictContentStyles}>{insights.verdict}</div>
        </div>
      </div>

      {/* Pros & Cons */}
      <div style={sectionsContainerStyles}>
        {/* Pros */}
        {insights.pros?.length > 0 && (
          <div style={sectionStyles}>
            <div style={sectionHeaderStyles('pro')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={sectionTitleStyles('pro')}>{t('insights.pros', 'Pros')}</span>
            </div>
            <ul style={listStyles}>
              {insights.pros.map((pro, i) => (
                <li key={i} style={listItemStyles('pro')}>{pro}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Cons */}
        {insights.cons?.length > 0 && (
          <div style={sectionStyles}>
            <div style={sectionHeaderStyles('con')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span style={sectionTitleStyles('con')}>{t('insights.cons', 'Cons')}</span>
            </div>
            <ul style={listStyles}>
              {insights.cons.map((con, i) => (
                <li key={i} style={listItemStyles('con')}>{con}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Toggle for raw reviews */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        style={toggleButtonStyles}
      >
        {isExpanded ? t('insights.hideReviews', 'Hide Raw Reviews') : t('insights.showReviews', 'View Raw Reviews')}
        <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {/* Raw reviews (collapsible) */}
      {isExpanded && (
        <div style={reviewsListStyles}>
          {reviews.slice(0, 5).map((review, i) => (
            <div key={i} style={reviewItemStyles}>
              <div style={reviewHeaderStyles}>
                <span style={reviewRatingStyles(review.rating)}>
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </span>
                {review.date && <span style={reviewDateStyles}>{review.date}</span>}
              </div>
              <p style={reviewContentStyles}>{review.content?.substring(0, 200)}{review.content?.length > 200 ? '...' : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper functions
function getSatisfactionColor(rate) {
  if (rate >= 80) return '#22c55e';
  if (rate >= 60) return '#f59e0b';
  return '#ef4444';
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

const loadingStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 16px',
  gap: '12px',
};

const spinnerStyles = {
  width: '28px',
  height: '28px',
  border: '3px solid #f3f4f6',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const loadingTextStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
  margin: 0,
};

const loadingSubtextStyles = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: 0,
};

const errorStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '24px 16px',
  gap: '12px',
};

const errorTextStyles = {
  fontSize: '14px',
  color: '#ef4444',
  margin: 0,
};

const retryButtonStyles = {
  padding: '8px 16px',
  backgroundColor: '#fee2e2',
  color: '#ef4444',
  border: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const headerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const satisfactionContainerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const satisfactionLabelStyles = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  whiteSpace: 'nowrap',
};

const satisfactionBarContainerStyles = {
  flex: 1,
  height: '8px',
  backgroundColor: '#e5e7eb',
  borderRadius: '4px',
  overflow: 'hidden',
};

const satisfactionBarStyles = {
  height: '100%',
  borderRadius: '4px',
  transition: 'width 0.5s ease',
};

const satisfactionValueStyles = (color) => ({
  fontSize: '16px',
  fontWeight: 700,
  color: color,
  minWidth: '40px',
  textAlign: 'right',
});

const statsStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  fontSize: '12px',
  color: '#6b7280',
};

const statItemStyles = {
  fontWeight: 500,
};

const breakdownStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const verdictContainerStyles = (color) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  backgroundColor: `${color}15`,
  borderRadius: '12px',
  border: `1px solid ${color}30`,
});

const verdictIconStyles = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'white',
  borderRadius: '50%',
  fontSize: '16px',
  fontWeight: 700,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

const verdictTextStyles = {
  flex: 1,
};

const verdictLabelStyles = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '2px',
};

const verdictContentStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#1f2937',
};

const sectionsContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const sectionStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const sectionHeaderStyles = (type) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

const sectionTitleStyles = (type) => ({
  fontSize: '13px',
  fontWeight: 700,
  color: type === 'pro' ? '#22c55e' : '#ef4444',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

const listStyles = {
  margin: 0,
  padding: '0 0 0 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const listItemStyles = (type) => ({
  fontSize: '13px',
  color: '#374151',
  lineHeight: 1.5,
});

const toggleButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '12px 16px',
  backgroundColor: '#f3f4f6',
  border: 'none',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 500,
  color: '#6b7280',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const reviewsListStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '12px',
  backgroundColor: '#f9fafb',
  borderRadius: '10px',
};

const reviewItemStyles = {
  padding: '12px',
  backgroundColor: 'white',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

const reviewHeaderStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '8px',
};

const reviewRatingStyles = (rating) => ({
  color: rating >= 4 ? '#22c55e' : rating <= 2 ? '#ef4444' : '#f59e0b',
  letterSpacing: '-1px',
  fontSize: '14px',
});

const reviewDateStyles = {
  fontSize: '11px',
  color: '#9ca3af',
};

const reviewContentStyles = {
  fontSize: '13px',
  color: '#4b5563',
  margin: 0,
  lineHeight: 1.5,
};

const localAiIndicatorStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  backgroundColor: '#dcfce7',
  color: '#166534',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 600,
  border: '1px solid #bbf7d0',
};
