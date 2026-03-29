import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Settings Tab Component with i18n - ULTRA PREMIUM DESIGN
 * טאב הגדרות התוסף עם תמיכה ברב-לשוניות - עיצוב פרימיום
 */

export default function SettingsTab({ isDarkMode, onToggleTheme, onLanguageChange, currentLanguage }) {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    onLanguageChange?.(lang);
    chrome.storage.sync.set({ LANGUAGE: lang });
  };

  const handleCurrencyChange = (e) => {
    const currency = e.target.value;
    chrome.storage.sync.set({ CURRENCY: currency });
  };

  const handleSortChange = (e) => {
    const sortBy = e.target.value;
    chrome.storage.sync.set({ SORT_BY: sortBy });
  };

  const openHelp = () => window.open('https://alismart.io/help', '_blank');
  const openFeedback = () => window.open('https://alismart.io/feedback', '_blank');

  return (
    <div style={containerStyles}>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(238, 9, 121, 0.3); }
          50% { box-shadow: 0 0 30px rgba(238, 9, 121, 0.5); }
        }
        .shimmer-effect {
          position: relative;
          overflow: hidden;
        }
        .shimmer-effect::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 2s infinite;
        }
        .premium-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          transition: all 0.3s ease;
        }
        .premium-card:hover {
          border-color: rgba(255, 106, 0, 0.5);
          box-shadow: 0 8px 32px rgba(238, 9, 121, 0.2);
          transform: translateY(-2px);
        }
        .gradient-text {
          background: linear-gradient(135deg, #ff6a00 0%, #ff8c42 25%, #ee0979 50%, #ff6a00 75%, #ff8c42 100%);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 4s ease infinite;
        }
        .glass-select {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: white;
          backdrop-filter: blur(10px);
          transition: all 0.2s ease;
        }
        .glass-select:hover, .glass-select:focus {
          border-color: rgba(255, 106, 0, 0.6);
          background: rgba(255,255,255,0.12);
          box-shadow: 0 0 20px rgba(255, 106, 0, 0.2);
        }
      `}</style>

      {/* Hero Section */}
      <div style={heroStyles}>
        <h1 style={heroTitleStyles} className="gradient-text">AliSmart Finder</h1>
        <p style={heroSubtitleStyles}>Smart Shopping Assistant for AliExpress</p>
      </div>

      {/* Settings Sections */}
      <div style={sectionsContainerStyles}>
        
        {/* Display Settings */}
        <section style={cardStyles} className="premium-card">
          <div style={cardHeaderStyles}>
            <span style={iconStyles}>🎨</span>
            <h3 style={cardTitleStyles} className="gradient-text">{t('settings.display.title')}</h3>
          </div>
          
          <div style={settingItemStyles}>
            <div style={settingTextStyles}>
              <span style={settingNameStyles}>{t('settings.display.darkMode')}</span>
              <span style={settingDescStyles}>{t('settings.display.darkModeDescription')}</span>
            </div>
            <button
              onClick={onToggleTheme}
              style={{
                ...toggleContainerStyles,
                background: isDarkMode ? 'linear-gradient(135deg, #ff6a00, #ee0979)' : 'rgba(255,255,255,0.2)',
              }}
              aria-pressed={isDarkMode}
            >
              <div
                style={{
                  ...toggleKnobStyles,
                  transform: isDarkMode ? 'translateX(28px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </section>

        {/* Language Settings */}
        <section style={cardStyles} className="premium-card">
          <div style={cardHeaderStyles}>
            <span style={iconStyles}>🌐</span>
            <h3 style={cardTitleStyles} className="gradient-text">{t('settings.language.title')}</h3>
          </div>
          
          <div style={inputGroupStyles}>
            <label style={labelStyles}>{t('settings.language.label')}</label>
            <select
              onChange={handleLanguageChange}
              value={currentLanguage || i18n.language}
              style={glassSelectStyles}
              className="glass-select"
            >
              <option value="he" style={optionStyles}>🇮🇱 עברית</option>
              <option value="en" style={optionStyles}>🇺🇸 English</option>
            </select>
          </div>
        </section>

        {/* Currency Settings */}
        <section style={cardStyles} className="premium-card">
          <div style={cardHeaderStyles}>
            <span style={iconStyles}>💱</span>
            <h3 style={cardTitleStyles} className="gradient-text">{t('settings.currency.title')}</h3>
          </div>
          
          <div style={inputGroupStyles}>
            <label style={labelStyles}>{t('settings.currency.label')}</label>
            <select
              onChange={handleCurrencyChange}
              defaultValue="ILS"
              style={glassSelectStyles}
              className="glass-select"
            >
              <option value="ILS" style={optionStyles}>₪ שקל (ILS)</option>
              <option value="USD" style={optionStyles}>$ דולר (USD)</option>
              <option value="EUR" style={optionStyles}>€ יורו (EUR)</option>
              <option value="GBP" style={optionStyles}>£ לירה (GBP)</option>
            </select>
          </div>
        </section>

        {/* Search Settings */}
        <section style={cardStyles} className="premium-card">
          <div style={cardHeaderStyles}>
            <span style={iconStyles}>🔍</span>
            <h3 style={cardTitleStyles} className="gradient-text">{t('settings.search.title')}</h3>
          </div>
          
          <div style={inputGroupStyles}>
            <label style={labelStyles}>{t('settings.search.sortBy')}</label>
            <select
              onChange={handleSortChange}
              defaultValue="SALE_PRICE_ASC"
              style={glassSelectStyles}
              className="glass-select"
            >
              <option value="SALE_PRICE_ASC" style={optionStyles}>💰 מחיר: נמוך לגבוה</option>
              <option value="SALE_PRICE_DESC" style={optionStyles}>💰 מחיר: גבוה לנמוך</option>
              <option value="EVALUATE_RATE_ASC" style={optionStyles}>⭐ דירוג: גבוה לנמוך</option>
              <option value="SALE_QTY_ASC" style={optionStyles}>🔥 מכירות: הכי פופולרי</option>
            </select>
          </div>
        </section>

        {/* Quick Actions */}
        <section style={cardStyles} className="premium-card">
          <div style={cardHeaderStyles}>
            <span style={iconStyles}>⚡</span>
            <h3 style={cardTitleStyles} className="gradient-text">פעולות מהירות</h3>
          </div>
          
          <div style={quickActionsStyles}>
            <button 
              onClick={openHelp} 
              style={actionButtonStyles}
              className="shimmer-effect"
            >
              <span style={actionIconStyles}>📖</span>
              מדריך שימוש
            </button>
            <button 
              onClick={openFeedback} 
              style={actionButtonStyles}
              className="shimmer-effect"
            >
              <span style={actionIconStyles}>💬</span>
              משוב
            </button>
          </div>
        </section>

        {/* About */}
        <section style={{...cardStyles, marginTop: '24px', textAlign: 'center'}} className="premium-card">
          <p style={versionStyles}>AliSmart Finder Pro v2.0</p>
          <p style={copyrightStyles}>© 2024 AliSmart. כל הזכויות שמורות.</p>
          <p style={affiliateStyles}>התוסף משתתף בתוכניות שותפים ועשוי לקבל עמלה</p>
        </section>

      </div>
    </div>
  );
}

// ULTRA PREMIUM STYLES
const containerStyles = {
  minHeight: '100%',
  background: 'linear-gradient(180deg, rgba(25,25,45,0.98) 0%, rgba(15,15,35,0.99) 100%)',
  color: 'white',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const heroStyles = {
  padding: '32px 24px',
  textAlign: 'center',
  background: 'linear-gradient(135deg, rgba(255,106,0,0.15) 0%, rgba(238,9,121,0.15) 100%)',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  position: 'relative',
  overflow: 'hidden',
};

const heroTitleStyles = {
  fontSize: '32px',
  fontWeight: '800',
  margin: '0 0 8px 0',
  letterSpacing: '-1px',
};

const heroSubtitleStyles = {
  fontSize: '14px',
  color: 'rgba(255,255,255,0.7)',
  fontWeight: '500',
  margin: 0,
};

const sectionsContainerStyles = {
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const cardStyles = {
  padding: '20px',
  borderRadius: '16px',
};

const cardHeaderStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '16px',
};

const iconStyles = {
  fontSize: '20px',
};

const cardTitleStyles = {
  fontSize: '16px',
  fontWeight: '700',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const settingItemStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
};

const settingTextStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const settingNameStyles = {
  fontSize: '15px',
  fontWeight: '600',
  color: 'rgba(255,255,255,0.95)',
};

const settingDescStyles = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.5)',
};

const toggleContainerStyles = {
  width: '56px',
  height: '30px',
  borderRadius: '15px',
  border: '1px solid rgba(255,255,255,0.2)',
  cursor: 'pointer',
  position: 'relative',
  padding: '2px',
  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
};

const toggleKnobStyles = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  background: 'white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

const inputGroupStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const labelStyles = {
  fontSize: '13px',
  fontWeight: '600',
  color: 'rgba(255,255,255,0.8)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const glassSelectStyles = {
  padding: '14px 16px',
  fontSize: '15px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  outline: 'none',
};

const optionStyles = {
  background: '#1a1a2e',
  color: 'white',
  padding: '10px',
};

const quickActionsStyles = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
};

const actionButtonStyles = {
  padding: '14px 20px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  background: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'hidden',
};

const actionIconStyles = {
  fontSize: '18px',
};

const versionStyles = {
  fontSize: '13px',
  fontWeight: '700',
  color: 'rgba(255,255,255,0.8)',
  margin: '0 0 4px 0',
};

const copyrightStyles = {
  fontSize: '11px',
  color: 'rgba(255,255,255,0.5)',
  margin: '0 0 8px 0',
};

const affiliateStyles = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.3)',
  margin: 0,
};
