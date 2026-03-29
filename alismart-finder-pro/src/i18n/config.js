import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import he from './locales/he.json';

/**
 * i18n Configuration
 * הגדרת תשתית רב-לשונית לתוסף AliSmart Finder Pro
 * 
 * תומך בשפות:
 * - English (en) - ברירת מחדל
 * - עברית (he) - RTL
 */

// משאבי תרגום
const resources = {
  en: {
    translation: en
  },
  he: {
    translation: he
  }
};

// הגדרת i18n
const i18nConfig = {
  resources,
  lng: 'he', // שפת ברירת המחדל - עברית
  fallbackLng: 'en', // שפת גיבוי
  
  interpolation: {
    escapeValue: false, // React כבר מטפל ב-XSS escaping
  },
  
  react: {
    useSuspense: false, // לא משתמשים ב-Suspense בסביבת תוסף
  },
  
  // הגדרות נוספות
  debug: process.env.NODE_ENV === 'development',
  
  // פונקציה לזיהוי כיוון (RTL/LTR)
  detection: {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
  }
};

// אתחול i18n
i18n
  .use(initReactI18next)
  .init(i18nConfig);

/**
 * פונקציה לקבלת השפה הנוכחית מ-storage
 */
export async function loadStoredLanguage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['LANGUAGE'], (result) => {
      const lang = result.LANGUAGE || 'he';
      if (lang !== i18n.language) {
        i18n.changeLanguage(lang);
      }
      resolve(lang);
    });
  });
}

/**
 * פונקציה לשינוי שפה ושמירה ב-storage
 */
export async function changeLanguage(lang) {
  await i18n.changeLanguage(lang);
  
  return new Promise((resolve) => {
    chrome.storage.sync.set({ LANGUAGE: lang }, () => {
      console.log('[i18n] Language changed to:', lang);
      resolve(lang);
    });
  });
}

/**
 * בדיקה אם שפה היא RTL
 */
export function isRTL(lang) {
  const rtlLanguages = ['he', 'ar', 'fa', 'ur'];
  return rtlLanguages.includes(lang || i18n.language);
}

/**
 * קבלת כיוון הטקסט (rtl/ltr)
 */
export function getDirection(lang) {
  return isRTL(lang) ? 'rtl' : 'ltr';
}

/**
 * קבלת כיוון הפוך (לשימוש ב-sidebar שפותח מהצד)
 */
export function getSidebarDirection(lang) {
  // בעברית - sidebar נפתח מצד שמאל (במקום ימין)
  return isRTL(lang) ? 'left' : 'right';
}

export default i18n;
