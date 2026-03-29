import React from 'react';
import VisualSettings from '../../components/VisualSettings';

/**
 * Settings Tab Component
 * טאב הגדרות התוסף
 * 
 * כולל:
 * - החלפת מצב יום/לילה
 * - בחירת מטבע
 * - הגדרות חיפוש
 * - מידע על התוסף
 */

export default function SettingsTab({ isDarkMode, onToggleTheme }) {
  // טיפול בשינוי מטבע
  const handleCurrencyChange = (e) => {
    const currency = e.target.value;
    chrome.storage.sync.set({ CURRENCY: currency }, () => {
      console.log('[AliSmart] Currency changed to:', currency);
    });
  };

  // טיפול בשינוי שפה
  const handleLanguageChange = (e) => {
    const language = e.target.value;
    chrome.storage.sync.set({ LANGUAGE: language }, () => {
      console.log('[AliSmart] Language changed to:', language);
      // רענון הדף כדי להחיל את השינוי
      window.location.reload();
    });
  };

  // טיפול בשינוי מיון ברירת מחדל
  const handleSortChange = (e) => {
    const sortBy = e.target.value;
    chrome.storage.sync.set({ SORT_BY: sortBy }, () => {
      console.log('[AliSmart] Sort by changed to:', sortBy);
    });
  };

  // פתיחת דף התיעוד
  const openHelp = () => {
    window.open('https://alismart.io/help', '_blank');
  };

  // פתיחת דף משוב
  const openFeedback = () => {
    window.open('https://alismart.io/feedback', '_blank');
  };

  return (
    <div style={containerStyles}>
      {/* הגדרות תצוגה */}
      <section style={sectionStyles}>
        <h3 style={sectionTitleStyles}>תצוגה</h3>

        {/* מצב יום/לילה */}
        <div style={settingRowStyles}>
          <div style={settingInfoStyles}>
            <span style={settingLabelStyles}>מצב לילה</span>
            <span style={settingDescriptionStyles}>הפעל עיצוב כהה לשימוש בלילה</span>
          </div>
          <button
            onClick={onToggleTheme}
            style={{
              ...toggleButtonStyles,
              backgroundColor: isDarkMode ? '#ee0979' : '#e5e7eb',
            }}
            aria-pressed={isDarkMode}
          >
            <div
              style={{
                ...toggleKnobStyles,
                transform: isDarkMode ? 'translateX(24px)' : 'translateX(2px)',
              }}
            />
          </button>
        </div>
      </section>

      {/* הגדרות תצוגת כפתורים */}
      <VisualSettings />

      {/* הגדרות מטבע */}
      <section style={sectionStyles}>
        <h3 style={sectionTitleStyles}>מטבע</h3>

        <div style={selectRowStyles}>
          <label style={selectLabelStyles}>מטבע מועדף</label>
          <select
            onChange={handleCurrencyChange}
            defaultValue="ILS"
            style={selectStyles}
          >
            <option value="ILS">שקל (₪)</option>
            <option value="USD">דולר ($)</option>
            <option value="EUR">יורו (€)</option>
            <option value="GBP">לירה שטרלינג (£)</option>
          </select>
        </div>
      </section>

      {/* הגדרות חיפוש */}
      <section style={sectionStyles}>
        <h3 style={sectionTitleStyles}>חיפוש</h3>

        <div style={selectRowStyles}>
          <label style={selectLabelStyles}>מיון תוצאות</label>
          <select
            onChange={handleSortChange}
            defaultValue="SALE_PRICE_ASC"
            style={selectStyles}
          >
            <option value="SALE_PRICE_ASC">מחיר - מהנמוך לגבוה</option>
            <option value="SALE_PRICE_DESC">מחיר - מהגבוה לנמוך</option>
            <option value="EVALUATE_RATE_ASC">דירוג - מהגבוה לנמוך</option>
            <option value="SALE_QTY_ASC">הזמנות - מהגבוה לנמוך</option>
          </select>
        </div>
      </section>

      {/* הגדרות שפה */}
      <section style={sectionStyles}>
        <h3 style={sectionTitleStyles}>שפה</h3>

        <div style={selectRowStyles}>
          <label style={selectLabelStyles}>שפת ממשק</label>
          <select
            onChange={handleLanguageChange}
            defaultValue="he"
            style={selectStyles}
          >
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      {/* מידע ועזרה */}
      <section style={sectionStyles}>
        <h3 style={sectionTitleStyles}>עזרה</h3>

        <div style={helpButtonsStyles}>
          <button onClick={openHelp} style={helpButtonStyles}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            מדריך שימוש
          </button>

          <button onClick={openFeedback} style={helpButtonStyles}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            משוב
          </button>
        </div>
      </section>

      {/* גרסה וזכויות */}
      <section style={{ ...sectionStyles, borderTop: '1px solid #e5e7eb', marginTop: '20px', paddingTop: '20px' }}>
        <div style={versionStyles}>
          <p style={versionTextStyles}>AliSmart Finder Pro v2.0.0</p>
          <p style={copyrightStyles}>© 2026 AliSmart. כל הזכויות שמורות.</p>
        </div>
      </section>
    </div>
  );
}

// Styles
const containerStyles = {
  padding: '16px',
};

const sectionStyles = {
  marginBottom: '24px',
};

const sectionTitleStyles = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#1a1a2e',
  margin: '0 0 12px 0',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const settingRowStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
};

const settingInfoStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const settingLabelStyles = {
  fontSize: '14px',
  fontWeight: 500,
  color: '#1a1a2e',
};

const settingDescriptionStyles = {
  fontSize: '12px',
  color: '#6b7280',
};

const toggleButtonStyles = {
  width: '48px',
  height: '26px',
  borderRadius: '13px',
  border: 'none',
  cursor: 'pointer',
  position: 'relative',
  transition: 'background-color 0.2s ease',
  padding: '2px',
};

const toggleKnobStyles = {
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  backgroundColor: 'white',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  transition: 'transform 0.2s ease',
};

const selectRowStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const selectLabelStyles = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
};

const selectStyles = {
  padding: '10px 12px',
  fontSize: '14px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: 'white',
  color: '#1f2937',
  cursor: 'pointer',
  fontFamily: 'inherit',
  direction: 'rtl',
};

const helpButtonsStyles = {
  display: 'flex',
  gap: '10px',
};

const helpButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 16px',
  backgroundColor: '#f3f4f6',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  fontFamily: 'inherit',
};

const versionStyles = {
  textAlign: 'center',
};

const versionTextStyles = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#6b7280',
  margin: '0 0 4px 0',
};

const copyrightStyles = {
  fontSize: '11px',
  color: '#9ca3af',
  margin: 0,
};
