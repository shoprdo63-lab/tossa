import { useState, useCallback, useEffect } from 'react';

/**
 * useSidebarState Hook
 * ניהול מצב ה-Sidebar
 * 
 * מנהל:
 * - מצב פתיחה/סגירה
 * - טאב פעיל
 * - מצב יום/לילה
 * - תוצאות חיפוש
 * - רשימת מועדפים
 * - מוצר נוכחי
 */

export function useSidebarState() {
  // מצב פתיחה/סגירה
  const [isOpen, setIsOpen] = useState(false);
  
  // טאב פעיל (search, favorites, settings)
  const [activeTab, setActiveTab] = useState('search');
  
  // מצב יום/לילה
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // תוצאות חיפוש
  const [searchResults, setSearchResults] = useState([]);
  
  // מועדפים
  const [favorites, setFavorites] = useState([]);
  
  // מוצר נוכחי (מה שנלחץ)
  const [currentProduct, setCurrentProduct] = useState(null);
  
  // מצב טעינה
  const [isLoading, setIsLoading] = useState(false);

  /**
   * טעינת הגדרות שמורות приmount
   */
  useEffect(() => {
    // טעינת מועדפים
    chrome.storage.local.get(['FAVORITES'], (result) => {
      if (result.FAVORITES) {
        setFavorites(result.FAVORITES);
      }
    });

    // טעינת מצב תצוגה
    chrome.storage.sync.get(['DARK_MODE'], (result) => {
      if (result.DARK_MODE !== undefined) {
        setIsDarkMode(result.DARK_MODE);
      }
    });

    // האזנה לשינויים ב-storage
    const storageListener = (changes, namespace) => {
      if (namespace === 'local' && changes.FAVORITES) {
        setFavorites(changes.FAVORITES.newValue || []);
      }
      if (namespace === 'sync' && changes.DARK_MODE) {
        setIsDarkMode(changes.DARK_MODE.newValue);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  /**
   * פתיחת ה-Sidebar
   */
  const openSidebar = useCallback(() => {
    setIsOpen(true);
    // שמירת מצב ב-storage
    chrome.storage.local.set({ SIDEBAR_OPEN: true });
  }, []);

  /**
   * סגירת ה-Sidebar
   */
  const closeSidebar = useCallback(() => {
    setIsOpen(false);
    // שמירת מצב ב-storage
    chrome.storage.local.set({ SIDEBAR_OPEN: false });
  }, []);

  /**
   * החלפת מצב יום/לילה
   */
  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      chrome.storage.sync.set({ DARK_MODE: newValue });
      return newValue;
    });
  }, []);

  /**
   * הגדרת טאב פעיל
   */
  const setTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  /**
   * הוספת מוצר למועדפים
   */
  const addToFavorites = useCallback((product) => {
    setFavorites((prev) => {
      // בדיקה אם כבר קיים
      if (prev.some((f) => f.productId === product.productId)) {
        return prev;
      }
      
      const newFavorites = [
        ...prev,
        { 
          ...product, 
          savedAt: Date.now() 
        }
      ];
      
      // שמירה ב-storage
      chrome.storage.local.set({ FAVORITES: newFavorites });
      
      return newFavorites;
    });
  }, []);

  /**
   * הסרת מוצר ממועדפים
   */
  const removeFromFavorites = useCallback((productId) => {
    setFavorites((prev) => {
      const newFavorites = prev.filter((f) => f.productId !== productId);
      
      // שמירה ב-storage
      chrome.storage.local.set({ FAVORITES: newFavorites });
      
      return newFavorites;
    });
  }, []);

  /**
   * הגדרת תוצאות חיפוש
   */
  const setResults = useCallback((results) => {
    setSearchResults(results);
  }, []);

  /**
   * הגדרת מוצר נוכחי
   */
  const setProduct = useCallback((product) => {
    setCurrentProduct(product);
  }, []);

  /**
   * הגדרת מצב טעינה
   */
  const setLoading = useCallback((loading) => {
    setIsLoading(loading);
  }, []);

  return {
    // State
    isOpen,
    activeTab,
    isDarkMode,
    searchResults,
    favorites,
    currentProduct,
    isLoading,
    
    // Actions
    openSidebar,
    closeSidebar,
    toggleTheme,
    setActiveTab: setTab,
    addToFavorites,
    removeFromFavorites,
    setSearchResults: setResults,
    setCurrentProduct: setProduct,
    setIsLoading: setLoading,
  };
}
