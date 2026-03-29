import { useState, useEffect, useCallback } from 'react';
import {
  addPriceAlert,
  removePriceAlert,
  getPriceAlerts,
  getPriceAlert,
  hasPriceAlert,
  updatePriceAlert,
  updateCurrentPrice,
  calculateTargetPrice,
  getAlertSettings,
  saveAlertSettings,
  triggerManualPriceCheck,
  getAlertStats,
  cleanupOldAlerts,
} from '../services/priceAlerts';

/**
 * usePriceAlerts Hook
 * ניהול התראות מחיר
 * 
 * תכונות:
 * - טעינה וניהול רשימת התראות
 * - הוספה/הסרה/עדכון התראות
 * - סטטיסטיקות התראות
 * - הפעלת בדיקת מחירים ידנית
 */

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);

  /**
   * טעינת התראות והגדרות
   */
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        const [alertsData, settingsData, statsData] = await Promise.all([
          getPriceAlerts(),
          getAlertSettings(),
          getAlertStats(),
        ]);
        
        setAlerts(alertsData);
        setSettings(settingsData);
        setStats(statsData);
      } catch (error) {
        console.error('[usePriceAlerts] Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  /**
   * רענון התראות
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const [alertsData, statsData] = await Promise.all([
        getPriceAlerts(),
        getAlertStats(),
      ]);
      
      setAlerts(alertsData);
      setStats(statsData);
      return { success: true };
    } catch (error) {
      console.error('[usePriceAlerts] Refresh failed:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * הוספת התראה חדשה
   */
  const addAlert = useCallback(async (alertData) => {
    const result = await addPriceAlert(alertData);
    
    if (result.success) {
      await refresh();
    }
    
    return result;
  }, [refresh]);

  /**
   * הסרת התראה
   */
  const removeAlert = useCallback(async (productId) => {
    const result = await removePriceAlert(productId);
    
    if (result.success) {
      setAlerts(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      await refresh();
    }
    
    return result;
  }, [refresh]);

  /**
   * עדכון התראה
   */
  const updateAlert = useCallback(async (productId, updates) => {
    const result = await updatePriceAlert(productId, updates);
    
    if (result.success) {
      setAlerts(prev => ({
        ...prev,
        [productId]: { ...prev[productId], ...updates },
      }));
    }
    
    return result;
  }, []);

  /**
   * עדכון מחיר נוכחי והשוואה
   */
  const checkPrice = useCallback(async (productId, newPrice) => {
    return await updateCurrentPrice(productId, newPrice);
  }, []);

  /**
   * בדיקה האם יש התראה למוצר
   */
  const checkHasAlert = useCallback(async (productId) => {
    return await hasPriceAlert(productId);
  }, []);

  /**
   * קבלת התראה ספציפית
   */
  const getAlert = useCallback(async (productId) => {
    return await getPriceAlert(productId);
  }, []);

  /**
   * חישוב מחיר יעד מומלץ
   */
  const calculateRecommendedTarget = useCallback((originalPrice, desiredDrop = 10) => {
    return calculateTargetPrice(originalPrice, desiredDrop);
  }, []);

  /**
   * עדכון הגדרות
   */
  const updateSettings = useCallback(async (newSettings) => {
    const result = await saveAlertSettings(newSettings);
    
    if (result.success) {
      setSettings(result.settings);
    }
    
    return result;
  }, []);

  /**
   * הפעלת בדיקת מחירים ידנית
   */
  const triggerCheck = useCallback(async () => {
    return await triggerManualPriceCheck();
  }, []);

  /**
   * ניקוי התראות ישנות
   */
  const cleanup = useCallback(async (maxAgeDays = 30) => {
    const result = await cleanupOldAlerts(maxAgeDays);
    
    if (result.success) {
      await refresh();
    }
    
    return result;
  }, [refresh]);

  // חישובי פילטור וסטטיסטיקה
  const alertList = Object.values(alerts);
  const activeAlerts = alertList.filter(a => a.isActive !== false);
  const inactiveAlerts = alertList.filter(a => a.isActive === false);
  const alertsWithNotifications = alertList.filter(a => a.lastNotification);

  return {
    // State
    alerts,
    alertList,
    activeAlerts,
    inactiveAlerts,
    alertsWithNotifications,
    isLoading,
    settings,
    stats,
    
    // Counts
    totalAlerts: alertList.length,
    activeCount: activeAlerts.length,
    
    // Actions
    refresh,
    addAlert,
    removeAlert,
    updateAlert,
    checkPrice,
    checkHasAlert,
    getAlert,
    calculateRecommendedTarget,
    updateSettings,
    triggerCheck,
    cleanup,
  };
}
