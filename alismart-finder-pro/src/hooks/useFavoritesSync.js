import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserIdentity,
  fetchFavoritesFromCloud,
  syncFavoriteToCloud,
  removeFavoriteFromCloud,
  subscribeToFavorites,
  optimisticAddFavorite,
  optimisticRemoveFavorite,
  isFirebaseReady,
} from '../services/firebase';

/**
 * useFavoritesSync Hook
 * ניהול סנכרון מועדפים עם ענן ותמיכה במצב אופליין
 * 
 * תכונות:
 * - סנכרון דו-כיווני (ענן ↔ מקומי)
 * - מצב אופליין עם localStorage
 * - אופטימיסטי אפדייטים
 * - מניעת כפילויות
 * - סטטוס סנכרון בזמן אמת
 */

const STORAGE_KEY = 'ALISMART_FAVORITES_V2';
const SYNC_STATUS_KEY = 'ALISMART_SYNC_STATUS';

export function useFavoritesSync() {
  const [favorites, setFavorites] = useState([]);
  const [userId, setUserId] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, synced, offline, error
  const [lastSync, setLastSync] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const unsubscribeRef = useRef(null);
  const pendingSyncRef = useRef([]);

  /**
   * טעינת מועדפים מלוקאל סטורג'
   */
  const loadFromLocal = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[useFavoritesSync] Failed to load from localStorage:', e);
    }
    return [];
  }, []);

  /**
   * שמירת מועדפים ללוקאל סטורג'
   */
  const saveToLocal = useCallback((items) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify({
        lastUpdated: new Date().toISOString(),
        count: items.length,
      }));
    } catch (e) {
      console.warn('[useFavoritesSync] Failed to save to localStorage:', e);
    }
  }, []);

  /**
   * אתחול - זיהוי משתמש וטעינת נתונים
   */
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      try {
        // זיהוי משתמש
        const identity = await getUserIdentity();
        setUserId(identity);
        
        // טעינה מקומית תמיד קודם (Offline First)
        const localFavorites = loadFromLocal();
        setFavorites(localFavorites);
        
        if (identity && isFirebaseReady()) {
          // ניסיון לסנכרן מהענן
          setSyncStatus('syncing');
          
          try {
            const cloudFavorites = await fetchFavoritesFromCloud(identity);
            
            // מיזוג מועדפים (ענן מנצח אם יש התנגשות)
            const merged = mergeFavorites(localFavorites, cloudFavorites);
            setFavorites(merged);
            saveToLocal(merged);
            
            setSyncStatus('synced');
            setLastSync(new Date().toISOString());
            
            // הרשמה לעדכונים בזמן אמת
            unsubscribeRef.current = subscribeToFavorites(identity, (cloudItems) => {
              setFavorites(current => {
                const merged = mergeFavorites(current, cloudItems);
                saveToLocal(merged);
                return merged;
              });
              setLastSync(new Date().toISOString());
            });
            
          } catch (cloudError) {
            console.warn('[useFavoritesSync] Cloud sync failed, using local:', cloudError);
            setSyncStatus('offline');
            setError(cloudError.message);
          }
        } else {
          setSyncStatus('offline');
        }
      } catch (err) {
        console.error('[useFavoritesSync] Init error:', err);
        setError(err.message);
        setSyncStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // ניקוי
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [loadFromLocal, saveToLocal]);

  /**
   * מיזוג מועדפים מקומיים ומהענן
   */
  const mergeFavorites = (local, cloud) => {
    const merged = new Map();
    
    // הוספת מקומיים
    local.forEach(item => {
      merged.set(item.productId, { ...item, source: 'local' });
    });
    
    // הוספת ענן (מחליף מקומי אם יש התנגשות)
    cloud.forEach(item => {
      const existing = merged.get(item.productId);
      if (existing) {
        // שמירת הגרסה החדשה יותר
        const localTime = new Date(existing.savedAt || 0);
        const cloudTime = new Date(item.savedAt?.toDate?.() || item.savedAt || 0);
        
        if (cloudTime > localTime) {
          merged.set(item.productId, { ...item, source: 'cloud' });
        }
      } else {
        merged.set(item.productId, { ...item, source: 'cloud' });
      }
    });
    
    return Array.from(merged.values());
  };

  /**
   * הוספת מועדף (אופטימיסטי)
   */
  const addFavorite = useCallback(async (product) => {
    if (!product || !product.productId) return { success: false };

    setSyncStatus('syncing');
    
    try {
      let updatedFavorites;
      
      if (userId && isFirebaseReady()) {
        // אופטימיסטי אפדייט עם סנכרון רקע
        const result = await optimisticAddFavorite(favorites, product, userId);
        updatedFavorites = result.updatedFavorites;
      } else {
        // מצב אופליין - עדכון מקומי בלבד
        const exists = favorites.some(f => f.productId === product.productId);
        if (exists) {
          setSyncStatus('synced');
          return { success: true, alreadyExists: true };
        }
        
        updatedFavorites = [...favorites, {
          ...product,
          savedAt: new Date().toISOString(),
          pendingSync: true,
        }];
      }
      
      setFavorites(updatedFavorites);
      saveToLocal(updatedFavorites);
      
      // ניסיון סנכרון רקע
      if (userId && isFirebaseReady()) {
        try {
          await syncFavoriteToCloud(product, userId);
          setLastSync(new Date().toISOString());
          setSyncStatus('synced');
        } catch (e) {
          // שמירה לסנכרון מאוחר
          pendingSyncRef.current.push({ type: 'add', product });
          setSyncStatus('offline');
        }
      } else {
        setSyncStatus('offline');
      }
      
      return { success: true };
    } catch (err) {
      console.error('[useFavoritesSync] Add favorite failed:', err);
      setSyncStatus('error');
      return { success: false, error: err.message };
    }
  }, [favorites, userId, saveToLocal]);

  /**
   * הסרת מועדף (אופטימיסטי)
   */
  const removeFavorite = useCallback(async (productId) => {
    if (!productId) return { success: false };

    setSyncStatus('syncing');
    
    try {
      let updatedFavorites;
      
      if (userId && isFirebaseReady()) {
        // אופטימיסטי אפדייט עם סנכרון רקע
        const result = await optimisticRemoveFavorite(favorites, productId, userId);
        updatedFavorites = result.updatedFavorites;
      } else {
        // מצב אופליין
        updatedFavorites = favorites.filter(f => f.productId !== productId);
      }
      
      setFavorites(updatedFavorites);
      saveToLocal(updatedFavorites);
      
      // ניסיון סנכרון רקע
      if (userId && isFirebaseReady()) {
        try {
          await removeFavoriteFromCloud(productId, userId);
          setLastSync(new Date().toISOString());
          setSyncStatus('synced');
        } catch (e) {
          pendingSyncRef.current.push({ type: 'remove', productId });
          setSyncStatus('offline');
        }
      } else {
        setSyncStatus('offline');
      }
      
      return { success: true };
    } catch (err) {
      console.error('[useFavoritesSync] Remove favorite failed:', err);
      setSyncStatus('error');
      return { success: false, error: err.message };
    }
  }, [favorites, userId, saveToLocal]);

  /**
   * בדיקה האם מוצר במועדפים
   */
  const isFavorite = useCallback((productId) => {
    return favorites.some(f => f.productId === productId);
  }, [favorites]);

  /**
   * סנכרון ידני (למקרה של ניתוק וחיבור מחדש)
   */
  const forceSync = useCallback(async () => {
    if (!userId || !isFirebaseReady()) {
      return { success: false, error: 'Not connected' };
    }

    setSyncStatus('syncing');
    
    try {
      // סנכרון מועדפים ממתינים
      const pending = [...pendingSyncRef.current];
      pendingSyncRef.current = [];
      
      for (const item of pending) {
        if (item.type === 'add') {
          await syncFavoriteToCloud(item.product, userId);
        } else if (item.type === 'remove') {
          await removeFavoriteFromCloud(item.productId, userId);
        }
      }
      
      // משיכת עדכונים מהענן
      const cloudFavorites = await fetchFavoritesFromCloud(userId);
      const merged = mergeFavorites(favorites, cloudFavorites);
      
      setFavorites(merged);
      saveToLocal(merged);
      setLastSync(new Date().toISOString());
      setSyncStatus('synced');
      
      return { success: true, synced: pending.length };
    } catch (err) {
      console.error('[useFavoritesSync] Force sync failed:', err);
      setSyncStatus('error');
      return { success: false, error: err.message };
    }
  }, [favorites, userId, saveToLocal]);

  /**
   * יצוא מועדפים
   */
  const exportFavorites = useCallback(() => {
    return {
      favorites,
      exportedAt: new Date().toISOString(),
      count: favorites.length,
    };
  }, [favorites]);

  /**
   * יבוא מועדפים
   */
  const importFavorites = useCallback(async (data) => {
    if (!data || !Array.isArray(data.favorites)) {
      return { success: false, error: 'Invalid data format' };
    }

    try {
      const imported = data.favorites.map(item => ({
        ...item,
        importedAt: new Date().toISOString(),
      }));
      
      const merged = mergeFavorites(favorites, imported);
      setFavorites(merged);
      saveToLocal(merged);
      
      // סנכרון לענן
      if (userId && isFirebaseReady()) {
        for (const item of imported) {
          await syncFavoriteToCloud(item, userId);
        }
      }
      
      return { success: true, imported: imported.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [favorites, userId, saveToLocal]);

  return {
    favorites,
    isLoading,
    syncStatus,
    lastSync,
    error,
    userId,
    isOnline: syncStatus !== 'offline',
    
    // Actions
    addFavorite,
    removeFavorite,
    isFavorite,
    forceSync,
    exportFavorites,
    importFavorites,
  };
}
