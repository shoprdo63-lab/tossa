/**
 * Firebase Cloud Sync Service
 * שירות סנכרון ענן למועדפים
 * 
 * תכונות:
 * - אימות משתמש דרך chrome.identity
 * - שמירת מועדפים ב-Firebase Firestore
 * - סנכרון דו-כיווני (ענן ↔ מקומי)
 * - תמיכה במצב אופליין
 * - מניעת כפילויות
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  enableIndexedDbPersistence,
} from 'firebase/firestore';

// Firebase configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "alismart-finder-pro.firebaseapp.com",
  projectId: "alismart-finder-pro",
  storageBucket: "alismart-finder-pro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  
  // Enable offline persistence
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] Browser does not support persistence.');
    }
  });
} catch (error) {
  console.error('[Firebase] Initialization error:', error);
}

/**
 * מקבל את האימייל של המשתמש דרך chrome.identity
 * @returns {Promise<string|null>} אימייל משתמש או null
 */
export async function getUserIdentity() {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      if (chrome.runtime.lastError) {
        console.warn('[Firebase] Identity error:', chrome.runtime.lastError);
        resolve(null);
        return;
      }
      
      if (userInfo && userInfo.email) {
        resolve(userInfo.email);
      } else {
        // Fallback: generate anonymous ID
        resolve(generateAnonymousId());
      }
    });
  });
}

/**
 * יוצר מזהה אנונימי למשתמשים ללא אימייל
 */
function generateAnonymousId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['ANONYMOUS_USER_ID'], (result) => {
      if (result.ANONYMOUS_USER_ID) {
        resolve(result.ANONYMOUS_USER_ID);
      } else {
        const id = 'anon_' + Math.random().toString(36).substring(2, 15);
        chrome.storage.local.set({ ANONYMOUS_USER_ID: id }, () => {
          resolve(id);
        });
      }
    });
  });
}

/**
 * מסנכרן מועדף בודד לענן
 * @param {Object} product - נתוני המוצר
 * @param {string} userId - מזהה משתמש
 */
export async function syncFavoriteToCloud(product, userId) {
  if (!db || !userId || !product) return;

  try {
    const favoriteRef = doc(db, 'users', userId, 'favorites', product.productId);
    
    await setDoc(favoriteRef, {
      productId: product.productId,
      title: product.title || product.product_title || '',
      price: product.price || '',
      imageUrl: product.imageUrl || product.product_main_image_url || product.img || '',
      productUrl: product.productUrl || product.product_detail_url || '',
      savedAt: serverTimestamp(),
      lastSynced: serverTimestamp(),
    }, { merge: true });

    console.log('[Firebase] Favorite synced to cloud:', product.productId);
    return true;
  } catch (error) {
    console.error('[Firebase] Failed to sync favorite:', error);
    throw error;
  }
}

/**
 * מסיר מועדף מהענן
 * @param {string} productId - מזהה מוצר
 * @param {string} userId - מזהה משתמש
 */
export async function removeFavoriteFromCloud(productId, userId) {
  if (!db || !userId || !productId) return;

  try {
    const favoriteRef = doc(db, 'users', userId, 'favorites', productId);
    await deleteDoc(favoriteRef);
    console.log('[Firebase] Favorite removed from cloud:', productId);
    return true;
  } catch (error) {
    console.error('[Firebase] Failed to remove favorite:', error);
    throw error;
  }
}

/**
 * מושך את כל המועדפים מהענן
 * @param {string} userId - מזהה משתמש
 * @returns {Promise<Array>} רשימת מועדפים
 */
export async function fetchFavoritesFromCloud(userId) {
  if (!db || !userId) return [];

  try {
    const favoritesRef = collection(db, 'users', userId, 'favorites');
    const snapshot = await getDocs(favoritesRef);
    
    const favorites = snapshot.docs.map(doc => ({
      ...doc.data(),
      cloudId: doc.id,
    }));

    console.log('[Firebase] Fetched', favorites.length, 'favorites from cloud');
    return favorites;
  } catch (error) {
    console.error('[Firebase] Failed to fetch favorites:', error);
    throw error;
  }
}

/**
 * מבצע סנכרון מלא (מקומי → ענן)
 * @param {Array} localFavorites - רשימת מועדפים מקומית
 * @param {string} userId - מזהה משתמש
 */
export async function fullSyncToCloud(localFavorites, userId) {
  if (!db || !userId || !Array.isArray(localFavorites)) return;

  try {
    const batch = writeBatch(db);
    const favoritesRef = collection(db, 'users', userId, 'favorites');

    // מוחק את כל המועדפים הקיימים
    const existingSnapshot = await getDocs(favoritesRef);
    existingSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // שומר את המועדפים החדשים
    localFavorites.forEach(product => {
      const favoriteRef = doc(db, 'users', userId, 'favorites', product.productId);
      batch.set(favoriteRef, {
        productId: product.productId,
        title: product.title || product.product_title || '',
        price: product.price || '',
        imageUrl: product.imageUrl || product.product_main_image_url || product.img || '',
        productUrl: product.productUrl || product.product_detail_url || '',
        savedAt: serverTimestamp(),
        lastSynced: serverTimestamp(),
      });
    });

    await batch.commit();
    console.log('[Firebase] Full sync completed:', localFavorites.length, 'items');
    return true;
  } catch (error) {
    console.error('[Firebase] Full sync failed:', error);
    throw error;
  }
}

/**
 * מאזין לשינויים בזמן אמת מהענן
 * @param {string} userId - מזהה משתמש
 * @param {Function} onUpdate - קולבק לעדכון נתונים
 * @returns {Function} פונקציית unsubscribe
 */
export function subscribeToFavorites(userId, onUpdate) {
  if (!db || !userId) return () => {};

  const favoritesRef = collection(db, 'users', userId, 'favorites');
  
  return onSnapshot(favoritesRef, (snapshot) => {
    const favorites = snapshot.docs.map(doc => ({
      ...doc.data(),
      cloudId: doc.id,
    }));
    
    console.log('[Firebase] Real-time update:', favorites.length, 'items');
    onUpdate(favorites);
  }, (error) => {
    console.error('[Firebase] Subscription error:', error);
  });
}

/**
 * בודק האם Firebase מחובר
 */
export function isFirebaseReady() {
  return !!db;
}

/**
 * מבצע אופטימיסטי אפדייט - מעדכן מקומית מיד וסנכרן לענן ברקע
 * @param {Array} currentFavorites - רשימה נוכחית
 * @param {Object} product - מוצר להוספה
 * @param {string} userId - מזהה משתמש
 * @returns {Promise<{success: boolean, updatedFavorites: Array}>}
 */
export async function optimisticAddFavorite(currentFavorites, product, userId) {
  // עדכון אופטימיסטי מקומי
  const exists = currentFavorites.some(f => f.productId === product.productId);
  if (exists) {
    return { success: true, updatedFavorites: currentFavorites };
  }

  const updatedFavorites = [...currentFavorites, {
    ...product,
    savedAt: new Date().toISOString(),
    pendingSync: true,
  }];

  // סנכרון לענן ברקע
  syncFavoriteToCloud(product, userId).then(() => {
    console.log('[Firebase] Background sync completed');
  }).catch(err => {
    console.warn('[Firebase] Background sync failed (will retry):', err);
  });

  return { success: true, updatedFavorites };
}

/**
 * מבצע אופטימיסטי רימוב - מסיר מקומית מיד וסנכרן לענן ברקע
 * @param {Array} currentFavorites - רשימה נוכחית
 * @param {string} productId - מזהה מוצר להסרה
 * @param {string} userId - מזהה משתמש
 * @returns {Promise<{success: boolean, updatedFavorites: Array}>}
 */
export async function optimisticRemoveFavorite(currentFavorites, productId, userId) {
  // עדכון אופטימיסטי מקומי
  const updatedFavorites = currentFavorites.filter(f => f.productId !== productId);

  // סנכרון לענן ברקע
  removeFavoriteFromCloud(productId, userId).then(() => {
    console.log('[Firebase] Background remove completed');
  }).catch(err => {
    console.warn('[Firebase] Background remove failed (will retry):', err);
  });

  return { success: true, updatedFavorites };
}

export { db, app };
