import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getTrustLabel, containsHumanContent, loadSafeModeSetting } from '../services/utils.js';

/**
 * ReviewFilterItem Component
 * פריט ביקורת עם מסנן תוכן וטשטוש תמונות
 * 
 * תכונות:
 * - טשטוש אוטומטי של תמונות עם דמויות אנושיות
 * - תווית אמון (Verified / Suspicious)
 * - Safe Mode Toggle
 * - הצגת דגלים ואזהרות
 * - עיצוב Quiet Luxury
 */

export default function ReviewFilterItem({ review, isSafeMode = true }) {
  const { t, i18n } = useTranslation();
  const [showBlurred, setShowBlurred] = useState(isSafeMode);
  const [showContent, setShowContent] = useState(true);
  const [safeMode, setSafeMode] = useState(isSafeMode);

  const isRTL = i18n.language === 'he';

  useEffect(() => {
    const loadSettings = async () => {
      const enabled = await loadSafeModeSetting();
      setSafeMode(enabled);
      setShowBlurred(enabled);
    };
    loadSettings();
  }, []);

  if (!review) return null;

  const { _trustAnalysis, _isBlurred, content, username, rating, date, images = [] } = review;
  
  // קבלת תווית אמון
  const trustLabel = getTrustLabel(_trustAnalysis?.trustLevel || 'verified', i18n.language);
  
  // בדיקת תמונות שצריכות טשטוש
  const imagesNeedBlur = images.filter(img => 
    containsHumanContent(img.src || img.url, img.alt)
  );
  
  const hasBlurredImages = imagesNeedBlur.length > 0;
  const isSuspicious = _trustAnalysis?.trustLevel === 'suspicious';
  const isUncertain = _trustAnalysis?.trustLevel === 'uncertain';

  // הצגת ביקורת חשודה בצורה מוטמת
  if (isSuspicious && safeMode) {
    return (
      <div style={suspiciousContainerStyles(isRTL)}>
        <div style={warningHeaderStyles}>
          <span style={warningIconStyles}>⚠</span>
          <span style={warningTextStyles}>
            {t('filter.suspiciousReview', 'Suspicious Review Hidden')}
          </span>
        </div>
        <p style={suspiciousReasonStyles}>
          {t('filter.potentiallyAutomated', 'This review appears to be potentially automated or spam.')}
        </p>
        <button 
          onClick={() => setShowContent(true)}
          style={showAnywayButtonStyles}
        >
          {t('filter.showAnyway', 'Show Anyway')}
        </button>
        
        {!showContent && (
          <div style={collapsedReviewStyles}>
            <ReviewContent 
              review={review} 
              trustLabel={trustLabel}
              hasBlurredImages={hasBlurredImages}
              imagesNeedBlur={imagesNeedBlur}
              showBlurred={showBlurred}
              setShowBlurred={setShowBlurred}
              isRTL={isRTL}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyles(isRTL, isUncertain)}>
      {/* Trust Badge */}
      <div style={headerStyles}>
        <div style={trustBadgeStyles(trustLabel.bgColor, trustLabel.textColor)}>
          <span>{trustLabel.icon}</span>
          <span style={trustTextStyles}>{trustLabel.text}</span>
        </div>
        
        {(isUncertain || _trustAnalysis?.flags?.length > 0) && (
          <div style={flagsContainerStyles}>
            {_trustAnalysis?.flags?.slice(0, 2).map((flag, idx) => (
              <span key={idx} style={flagBadgeStyles}>
                {t(`filter.flag.${flag}`, flag)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Review Content */}
      <ReviewContent 
        review={review}
        trustLabel={trustLabel}
        hasBlurredImages={hasBlurredImages}
        imagesNeedBlur={imagesNeedBlur}
        showBlurred={showBlurred}
        setShowBlurred={setShowBlurred}
        isRTL={isRTL}
      />
    </div>
  );
}

/**
 * תוכן הביקורת (מופרד לקומפוננטה פנימית)
 */
function ReviewContent({ 
  review, 
  hasBlurredImages, 
  imagesNeedBlur, 
  showBlurred, 
  setShowBlurred,
  isRTL 
}) {
  const { t } = useTranslation();
  const { content, username, rating, date, images = [] } = review;

  return (
    <>
      {/* User Info */}
      <div style={userInfoStyles}>
        <div style={avatarStyles}>
          {username?.charAt(0).toUpperCase() || '?'}
        </div>
        <div style={userMetaStyles}>
          <span style={usernameStyles}>{username || t('filter.anonymous', 'Anonymous')}</span>
          <div style={ratingDateStyles}>
            {rating > 0 && (
              <span style={ratingStyles}>{'★'.repeat(Math.min(rating, 5))}</span>
            )}
            {date && <span style={dateStyles}>{date}</span>}
          </div>
        </div>
      </div>

      {/* Review Text */}
      {content && (
        <p style={contentStyles(isRTL)}>{content}</p>
      )}

      {/* Images with Blur */}
      {images.length > 0 && (
        <div style={imagesContainerStyles}>
          {images.map((img, idx) => {
            const needsBlur = imagesNeedBlur.some(blurredImg => 
              (blurredImg.src || blurredImg.url) === (img.src || img.url)
            );
            
            return (
              <div key={idx} style={imageWrapperStyles}>
                {needsBlur && showBlurred ? (
                  <div 
                    style={blurredImageContainerStyles}
                    onClick={() => setShowBlurred(false)}
                  >
                    <img
                      src={img.src || img.url}
                      alt={img.alt || ''}
                      style={blurredImageStyles}
                    />
                    <div style={blurOverlayStyles}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span style={blurTextStyles}>
                        {t('filter.contentHidden', 'Content Hidden')}
                      </span>
                      <span style={showAnywaySmallStyles}>
                        {t('filter.tapToShow', 'Tap to show')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={img.src || img.url}
                    alt={img.alt || ''}
                    style={normalImageStyles}
                    loading="lazy"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Show All Images Button */}
      {hasBlurredImages && showBlurred && (
        <button 
          onClick={() => setShowBlurred(false)}
          style={showAllButtonStyles}
        >
          {t('filter.showAllImages', 'Show All Images')}
        </button>
      )}
    </>
  );
}

// Styles
const containerStyles = (isRTL, isUncertain) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  backgroundColor: isUncertain ? '#fffbeb' : 'white',
  borderRadius: '12px',
  border: `1px solid ${isUncertain ? '#fcd34d' : '#e5e7eb'}`,
  direction: isRTL ? 'rtl' : 'ltr',
});

const suspiciousContainerStyles = (isRTL) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  backgroundColor: '#fef2f2',
  borderRadius: '12px',
  border: '1px dashed #ef4444',
  direction: isRTL ? 'rtl' : 'ltr',
});

const headerStyles = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const trustBadgeStyles = (bgColor, textColor) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 10px',
  backgroundColor: bgColor,
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: 600,
  color: textColor,
});

const trustTextStyles = {
  fontSize: '11px',
};

const flagsContainerStyles = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
};

const flagBadgeStyles = {
  padding: '2px 8px',
  backgroundColor: '#f3f4f6',
  borderRadius: '12px',
  fontSize: '10px',
  color: '#6b7280',
};

const warningHeaderStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const warningIconStyles = {
  fontSize: '18px',
};

const warningTextStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#dc2626',
};

const suspiciousReasonStyles = {
  fontSize: '13px',
  color: '#7f1d1d',
  margin: 0,
};

const showAnywayButtonStyles = {
  padding: '8px 16px',
  backgroundColor: 'white',
  border: '1px solid #ef4444',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#dc2626',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

const collapsedReviewStyles = {
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: '1px solid #fee2e2',
};

const userInfoStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const avatarStyles = {
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#e0e7ff',
  borderRadius: '50%',
  fontSize: '14px',
  fontWeight: 600,
  color: '#4338ca',
};

const userMetaStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const usernameStyles = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
};

const ratingDateStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const ratingStyles = {
  fontSize: '12px',
  color: '#fbbf24',
};

const dateStyles = {
  fontSize: '11px',
  color: '#9ca3af',
};

const contentStyles = (isRTL) => ({
  fontSize: '14px',
  lineHeight: 1.6,
  color: '#4b5563',
  margin: 0,
  textAlign: isRTL ? 'right' : 'left',
});

const imagesContainerStyles = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const imageWrapperStyles = {
  position: 'relative',
};

const blurredImageContainerStyles = {
  position: 'relative',
  width: '100px',
  height: '100px',
  borderRadius: '8px',
  overflow: 'hidden',
  cursor: 'pointer',
};

const blurredImageStyles = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  filter: 'blur(20px)',
  transform: 'scale(1.1)', // למנוע שוליים מטושטשים פחות
};

const blurOverlayStyles = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  backgroundColor: 'rgba(0,0,0,0.4)',
  color: 'white',
};

const blurTextStyles = {
  fontSize: '10px',
  fontWeight: 600,
  textAlign: 'center',
};

const showAnywaySmallStyles = {
  fontSize: '9px',
  opacity: 0.8,
};

const normalImageStyles = {
  width: '100px',
  height: '100px',
  objectFit: 'cover',
  borderRadius: '8px',
};

const showAllButtonStyles = {
  padding: '8px 12px',
  backgroundColor: 'transparent',
  border: '1px dashed #9ca3af',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#6b7280',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
