import React, { useEffect, useCallback, useState } from 'react';
import { useSidebarState } from './hooks/useSidebarState';
import { useProductSearch } from '../hooks/useProductSearch';
import SidebarHeader from './components/SidebarHeader';
import TabNavigation from './components/TabNavigation';
import SearchTab from './components/SearchTab';
import FavoritesTab from './components/FavoritesTab';
import SettingsTab from './components/SettingsTab';
import CheckoutOptimizer from '../components/CheckoutOptimizer';
import '../i18n/config'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import './styles/sidebar.css';

/**
 * AliSmart Finder Pro - Sidebar Container with i18n & RTL Support
 * הקומפוננטה הראשית של ה-Sidebar
 * 
 * תכונות:
 * - ניהול מצב פתיחה/סגירה
 * - ניהוב טאבים (חיפוש, מועדפים, הגדרות)
 * - האזנה להודעות מה-Content Script
 * - תמיכה מלאה ב-RTL/LTR דינמי
 * - מצב יום/לילה
 * - רב-לשוניות (i18n)
 */

export default function SidebarContainer() {
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'he');
  const [isOnCheckoutPage, setIsOnCheckoutPage] = useState(false);
  
  // ROOT LEVEL LOG: Component initialized
  useEffect(() => {
    console.log('[AliSmart Sidebar ROOT] Component mounted and initialized');
  }, []);
  
  const {
    isOpen,
    activeTab,
    isDarkMode,
    favorites,
    openSidebar,
    closeSidebar,
    setActiveTab,
    toggleTheme,
    addToFavorites,
    removeFromFavorites,
  } = useSidebarState();

  // Hook חיפוש עם i18n
  const {
    isSearching,
    searchResults,
    currentProduct,
    error,
    performHybridSearch,
    setCurrentProduct,
    clearResults
  } = useProductSearch();

  // ROOT LEVEL LOG: Log state changes for critical data
  useEffect(() => {
    console.log('[AliSmart Sidebar ROOT] searchResults state changed:', {
      count: searchResults?.length,
      isArray: Array.isArray(searchResults),
      firstProduct: searchResults?.[0] || null
    });
  }, [searchResults]);

  useEffect(() => {
    console.log('[AliSmart Sidebar ROOT] currentProduct state changed:', {
      hasProduct: !!currentProduct,
      title: currentProduct?.title,
      productId: currentProduct?.productId
    });
  }, [currentProduct]);

  // Check if we're on cart/checkout page
  useEffect(() => {
    const checkCheckoutPage = () => {
      const url = window.location.href;
      const isCart = url.includes('/cart') || url.includes('/checkout') || 
                     url.includes('/order/confirm') || url.includes('/payment');
      setIsOnCheckoutPage(isCart);
    };
    
    checkCheckoutPage();
    
    // Listen for URL changes (SPA navigation)
    const observer = new MutationObserver(checkCheckoutPage);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, []);
  const getSidebarDirection = () => {
    const rtlLanguages = ['he', 'ar', 'fa', 'ur'];
    return rtlLanguages.includes(currentLang) ? 'rtl' : 'ltr';
  };

  // עדכון מיקום ה-sidebar לפי שפה (RTL = פותח משמאל)
  const getSidebarPosition = () => {
    const isRTL = getSidebarDirection() === 'rtl';
    return {
      right: isRTL ? 'auto' : '0',
      left: isRTL ? '0' : 'auto',
      transform: isOpen 
        ? 'translateX(0)' 
        : isRTL 
          ? 'translateX(-100%)' 
          : 'translateX(100%)',
    };
  };

  /**
   * טיפול בהחלפת שפה
   */
  const handleLanguageChange = useCallback((lang) => {
    setCurrentLang(lang);
    i18n.changeLanguage(lang);
    chrome.storage.sync.set({ LANGUAGE: lang });
  }, [i18n]);

  /**
   * טעינת הגדרות שפה מה-storage
   */
  useEffect(() => {
    chrome.storage.sync.get(['LANGUAGE'], (result) => {
      const savedLang = result.LANGUAGE || 'he';
      if (savedLang !== currentLang) {
        setCurrentLang(savedLang);
        i18n.changeLanguage(savedLang);
      }
    });

    // האזנה לשינויים
    const handleStorageChange = (changes, namespace) => {
      if (namespace === 'sync' && changes.LANGUAGE) {
        const newLang = changes.LANGUAGE.newValue;
        setCurrentLang(newLang);
        i18n.changeLanguage(newLang);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [currentLang, i18n]);

  /**
   * טיפול בהודעות מה-Content Script או Background
   */
  useEffect(() => {
    // IMMEDIATE LOG: Capture ALL incoming messages at root level
    const messageListener = (request, sender, sendResponse) => {
      console.log('[AliSmart Sidebar ROOT] >>> INCOMING MESSAGE:', {
        type: request?.type,
        sender: sender?.id,
        hasData: !!request,
        timestamp: Date.now(),
        fullRequest: request
      });

      switch (request.type) {
        case 'OPEN_SIDEBAR_AND_SEARCH':
          // פתיחת sidebar והגדרת מוצר לחיפוש
          console.log('[AliSmart Sidebar] OPEN_SIDEBAR_AND_SEARCH - productData:', {
            hasProductData: !!request.productData,
            title: request.productData?.title,
            productId: request.productData?.productId
          });
          setCurrentProduct(request.productData);
          setActiveTab('search');
          setIsLoading(true);
          openSidebar();
          
          // התחלת חיפוש
          performSearch(request.productData);
          sendResponse({ success: true });
          break;

        case 'OPEN_SIDEBAR':
          console.log('[AliSmart Sidebar] OPEN_SIDEBAR received');
          openSidebar();
          sendResponse({ success: true });
          break;

        case 'CLOSE_SIDEBAR':
          console.log('[AliSmart Sidebar] CLOSE_SIDEBAR received');
          closeSidebar();
          sendResponse({ success: true });
          break;

        case 'SEARCH_RESULTS':
          console.log('[AliSmart Sidebar] SEARCH_RESULTS received:', {
            resultsCount: request.results?.length,
            isArray: Array.isArray(request.results),
            firstResult: request.results?.[0]
          });
          setSearchResults(request.results);
          setIsLoading(false);
          sendResponse({ success: true });
          break;

        case 'TOGGLE_SIDEBAR':
          console.log('[AliSmart Sidebar] TOGGLE_SIDEBAR received, current isOpen:', isOpen);
          if (isOpen) {
            closeSidebar();
          } else {
            openSidebar();
          }
          sendResponse({ success: true, isOpen: !isOpen });
          break;

        default:
          break;
      }

      return true;
    };

    // הרשמת מאזין הודעות
    chrome.runtime.onMessage.addListener(messageListener);

    // האזנה לאירועים מקומיים (כגיבוי)
    const handleCustomEvent = (event) => {
      if (event.type === 'AliSmart:OpenSidebar') {
        setCurrentProduct(event.detail);
        setActiveTab('search');
        openSidebar();
        performSearch(event.detail);
      }
    };

    document.addEventListener('AliSmart:OpenSidebar', handleCustomEvent);

    // ניקוי
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      document.removeEventListener('AliSmart:OpenSidebar', handleCustomEvent);
    };
  }, [isOpen, openSidebar, closeSidebar, setActiveTab, setCurrentProduct, setSearchResults, setIsLoading]);

  /**
   * ביצוע חיפוש היברידי (ויזואלי + טקסטואלי)
   */
  const performSearch = useCallback(async (productData) => {
    if (!productData) return;

    try {
      setIsLoading(true);

      // קריאה ל-API דרך Background Script
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_REQUEST',
        query: productData.title,
        imgUrl: productData.imgUrl,
        title: productData.title,
        currentId: productData.productId,
        timestamp: Date.now()
      });

      if (response?.success && response.products) {
        // עיבוד ודירוג התוצאות
        const processed = processSearchResults(response.products, productData);
        setSearchResults(processed);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[AliSmart] Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setSearchResults]);

  /**
   * עיבוד תוצאות חיפוש והוספת מטא-דאטה
   */
  const processSearchResults = (products, sourceProduct) => {
    if (!products || !Array.isArray(products)) return [];

    return products.map((product, index) => {
      const price = extractPrice(product.price || product.sale_price);
      const sourcePrice = extractPrice(sourceProduct.price);
      
      // חישוב חיסכון
      let savings = null;
      if (sourcePrice > 0 && price > 0 && price < sourcePrice) {
        savings = {
          amount: sourcePrice - price,
          percent: Math.round(((sourcePrice - price) / sourcePrice) * 100)
        };
      }

      return {
        ...product,
        rank: index + 1,
        savings,
        isBestDeal: index === 0,
        trustLevel: calculateTrustLevel(product)
      };
    });
  };

  /**
   * חילוץ ערך מחיר ממחרוזת
   */
  const extractPrice = (priceStr) => {
    if (!priceStr || typeof priceStr !== 'string') return 0;
    const match = priceStr.match(/[\d,.]+/);
    return match ? parseFloat(match[0].replace(',', '')) : 0;
  };

  /**
   * חישוב רמת אמון מוכר
   */
  const calculateTrustLevel = (product) => {
    const rating = parseFloat(product.evaluate_rate || product.rating || 0);
    const orders = parseInt(product.orders || product.sales || 0);

    if (rating >= 4.8 && orders >= 500) {
      return { level: 'high', label: 'מוכר מוביל', className: 'trust-high' };
    } else if (rating >= 4.5 || (rating >= 4.5 && orders >= 100)) {
      return { level: 'medium', label: 'מוכר מאומת', className: 'trust-medium' };
    } else if (rating > 0 && rating < 4.5) {
      return { level: 'low', label: 'מוכר חדש', className: 'trust-low' };
    }
    return { level: 'unknown', label: 'מוכר חדש', className: 'trust-unknown' };
  };

  /**
   * טיפול בלחיצה על מוצר בתוצאות חיפוש
   */
  const handleProductClick = (product) => {
    const url = product.product_detail_url || product.url || 
                `https://www.aliexpress.com/item/${product.productId}.html`;
    window.open(url, '_blank');
  };

  /**
   * טיפול בהוספה/הסרה ממועדפים
   */
  const handleFavoriteToggle = (product) => {
    const isFavorite = favorites.some(f => f.productId === product.productId);
    if (isFavorite) {
      removeFromFavorites(product.productId);
    } else {
      addToFavorites(product);
    }
  };

  // רינדור הטאב הפעיל
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'search':
        return (
          <SearchTab
            results={searchResults}
            currentProduct={currentProduct}
            isLoading={isLoading}
            onProductClick={handleProductClick}
            onFavoriteToggle={handleFavoriteToggle}
            favorites={favorites}
          />
        );
      case 'favorites':
        return (
          <FavoritesTab
            favorites={favorites}
            onProductClick={handleProductClick}
            onRemove={removeFromFavorites}
          />
        );
      case 'settings':
        return <SettingsTab isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />;
      case 'checkout':
        return <CheckoutOptimizer />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Overlay להחשכת הרקע כשה-sidebar פתוח */}
      {isOpen && (
        <div
          className="als-sidebar-overlay"
          onClick={closeSidebar}
          style={overlayStyles}
        />
      )}

      {/* ה-Sidebar הראשי */}
      <aside
        className={`als-sidebar ${isOpen ? 'als-sidebar--open' : ''} ${isDarkMode ? 'als-sidebar--dark' : ''}`}
        style={{
          ...sidebarStyles,
          ...getSidebarPosition(),
          direction: getSidebarDirection(),
        }}
        dir={getSidebarDirection()}
      >
        {/* Header */}
        <SidebarHeader
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
          onClose={closeSidebar}
        />

        {/* Navigation Tabs */}
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isDarkMode={isDarkMode}
          showCheckout={isOnCheckoutPage}
        />

        {/* Content Area */}
        <main className="als-sidebar-content" style={contentStyles}>
          {renderActiveTab()}
        </main>
      </aside>
    </>
  );
}

// Inline styles לבידוד מוחלט
const overlayStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  zIndex: 2147483645,
  opacity: 0,
  animation: 'fadeIn 0.3s ease forwards',
};

const sidebarStyles = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: '380px',
  height: '100vh',
  backgroundColor: '#ffffff',
  boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
  zIndex: 2147483646,
  display: 'flex',
  flexDirection: 'column',
  transform: 'translateX(100%)',
  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  direction: 'rtl',
};

const contentStyles = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
};
