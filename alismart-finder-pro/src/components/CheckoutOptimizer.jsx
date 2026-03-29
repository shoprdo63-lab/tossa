import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './CheckoutOptimizer.css';

/**
 * CheckoutOptimizer Component
 * Smart Cart Optimization with Game Theory & Threshold Analysis
 * 
 * Features:
 * - Threshold detection (how close to coupon minimum)
 * - Coin maximization (optimal coin usage per item)
 * - Voucher stacking simulation
 * - Auto-optimization with one-click apply
 * - Customs threshold warnings for Israeli shoppers
 */

const CHECKOUT_STEPS = {
  SCANNING: 'scanning',
  ANALYZING: 'analyzing',
  OPTIMIZED: 'optimized',
  ERROR: 'error'
};

const DEAL_GRADES = {
  A_PLUS: { grade: 'A+', color: '#00d084', label: 'Excellent' },
  A: { grade: 'A', color: '#00d084', label: 'Great' },
  B: { grade: 'B', color: '#ffa500', label: 'Good' },
  C: { grade: 'C', color: '#ff6a00', label: 'Fair' },
  D: { grade: 'D', color: '#ee0979', label: 'Poor' }
};

export default function CheckoutOptimizer() {
  const { t } = useTranslation();
  const [step, setStep] = useState(CHECKOUT_STEPS.SCANNING);
  const [cartData, setCartData] = useState(null);
  const [optimizations, setOptimizations] = useState([]);
  const [dealGrade, setDealGrade] = useState(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showCustomsWarning, setShowCustomsWarning] = useState(false);

  // Scan cart on mount
  useEffect(() => {
    scanCart();
  }, []);

  /**
   * Scans the current cart from AliExpress page
   */
  const scanCart = useCallback(async () => {
    setStep(CHECKOUT_STEPS.SCANNING);
    
    try {
      // Request cart data from content script
      const response = await chrome.runtime.sendMessage({ type: 'SCAN_CART' });
      
      if (response?.success && response.cartData) {
        setCartData(response.cartData);
        setStep(CHECKOUT_STEPS.ANALYZING);
        
        // Run optimization simulation
        const results = await simulateOptimizations(response.cartData);
        setOptimizations(results.optimizations);
        setDealGrade(results.dealGrade);
        setTotalSavings(results.totalSavings);
        setShowCustomsWarning(results.customsWarning);
        
        setStep(CHECKOUT_STEPS.OPTIMIZED);
      } else {
        setStep(CHECKOUT_STEPS.ERROR);
      }
    } catch (error) {
      console.error('[CheckoutOptimizer] Scan failed:', error);
      setStep(CHECKOUT_STEPS.ERROR);
    }
  }, []);

  /**
   * Simulates best combination of coupons, coins, and thresholds
   */
  const simulateOptimizations = async (cart) => {
    const optimizations = [];
    let totalSavings = 0;
    let customsWarning = false;
    
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = cart.shipping || 0;
    const currentTotal = subtotal + shipping;
    
    // 1. Threshold Analysis - Check how close to coupon minimums
    if (cart.availableCoupons) {
      for (const coupon of cart.availableCoupons) {
        const threshold = parseFloat(coupon.minOrder);
        const current = currentTotal;
        const gap = threshold - current;
        
        if (gap > 0 && gap <= 10) {
          // Within $10 of threshold - worthwhile to add more
          const savings = parseFloat(coupon.amount);
          optimizations.push({
            id: `threshold-${coupon.code}`,
            type: 'threshold',
            priority: savings / gap, // Value ratio
            title: t('checkoutOptimizer.addMoreToSave', { amount: gap.toFixed(2), save: savings.toFixed(2) }),
            description: t('checkoutOptimizer.thresholdDesc', { gap: gap.toFixed(2), coupon: coupon.code }),
            action: 'add_items',
            gap,
            savings,
            couponCode: coupon.code,
            icon: 'plus-circle'
          });
          totalSavings += savings;
        } else if (gap <= 0) {
          // Already qualified
          optimizations.push({
            id: `apply-${coupon.code}`,
            type: 'voucher',
            priority: parseFloat(coupon.amount),
            title: t('checkoutOptimizer.applyCoupon', { code: coupon.code, amount: coupon.amount }),
            description: t('checkoutOptimizer.couponDesc', { min: coupon.minOrder }),
            action: 'apply_voucher',
            couponCode: coupon.code,
            savings: parseFloat(coupon.amount),
            icon: 'ticket'
          });
          totalSavings += parseFloat(coupon.amount);
        }
      }
    }
    
    // 2. Coin Maximization - Calculate optimal coin usage
    if (cart.coins && cart.coins.available > 0) {
      const coins = cart.coins;
      const maxCoinDiscount = Math.min(
        coins.available * coins.exchangeRate,
        currentTotal * coins.maxPercentage // Usually 50% max
      );
      
      if (maxCoinDiscount > 0) {
        optimizations.push({
          id: 'coins-maximize',
          type: 'coins',
          priority: maxCoinDiscount,
          title: t('checkoutOptimizer.useCoins', { coins: coins.available, save: maxCoinDiscount.toFixed(2) }),
          description: t('checkoutOptimizer.coinsDesc', { rate: coins.exchangeRate }),
          action: 'use_coins',
          coinAmount: coins.available,
          savings: maxCoinDiscount,
          icon: 'coins'
        });
        totalSavings += maxCoinDiscount;
      }
    }
    
    // 3. Voucher Stacking - Try combining vouchers
    if (cart.availableCoupons && cart.availableCoupons.length > 1) {
      const bestCombo = findBestVoucherCombination(cart.availableCoupons, currentTotal);
      if (bestCombo.combination.length > 1) {
        optimizations.push({
          id: 'voucher-stack',
          type: 'stack',
          priority: bestCombo.totalSavings,
          title: t('checkoutOptimizer.stackVouchers', { count: bestCombo.combination.length, save: bestCombo.totalSavings.toFixed(2) }),
          description: t('checkoutOptimizer.stackDesc', { codes: bestCombo.combination.join(' + ') }),
          action: 'stack_vouchers',
          vouchers: bestCombo.combination,
          savings: bestCombo.totalSavings,
          icon: 'layers'
        });
        totalSavings = Math.max(totalSavings, bestCombo.totalSavings);
      }
    }
    
    // 4. Item-level optimizations
    for (const item of cart.items) {
      if (item.coinsDiscount && item.coinsDiscount > 0) {
        optimizations.push({
          id: `item-coins-${item.id}`,
          type: 'item_coins',
          priority: item.coinsDiscount,
          title: t('checkoutOptimizer.itemCoins', { item: item.title.substring(0, 30) }),
          description: t('checkoutOptimizer.itemCoinsDesc', { discount: item.coinsDiscount }),
          action: 'apply_item_coins',
          itemId: item.id,
          savings: item.coinsDiscount,
          icon: 'coin'
        });
      }
    }
    
    // Check customs threshold for Israeli shoppers ($75 USD tax-free)
    const TAX_FREE_THRESHOLD_USD = 75;
    if (currentTotal > TAX_FREE_THRESHOLD_USD * 0.8 && currentTotal < TAX_FREE_THRESHOLD_USD * 1.2) {
      customsWarning = true;
      if (currentTotal > TAX_FREE_THRESHOLD_USD) {
        optimizations.push({
          id: 'customs-warning',
          type: 'warning',
          priority: -1,
          title: t('checkoutOptimizer.customsWarning'),
          description: t('checkoutOptimizer.customsDesc', { threshold: TAX_FREE_THRESHOLD_USD }),
          action: 'reduce_cart',
          icon: 'alert-triangle',
          isWarning: true
        });
      }
    }
    
    // Sort by priority (highest savings first)
    optimizations.sort((a, b) => b.priority - a.priority);
    
    // Calculate deal grade
    const savingsPercentage = (totalSavings / currentTotal) * 100;
    let dealGrade = DEAL_GRADES.C;
    if (savingsPercentage >= 30) dealGrade = DEAL_GRADES.A_PLUS;
    else if (savingsPercentage >= 20) dealGrade = DEAL_GRADES.A;
    else if (savingsPercentage >= 10) dealGrade = DEAL_GRADES.B;
    else if (savingsPercentage >= 5) dealGrade = DEAL_GRADES.C;
    else dealGrade = DEAL_GRADES.D;
    
    return { optimizations, totalSavings, dealGrade, customsWarning };
  };

  /**
   * Finds best voucher combination using greedy algorithm
   */
  const findBestVoucherCombination = (coupons, cartTotal) => {
    // Filter applicable coupons
    const applicable = coupons.filter(c => cartTotal >= parseFloat(c.minOrder));
    
    // Try all combinations up to 2 vouchers (practical limit for AliExpress)
    let bestCombo = { combination: [], totalSavings: 0 };
    
    // Single voucher
    for (const coupon of applicable) {
      const savings = parseFloat(coupon.amount);
      if (savings > bestCombo.totalSavings) {
        bestCombo = { combination: [coupon.code], totalSavings: savings };
      }
    }
    
    // Pairs (if stacking is possible)
    for (let i = 0; i < applicable.length; i++) {
      for (let j = i + 1; j < applicable.length; j++) {
        const combined = parseFloat(applicable[i].amount) + parseFloat(applicable[j].amount);
        // Check if these can stack (usually platform + store voucher)
        if (canStack(applicable[i], applicable[j]) && combined > bestCombo.totalSavings) {
          bestCombo = { 
            combination: [applicable[i].code, applicable[j].code], 
            totalSavings: combined 
          };
        }
      }
    }
    
    return bestCombo;
  };

  /**
   * Checks if two vouchers can be stacked
   */
  const canStack = (voucher1, voucher2) => {
    // Platform + Store vouchers can usually stack
    const types = [voucher1.type, voucher2.type];
    return types.includes('platform') && types.includes('store');
  };

  /**
   * Applies all optimizations automatically
   */
  const handleAutoOptimize = async () => {
    setIsOptimizing(true);
    
    try {
      const actions = optimizations
        .filter(opt => !opt.isWarning)
        .map(opt => ({
          type: opt.action,
          data: opt
        }));
      
      const response = await chrome.runtime.sendMessage({
        type: 'AUTO_OPTIMIZE_CART',
        actions
      });
      
      if (response?.success) {
        // Re-scan after optimization
        setTimeout(scanCart, 1500);
      }
    } catch (error) {
      console.error('[CheckoutOptimizer] Auto-optimize failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  /**
   * Applies single optimization
   */
  const handleApplyOptimization = async (optimization) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'APPLY_OPTIMIZATION',
        action: optimization.action,
        data: optimization
      });
      
      // Refresh after apply
      setTimeout(scanCart, 1000);
    } catch (error) {
      console.error('[CheckoutOptimizer] Apply failed:', error);
    }
  };

  /**
   * Renders icon based on type
   */
  const renderIcon = (iconName) => {
    const icons = {
      'plus-circle': (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
      ),
      'ticket': (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
          <path d="M13 5v14"></path>
        </svg>
      ),
      'coins': (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="7"></circle>
          <path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"></path>
        </svg>
      ),
      'coin': (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v12"></path>
          <path d="M8 10h8"></path>
        </svg>
      ),
      'layers': (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      ),
      'alert-triangle': (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <path d="M12 9v4"></path>
          <path d="M12 17h.01"></path>
        </svg>
      )
    };
    
    return icons[iconName] || icons['ticket'];
  };

  // Render loading state
  if (step === CHECKOUT_STEPS.SCANNING || step === CHECKOUT_STEPS.ANALYZING) {
    return (
      <div className="checkout-optimizer loading">
        <div className="optimizer-header">
          <div className="pulse-dot"></div>
          <span>{step === CHECKOUT_STEPS.SCANNING ? t('checkoutOptimizer.scanning') : t('checkoutOptimizer.analyzing')}</span>
        </div>
        <div className="optimization-skeleton">
          <div className="skeleton-line"></div>
          <div className="skeleton-line short"></div>
        </div>
      </div>
    );
  }

  // Render error state
  if (step === CHECKOUT_STEPS.ERROR) {
    return (
      <div className="checkout-optimizer error">
        <div className="optimizer-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ee0979" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{t('checkoutOptimizer.error')}</span>
        </div>
        <button className="retry-btn" onClick={scanCart}>
          {t('checkoutOptimizer.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="checkout-optimizer">
      {/* Header with Deal Grade */}
      <div className="optimizer-header">
        <div className="deal-grade-badge" style={{ backgroundColor: dealGrade?.color }}>
          <span className="grade">{dealGrade?.grade}</span>
          <span className="label">{dealGrade?.label}</span>
        </div>
        
        {totalSavings > 0 && (
          <div className="savings-badge">
            <span className="savings-amount">${totalSavings.toFixed(2)}</span>
            <span className="savings-label">{t('checkoutOptimizer.potentialSavings')}</span>
          </div>
        )}
      </div>

      {/* Customs Warning */}
      {showCustomsWarning && (
        <div className="customs-warning-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
            <path d="M12 9v4"></path>
            <path d="M12 17h.01"></path>
          </svg>
          <span>{t('checkoutOptimizer.customsAlert')}</span>
        </div>
      )}

      {/* Optimization Checklist */}
      <div className="optimizations-list">
        <h4>{t('checkoutOptimizer.optimizationsFound')}</h4>
        
        {optimizations.length === 0 ? (
          <div className="no-optimizations">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00d084" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <p>{t('checkoutOptimizer.alreadyOptimized')}</p>
          </div>
        ) : (
          optimizations.map((opt) => (
            <div 
              key={opt.id} 
              className={`optimization-card ${opt.isWarning ? 'warning' : ''} ${opt.applied ? 'applied' : ''}`}
            >
              <div className="card-icon" style={{ color: opt.isWarning ? '#ffa500' : '#ff6a00' }}>
                {renderIcon(opt.icon)}
              </div>
              
              <div className="card-content">
                <h5>{opt.title}</h5>
                <p>{opt.description}</p>
                
                {opt.savings > 0 && (
                  <span className="savings-tag">Save ${opt.savings.toFixed(2)}</span>
                )}
              </div>
              
              {!opt.isWarning && (
                <button 
                  className="apply-btn"
                  onClick={() => handleApplyOptimization(opt)}
                  disabled={opt.applied}
                >
                  {opt.applied ? t('checkoutOptimizer.applied') : t('checkoutOptimizer.apply')}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Auto-Optimize Button */}
      {optimizations.some(opt => !opt.isWarning && !opt.applied) && (
        <button 
          className="auto-optimize-btn"
          onClick={handleAutoOptimize}
          disabled={isOptimizing}
        >
          {isOptimizing ? (
            <>
              <div className="spinner"></div>
              {t('checkoutOptimizer.optimizing')}
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
              {t('checkoutOptimizer.autoOptimize')}
            </>
          )}
        </button>
      )}

      {/* Footer Info */}
      <div className="optimizer-footer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>{t('checkoutOptimizer.footerInfo')}</span>
      </div>
    </div>
  );
}
