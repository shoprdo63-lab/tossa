import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  generateAffiliateLink,
  generateShortLink,
  generateQRCode,
  generateShareMessage,
  generateWhatsAppShareUrl,
  generateTelegramShareUrl,
  copyToClipboard,
  cleanAliExpressUrl
} from '../services/api.js';

/**
 * ShareModule Component
 * מחולל שיתוף חכם עם קישורי אפיליאייט
 * 
 * תכונות:
 * - קישור מנוקה מפרמטרי מעקב
 * - Affiliate ID משובץ אוטומטית
 * - קיצור לינק (Short Link)
 * - QR Code לסריקה מהירה
 * - שיתוף ישיר ל-WhatsApp/Telegram
 * - Preview Card אלגנטי
 * - עיצוב Quiet Luxury - מינימליסטי ונקי
 */

export default function ShareModule({ product }) {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shortLink, setShortLink] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const isRTL = i18n.language === 'he';
  const productUrl = product?.product_detail_url || product?.url || product?.link || '';
  const productImage = product?.product_main_image_url || product?.image || product?.imgUrl || '';
  const productTitle = product?.product_title || product?.title || '';
  const productPrice = product?.price || product?.target_sale_price || '';

  useEffect(() => {
    if (productUrl && isExpanded) {
      generateShareLink();
    }
  }, [productUrl, isExpanded]);

  const generateShareLink = async () => {
    if (!productUrl) return;
    
    setIsGenerating(true);
    try {
      // יצירת קישור אפיליאייט
      const affiliateLink = await generateAffiliateLink(productUrl);
      setShareLink(affiliateLink);
      
      // יצירת קיצור ו-QR
      const { shortUrl, qrCode: qrUrl } = await generateShortLink(affiliateLink);
      setShortLink(shortUrl);
      setQrCode(qrUrl || generateQRCode(affiliateLink, 180));
    } catch (error) {
      console.error('[ShareModule] Failed to generate link:', error);
      // Fallback לקישור מנוקה
      const cleanLink = cleanAliExpressUrl(productUrl);
      setShareLink(cleanLink);
      setShortLink(cleanLink);
      setQrCode(generateQRCode(cleanLink, 180));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    const linkToCopy = shortLink || shareLink;
    if (!linkToCopy) return;
    
    const success = await copyToClipboard(linkToCopy);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleCopyWithMessage = async () => {
    const linkToCopy = shortLink || shareLink;
    if (!linkToCopy || !product) return;
    
    const message = generateShareMessage(product, linkToCopy, i18n.language);
    const success = await copyToClipboard(message);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const linkToShare = shortLink || shareLink;
    if (!linkToShare || !product) return;
    
    const message = generateShareMessage(product, linkToShare, i18n.language);
    const waUrl = generateWhatsAppShareUrl(message);
    window.open(waUrl, '_blank');
  };

  const handleTelegramShare = () => {
    const linkToShare = shortLink || shareLink;
    if (!linkToShare || !product) return;
    
    const message = generateShareMessage(product, linkToShare, i18n.language);
    const tgUrl = generateTelegramShareUrl(message);
    window.open(tgUrl, '_blank');
  };

  if (!productUrl) {
    return null;
  }

  return (
    <div style={containerStyles(isRTL)}>
      {/* Share Trigger Button */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          style={shareButtonStyles}
          title={t('share.shareProduct', 'Share Product')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>{t('share.share', 'Share')}</span>
        </button>
      ) : (
        <div style={expandedCardStyles}>
          {/* Header */}
          <div style={headerStyles}>
            <span style={titleStyles}>{t('share.shareProduct', 'Share Product')}</span>
            <button
              onClick={() => setIsExpanded(false)}
              style={closeButtonStyles}
              aria-label={t('common.close', 'Close')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Product Preview */}
          <div style={previewCardStyles}>
            {productImage && (
              <img
                src={productImage}
                alt={productTitle}
                style={previewImageStyles}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div style={previewInfoStyles}>
              <p style={previewTitleStyles} title={productTitle}>
                {productTitle.length > 50 ? productTitle.substring(0, 50) + '...' : productTitle}
              </p>
              {productPrice && (
                <p style={previewPriceStyles}>{productPrice}</p>
              )}
            </div>
          </div>

          {/* Link Display */}
          <div style={linkContainerStyles}>
            {isGenerating ? (
              <div style={loadingStyles}>
                <div style={spinnerStyles} />
                <span style={loadingTextStyles}>{t('share.generating', 'Generating link...')}</span>
              </div>
            ) : (
              <>
                <div style={linkDisplayStyles(isRTL)}>
                  <span style={linkTextStyles}>{shortLink || shareLink}</span>
                </div>
                
                {/* Copy Button */}
                <button
                  onClick={handleCopyLink}
                  style={copyButtonStyles(isCopied)}
                  disabled={isCopied}
                >
                  {isCopied ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{t('share.copied', 'Copied!')}</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      <span>{t('share.copyLink', 'Copy Link')}</span>
                    </>
                  )}
                </button>

                {/* Copy with Message Button */}
                <button
                  onClick={handleCopyWithMessage}
                  style={copyMessageButtonStyles}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  <span>{t('share.copyWithMessage', 'Copy with Message')}</span>
                </button>
              </>
            )}
          </div>

          {/* QR Code Toggle */}
          <button
            onClick={() => setShowQR(!showQR)}
            style={qrToggleStyles}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>{showQR ? t('share.hideQR', 'Hide QR Code') : t('share.showQR', 'Show QR Code')}</span>
          </button>

          {/* QR Code Display */}
          {showQR && qrCode && (
            <div style={qrContainerStyles}>
              <img
                src={qrCode}
                alt="QR Code"
                style={qrImageStyles}
              />
              <p style={qrHintStyles}>{t('share.scanToOpen', 'Scan to open on mobile')}</p>
            </div>
          )}

          {/* Share Buttons */}
          <div style={socialButtonsStyles}>
            <button
              onClick={handleWhatsAppShare}
              style={whatsappButtonStyles}
              title={t('share.shareOnWhatsApp', 'Share on WhatsApp')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.13 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleTelegramShare}
              style={telegramButtonStyles}
              title={t('share.shareOnTelegram', 'Share on Telegram')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <span>Telegram</span>
            </button>
          </div>

          {/* Privacy Note */}
          <p style={privacyNoteStyles}>
            {t('share.linkNote', 'Clean link - no tracking parameters')}
          </p>
        </div>
      )}
    </div>
  );
}

// Styles
const containerStyles = (isRTL) => ({
  display: 'flex',
  flexDirection: 'column',
  direction: isRTL ? 'rtl' : 'ltr',
});

const shareButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '10px 20px',
  background: 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
  border: 'none',
  borderRadius: '25px',
  color: 'white',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: '0 4px 15px rgba(238, 9, 121, 0.3)',
  width: 'fit-content',
  alignSelf: 'flex-end',
};

const expandedCardStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px',
  backgroundColor: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  animation: 'slideIn 0.3s ease',
};

const headerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const titleStyles = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#1f2937',
};

const closeButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  backgroundColor: '#f3f4f6',
  border: 'none',
  borderRadius: '50%',
  color: '#6b7280',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const previewCardStyles = {
  display: 'flex',
  gap: '12px',
  padding: '12px',
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  border: '1px solid #f1f5f9',
};

const previewImageStyles = {
  width: '60px',
  height: '60px',
  objectFit: 'cover',
  borderRadius: '8px',
  flexShrink: 0,
};

const previewInfoStyles = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minWidth: 0,
  flex: 1,
};

const previewTitleStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  margin: 0,
  lineHeight: 1.4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
};

const previewPriceStyles = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#ee0979',
  margin: '4px 0 0 0',
};

const linkContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const loadingStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '20px',
};

const spinnerStyles = {
  width: '20px',
  height: '20px',
  border: '2px solid #f3f4f6',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const loadingTextStyles = {
  fontSize: '13px',
  color: '#6b7280',
};

const linkDisplayStyles = (isRTL) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  backgroundColor: '#f1f5f9',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  direction: 'ltr', // Links are always LTR
  textAlign: 'left',
});

const linkTextStyles = {
  fontSize: '12px',
  color: '#475569',
  wordBreak: 'break-all',
  fontFamily: 'monospace',
};

const copyButtonStyles = (isCopied) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 20px',
  background: isCopied
    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
    : 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
  border: 'none',
  borderRadius: '10px',
  color: 'white',
  fontSize: '14px',
  fontWeight: 600,
  cursor: isCopied ? 'default' : 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: isCopied
    ? '0 4px 15px rgba(34, 197, 94, 0.3)'
    : '0 4px 15px rgba(238, 9, 121, 0.3)',
});

const copyMessageButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '10px 16px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  color: '#475569',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const qrToggleStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '10px',
  backgroundColor: 'transparent',
  border: '1px dashed #cbd5e1',
  borderRadius: '8px',
  color: '#64748b',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const qrContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  padding: '16px',
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
};

const qrImageStyles = {
  width: '180px',
  height: '180px',
  borderRadius: '8px',
};

const qrHintStyles = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: 0,
};

const socialButtonsStyles = {
  display: 'flex',
  gap: '10px',
};

const whatsappButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  flex: 1,
  padding: '12px 16px',
  backgroundColor: '#22c55e',
  border: 'none',
  borderRadius: '10px',
  color: 'white',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const telegramButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  flex: 1,
  padding: '12px 16px',
  backgroundColor: '#38bdf8',
  border: 'none',
  borderRadius: '10px',
  color: 'white',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const privacyNoteStyles = {
  fontSize: '11px',
  color: '#94a3b8',
  textAlign: 'center',
  margin: 0,
  paddingTop: '8px',
  borderTop: '1px solid #f1f5f9',
};
