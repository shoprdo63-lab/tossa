import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  performVisualSearch, 
  performTextSearch, 
  mergeSearchResults,
  searchViaProxy 
} from '../services/api';
import { 
  calculateFinalPrice, 
  extractRating, 
  calculateTrustLevel,
  rankProductsByValue,
  formatPrice 
} from '../services/utils';

/**
 * useProductSearch Hook
 * ניהול לוגיקת חיפוש מוצרים עם תמיכה ברב-לשוניות
 * 
 * תכונות:
 * - חיפוש היברידי (ויזואלי + טקסטואלי)
 * - הודעות סטטוס מתורגמות
 * - עיבוד ודירוג תוצאות
 * - טיפול בשגיאות עם הודעות מתורגמות
 */

export function useProductSearch() {
  const { t, i18n } = useTranslation();
  
  // מצבי חיפוש
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [error, setError] = useState(null);
  const [searchProgress, setSearchProgress] = useState({
    visual: false,
    text: false,
    merged: false
  });

  // מצבי סינון ומיון
  const [filters, setFilters] = useState({
    priceMin: '',
    priceMax: '',
    freeShipping: false,
    topRated: false,
  });
  const [sortBy, setSortBy] = useState('best_match');
  
  // מסנני וריאציה (צבע, מידה, דגם) מסנכרנים מדף המוצר
  const [variantFilters, setVariantFilters] = useState({
    color: null,
    size: null,
    model: null,
    other: {}
  });

  /**
   * הפעלת סינון על תוצאות
   */
  const applyFilters = useCallback((products, activeFilters) => {
    if (!products || !Array.isArray(products)) return [];

    return products.filter(product => {
      const priceData = product.priceData || calculateFinalPrice(product);
      const price = priceData.finalPrice || extractPrice(product.price);
      const rating = product.rating || extractRating(product);
      const hasFreeShipping = priceData.hasFreeShipping || 
                              product.free_shipping || 
                              product.is_free_shipping ||
                              (product.shipping && product.shipping.toLowerCase().includes('free'));

      // סינון מחיר מינימום
      if (activeFilters.priceMin !== '' && price < parseFloat(activeFilters.priceMin)) {
        return false;
      }

      // סינון מחיר מקסימום
      if (activeFilters.priceMax !== '' && price > parseFloat(activeFilters.priceMax)) {
        return false;
      }

      // סינון משלוח חינם
      if (activeFilters.freeShipping && !hasFreeShipping) {
        return false;
      }

      // סינון דירוג גבוה
      if (activeFilters.topRated && rating < 4.5) {
        return false;
      }

      return true;
    });
  }, []);

  /**
   * מיון תוצאות
   */
  const sortResults = useCallback((products, sortType) => {
    if (!products || !Array.isArray(products)) return [];

    const sorted = [...products];

    switch (sortType) {
      case 'price_asc':
        return sorted.sort((a, b) => {
          const priceA = a.priceData?.finalPrice || extractPrice(a.price);
          const priceB = b.priceData?.finalPrice || extractPrice(b.price);
          return priceA - priceB;
        });

      case 'price_desc':
        return sorted.sort((a, b) => {
          const priceA = a.priceData?.finalPrice || extractPrice(a.price);
          const priceB = b.priceData?.finalPrice || extractPrice(b.price);
          return priceB - priceA;
        });

      case 'rating_desc':
        return sorted.sort((a, b) => {
          const ratingA = a.rating || extractRating(a);
          const ratingB = b.rating || extractRating(b);
          return ratingB - ratingA;
        });

      case 'shipping_speed':
        return sorted.sort((a, b) => {
          // מוצרים עם משלוח חינם או מהיר קודם
          const hasFreeA = a.priceData?.hasFreeShipping || a.free_shipping;
          const hasFreeB = b.priceData?.hasFreeShipping || b.free_shipping;
          if (hasFreeA && !hasFreeB) return -1;
          if (!hasFreeA && hasFreeB) return 1;
          // אם שניהם זהים, מיין לפי מחיר
          const priceA = a.priceData?.finalPrice || extractPrice(a.price);
          const priceB = b.priceData?.finalPrice || extractPrice(b.price);
          return priceA - priceB;
        });

      case 'best_match':
      default:
        // אלגוריתם התאמה מקורי - משלב מחיר, דירוג, ומקור החיפוש
        return sorted.sort((a, b) => {
          const scoreA = calculateMatchScore(a);
          const scoreB = calculateMatchScore(b);
          return scoreB - scoreA;
        });
    }
  }, []);

  /**
   * חישוב ציון התאמה לאלגוריתם best_match
   */
  const calculateMatchScore = (product) => {
    const price = product.priceData?.finalPrice || extractPrice(product.price);
    const rating = product.rating || extractRating(product);
    const orders = product.orders || 0;
    const isVisual = product.searchSource === 'visual';

    // גורמי ציון:
    // 1. מחיר נמוך = טוב יותר (inverse)
    const priceScore = price > 0 ? Math.max(0, 100 - price) : 0;
    
    // 2. דירוג גבוה = טוב יותר
    const ratingScore = rating * 20; // מקסימום 100
    
    // 3. הזמנות רבות = אמון גבוה
    const ordersScore = Math.min(orders / 100, 20); // מקסימום 20
    
    // 4. חיפוש ויזואלי = התאמה טובה יותר
    const visualBonus = isVisual ? 15 : 0;

    return priceScore + ratingScore + ordersScore + visualBonus;
  };

  /**
   * עדכון מסננים
   */
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    // יישום סינון מיידי
    const filtered = applyFilters(searchResults, newFilters);
    const sorted = sortResults(filtered, sortBy);
    setFilteredResults(sorted);
  }, [searchResults, applyFilters, sortBy, sortResults]);

  /**
   * עדכון מיון
   */
  const updateSort = useCallback((newSort) => {
    setSortBy(newSort);
    // יישום מיון מיידי
    const sorted = sortResults(filteredResults, newSort);
    setFilteredResults(sorted);
  }, [filteredResults, sortResults]);

  /**
   * ניקוי מסננים
   */
  const clearFilters = useCallback(() => {
    const defaultFilters = {
      priceMin: '',
      priceMax: '',
      freeShipping: false,
      topRated: false,
    };
    setFilters(defaultFilters);
    setFilteredResults(sortResults(searchResults, sortBy));
  }, [searchResults, sortBy, sortResults]);

  /**
   * עדכון מסנני וריאציה (צבע, מידה, דגם) מה-Content Script
   */
  const updateVariantFilters = useCallback((variants) => {
    setVariantFilters(variants);
    
    // רענון החיפוש עם הווריאציות החדשות
    if (currentProduct && variants) {
      console.log('[useProductSearch] Updating search with variants:', variants);
      
      // יצירת query משופר עם הווריאציות
      const enhancedProduct = {
        ...currentProduct,
        variantSelections: variants,
        // עדכון הכותרת לחיפוש ממוקד יותר
        enhancedTitle: buildEnhancedTitle(currentProduct.title, variants)
      };
      
      // הפעלת חיפוש מחדש עם הכותרת המשופרת
      performHybridSearch(enhancedProduct);
    }
  }, [currentProduct, performHybridSearch]);

  /**
   * בניית כותרת משופרת לחיפוש עם וריאציות
   */
  const buildEnhancedTitle = (baseTitle, variants) => {
    if (!baseTitle || !variants) return baseTitle;
    
    let enhanced = baseTitle;
    
    // הוספת צבע אם קיים
    if (variants.color) {
      enhanced = `${enhanced} ${variants.color}`;
    }
    
    // הוספת מידה אם קיים
    if (variants.size) {
      enhanced = `${enhanced} ${variants.size}`;
    }
    
    // הוספת דגם אם קיים
    if (variants.model) {
      enhanced = `${enhanced} ${variants.model}`;
    }
    
    return enhanced;
  };

  /**
   * ביצוע חיפוש טקסטואלי ידני (לשימוש מ-SearchBar)
   * @param {string} searchQuery - מילת החיפוש
   * @returns {Promise<Array>} תוצאות החיפוש
   */
  const performManualSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) {
      setError(t('errors.noTitle'));
      return [];
    }

    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setCurrentProduct({
      title: searchQuery,
      productId: 'manual-search-' + Date.now(),
      isManualSearch: true
    });
    setSearchProgress({ visual: false, text: false, merged: true });

    try {
      // חיפוש טקסטואלי בלבד
      const textResults = await performTextSearch(searchQuery).catch(err => {
        console.log('[useProductSearch] Text search failed:', err.message);
        return [];
      });

      // עיבוד תוצאות
      const processed = processSearchResults(textResults, null, t);
      
      setSearchResults(processed);
      
      console.log('[useProductSearch] Manual search complete:', processed.length, 'results');
      
      return processed;

    } catch (err) {
      console.error('[useProductSearch] Manual search error:', err);
      setError(t('errors.searchFailed'));
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  /**
   * ביצוע חיפוש היברידי
   * מריץ חיפוש ויזואלי וטקסטואלי במקביל
   */
  const performHybridSearch = useCallback(async (productData) => {
    if (!productData) {
      setError(t('errors.noTitle'));
      return [];
    }

    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setCurrentProduct(productData);
    setSearchProgress({ visual: false, text: false, merged: false });

    console.log('[useProductSearch] Starting hybrid search for:', productData.title);

    try {
      // הרצת שני החיפושים במקביל
      const [visualResults, textResults] = await Promise.all([
        // חיפוש ויזואלי (אם יש תמונה)
        productData.imgUrl 
          ? performVisualSearch(productData.imgUrl).catch(err => {
              console.log('[useProductSearch] Visual search failed:', err.message);
              return [];
            })
          : Promise.resolve([]),
        
        // חיפוש טקסטואלי (תמיד רץ כגיבוי/העשרה)
        performTextSearch(productData.title).catch(err => {
          console.log('[useProductSearch] Text search failed:', err.message);
          return [];
        })
      ]);

      setSearchProgress(prev => ({ ...prev, visual: true, text: true }));

      console.log('[useProductSearch] Visual:', visualResults.length, 'Text:', textResults.length);

      // מיזוג תוצאות והסרת כפילויות
      const merged = mergeSearchResults(visualResults, textResults);
      setSearchProgress(prev => ({ ...prev, merged: true }));

      // עיבוד ודירוג התוצאות
      const processed = processSearchResults(merged, productData, t);

      setSearchResults(processed);
      
      console.log('[useProductSearch] Search complete:', processed.length, 'results');
      
      return processed;

    } catch (err) {
      console.error('[useProductSearch] Search error:', err);
      setError(t('errors.searchFailed'));
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  /**
   * חיפוש דרך Proxy (לשימיש Background Script)
   */
  const searchViaProxyAPI = useCallback(async (keyword, options = {}) => {
    const { page = 1, sort = 'SALE_PRICE_ASC', imgUrl = '', title = '' } = options;
    
    setIsSearching(true);
    setError(null);

    try {
      const data = await searchViaProxy(keyword, page, 50, sort, imgUrl, title);
      
      // חילוץ מוצרים ממבנה התשובה
      const products = data?.products || 
                       data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || 
                       [];

      const processed = products.map((product, index) => ({
        ...product,
        rank: index + 1,
        priceData: calculateFinalPrice(product),
        rating: extractRating(product),
        trustLevel: calculateTrustLevel(product),
        searchSource: 'proxy'
      }));

      setSearchResults(processed);
      return processed;

    } catch (err) {
      console.error('[useProductSearch] Proxy search error:', err);
      setError(t('errors.searchFailed'));
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  /**
   * עיבוד תוצאות חיפוש והוספת מטא-דאטה
   */
  const processSearchResults = (products, sourceProduct, translate) => {
    if (!products || !Array.isArray(products)) return [];

    return products.map((product, index) => {
      // חישוב נתוני מחיר
      const priceData = calculateFinalPrice(product);
      const sourcePrice = extractPrice(sourceProduct?.price);
      
      // חישוב חיסכון
      let savings = null;
      if (sourcePrice > 0 && priceData.finalPrice > 0 && priceData.finalPrice < sourcePrice) {
        savings = {
          amount: sourcePrice - priceData.finalPrice,
          percent: Math.round(((sourcePrice - priceData.finalPrice) / sourcePrice) * 100)
        };
      }

      // דירוג ורמת אמון
      const rating = extractRating(product);
      const orders = parseInt(product.orders || product.sales || 0);
      const trustLevel = calculateTrustLevel({ rating, salesCount: orders });

      return {
        ...product,
        rank: index + 1,
        priceData,
        rating,
        orders,
        savings,
        isBestDeal: index === 0,
        trustLevel,
        formattedPrice: formatPrice(priceData.finalPrice),
        searchSource: product.searchSource || 'unknown'
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
   * ניקוי תוצאות חיפוש
   */
  const clearResults = useCallback(() => {
    setSearchResults([]);
    setCurrentProduct(null);
    setError(null);
  }, []);

  /**
   * עדכון שפה בזמן אמת
   */
  useEffect(() => {
    // טעינת שפה שמורה
    chrome.storage.sync.get(['LANGUAGE'], (result) => {
      if (result.LANGUAGE && result.LANGUAGE !== i18n.language) {
        i18n.changeLanguage(result.LANGUAGE);
      }
    });

    // האזנה לשינויים
    const handleStorageChange = (changes, namespace) => {
      if (namespace === 'sync' && changes.LANGUAGE) {
        const newLang = changes.LANGUAGE.newValue;
        if (newLang !== i18n.language) {
          i18n.changeLanguage(newLang);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [i18n]);

  return {
    // State
    isSearching,
    searchResults,
    filteredResults,
    filters,
    sortBy,
    variantFilters,
    currentProduct,
    error,
    searchProgress,
    currentLanguage: i18n.language,
    
    // Actions
    performHybridSearch,
    performManualSearch,
    searchViaProxy: searchViaProxyAPI,
    clearResults,
    setCurrentProduct,
    
    // Filtering & Sorting
    updateFilters,
    updateSort,
    clearFilters,
    updateVariantFilters,
    
    // i18n
    t,
    i18n
  };
}

/**
 * Hook נוסף לניהול שפה בצורה מרוכזת
 */
export function useLanguage() {
  const { i18n } = useTranslation();

  const changeLanguage = useCallback(async (lang) => {
    await i18n.changeLanguage(lang);
    
    return new Promise((resolve) => {
      chrome.storage.sync.set({ LANGUAGE: lang }, () => {
        console.log('[useLanguage] Language changed to:', lang);
        resolve(lang);
      });
    });
  }, [i18n]);

  const getDirection = useCallback(() => {
    const rtlLanguages = ['he', 'ar', 'fa', 'ur'];
    return rtlLanguages.includes(i18n.language) ? 'rtl' : 'ltr';
  }, [i18n.language]);

  const isRTL = useCallback(() => {
    return getDirection() === 'rtl';
  }, [getDirection]);

  return {
    currentLanguage: i18n.language,
    changeLanguage,
    getDirection,
    isRTL,
    languages: [
      { code: 'he', name: 'עברית', nativeName: 'עברית' },
      { code: 'en', name: 'English', nativeName: 'English' }
    ]
  };
}
