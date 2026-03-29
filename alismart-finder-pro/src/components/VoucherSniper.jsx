import { useState, useEffect, useCallback } from 'react'
import { huntHiddenVouchers, validateVoucher, bruteForceVouchersAtCheckout } from '../services/api.js'
import './VoucherSniper.css'

/**
 * VoucherSniper Component
 * Active scanner for hidden store coupons, follower vouchers, and cashback codes
 * Auto-applies best codes at checkout with intelligent brute-force testing
 */
function VoucherSniper({ storeId, productId, cartTotal = 0, onVoucherApplied }) {
  const [vouchers, setVouchers] = useState(null)
  const [isHunting, setIsHunting] = useState(false)
  const [selectedVouchers, setSelectedVouchers] = useState([])
  const [appliedVouchers, setAppliedVouchers] = useState([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [activeTab, setActiveTab] = useState('hidden')
  const [isAutoApplying, setIsAutoApplying] = useState(false)

  // Hunt for vouchers on mount
  useEffect(() => {
    if (storeId) {
      huntForVouchers()
    }
  }, [storeId, productId])

  const huntForVouchers = async () => {
    setIsHunting(true)
    try {
      const result = await huntHiddenVouchers(storeId, productId)
      if (result.success) {
        setVouchers(result.vouchers)
        // Auto-select the best combo
        if (result.bestCombo) {
          setSelectedVouchers(result.bestCombo.vouchers.map(v => v.code))
        }
      }
    } catch (error) {
      console.error('[AliSmart VoucherSniper] Hunt failed:', error)
    } finally {
      setIsHunting(false)
    }
  }

  // Toggle voucher selection
  const toggleVoucher = useCallback((code) => {
    setSelectedVouchers(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }, [])

  // Apply selected vouchers
  const applySelected = async () => {
    if (selectedVouchers.length === 0) return
    
    setIsAutoApplying(true)
    
    try {
      // Test each code and find the best one
      const allVouchers = [
        ...(vouchers?.follower || []),
        ...(vouchers?.threshold || []),
        ...(vouchers?.platform || []),
        ...(vouchers?.cashback || [])
      ]
      
      const codesToTest = selectedVouchers
      let bestSavings = 0
      let bestCode = null
      
      for (const code of codesToTest) {
        const voucher = allVouchers.find(v => v.code === code)
        if (voucher && cartTotal >= voucher.minOrder) {
          const result = await validateVoucher(code, productId)
          if (result.valid && result.savings > bestSavings) {
            bestSavings = result.savings
            bestCode = code
          }
        }
      }
      
      if (bestCode) {
        setAppliedVouchers([bestCode])
        setSuccessMessage(`Hidden $${bestSavings.toFixed(2)} voucher applied successfully`)
        setShowSuccess(true)
        
        if (onVoucherApplied) {
          onVoucherApplied({ code: bestCode, savings: bestSavings })
        }
        
        setTimeout(() => setShowSuccess(false), 3000)
      }
    } catch (error) {
      console.error('[AliSmart VoucherSniper] Apply failed:', error)
    } finally {
      setIsAutoApplying(false)
    }
  }

  // Auto-apply all (brute force mode)
  const autoApplyAll = async () => {
    if (!vouchers) return
    
    setIsAutoApplying(true)
    
    const allCodes = [
      ...(vouchers.follower?.map(v => v.code) || []),
      ...(vouchers.threshold?.map(v => v.code) || []),
      ...(vouchers.platform?.map(v => v.code) || []),
      ...(vouchers.cashback?.map(v => v.code) || [])
    ]
    
    try {
      const results = await bruteForceVouchersAtCheckout(allCodes, window.location.href)
      
      if (results.bestCode && results.bestSavings > 0) {
        setAppliedVouchers([results.bestCode])
        setSuccessMessage(`Auto-applied best voucher: ${results.bestCode} (-$${results.bestSavings.toFixed(2)})`)
        setShowSuccess(true)
        
        if (onVoucherApplied) {
          onVoucherApplied({ code: results.bestCode, savings: results.bestSavings })
        }
        
        setTimeout(() => setShowSuccess(false), 3000)
      }
    } catch (error) {
      console.error('[AliSmart VoucherSniper] Auto-apply failed:', error)
    } finally {
      setIsAutoApplying(false)
    }
  }

  // Format expiry date
  const formatExpiry = (date) => {
    if (!date) return 'Unknown expiry'
    const expiry = new Date(date)
    const days = Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24))
    return days <= 0 ? 'Expired' : `${days} days left`
  }

  // Calculate potential savings
  const calculateSavings = (voucher) => {
    if (!cartTotal || cartTotal < voucher.minOrder) return 0
    return Math.min(voucher.amount, cartTotal * 0.5) // Cap at 50% of order
  }

  // Loading state
  if (isHunting) {
    return (
      <div className="voucher-sniper loading">
        <div className="sniper-scanning">
          <div className="scan-radar">
            <div className="radar-circle"></div>
            <div className="radar-sweep"></div>
            <div className="radar-dot"></div>
          </div>
          <p className="scan-text">Sniper Mode Active...</p>
          <p className="scan-sub">Scanning store API for hidden vouchers</p>
        </div>
      </div>
    )
  }

  // No vouchers found
  if (!vouchers || vouchers.totalFound === 0) {
    return (
      <div className="voucher-sniper empty">
        <div className="sniper-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
          <h3>Hidden Voucher Sniper</h3>
          <p>View a product from an AliExpress store to scan for hidden coupons</p>
        </div>
      </div>
    )
  }

  const allVouchers = [
    ...(vouchers.follower || []),
    ...(vouchers.threshold || []),
    ...(vouchers.platform || []),
    ...(vouchers.cashback || [])
  ]

  const totalPotentialSavings = selectedVouchers.reduce((sum, code) => {
    const v = allVouchers.find(v => v.code === code)
    return sum + (v ? calculateSavings(v) : 0)
  }, 0)

  return (
    <div className="voucher-sniper">
      {/* Success Notification */}
      {showSuccess && (
        <div className="voucher-success-toast">
          <div className="success-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="success-content">
            <span className="success-title">Hidden Deal Found!</span>
            <span className="success-message">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sniper-header">
        <h3 className="sniper-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          Hidden Voucher Sniper
          <span className="found-badge">{vouchers.totalFound} found</span>
        </h3>
      </div>

      {/* Tabs */}
      <div className="sniper-tabs">
        <button 
          className={`sniper-tab ${activeTab === 'hidden' ? 'active' : ''}`}
          onClick={() => setActiveTab('hidden')}
        >
          Hidden Deals
        </button>
        <button 
          className={`sniper-tab ${activeTab === 'combos' ? 'active' : ''}`}
          onClick={() => setActiveTab('combos')}
        >
          Golden Combos
          {vouchers.combo?.length > 0 && (
            <span className="combo-badge">{vouchers.combo.length}</span>
          )}
        </button>
      </div>

      {/* Hidden Deals Tab */}
      {activeTab === 'hidden' && (
        <div className="voucher-list">
          {/* Magic Codes Section */}
          <div className="voucher-section">
            <h4 className="section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
              Magic Codes
            </h4>
            
            {allVouchers.length === 0 ? (
              <p className="no-vouchers">No hidden vouchers found for this store</p>
            ) : (
              <div className="voucher-grid">
                {allVouchers.map((voucher, idx) => {
                  const isSelected = selectedVouchers.includes(voucher.code)
                  const isApplied = appliedVouchers.includes(voucher.code)
                  const savings = calculateSavings(voucher)
                  const isEligible = cartTotal >= voucher.minOrder

                  return (
                    <div 
                      key={idx}
                      className={`voucher-card ${isSelected ? 'selected' : ''} ${isApplied ? 'applied' : ''} ${!isEligible ? 'ineligible' : ''}`}
                      onClick={() => isEligible && toggleVoucher(voucher.code)}
                    >
                      <div className="voucher-header">
                        <span className={`voucher-type ${voucher.type}`}>
                          {voucher.type === 'follower' && 'Follower'}
                          {voucher.type === 'threshold' && 'Threshold'}
                          {voucher.type === 'platform' && 'Platform'}
                          {voucher.type === 'cashback' && 'Cashback'}
                        </span>
                        {isApplied && (
                          <span className="applied-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                            Applied
                          </span>
                        )}
                      </div>

                      <div className="voucher-code">{voucher.code}</div>

                      <div className="voucher-value">
                        <span className="amount">${voucher.amount.toFixed(2)}</span>
                        <span className="off">OFF</span>
                      </div>

                      <div className="voucher-conditions">
                        <span className="min-order">
                          Min. ${voucher.minOrder.toFixed(0)} order
                        </span>
                        <span className="expiry">
                          {formatExpiry(voucher.expiry)}
                        </span>
                      </div>

                      {cartTotal > 0 && (
                        <div className="voucher-savings">
                          {isEligible ? (
                            <span className="savings-amount">
                              Save ${savings.toFixed(2)} on your order
                            </span>
                          ) : (
                            <span className="need-more">
                              Add ${(voucher.minOrder - cartTotal).toFixed(2)} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {selectedVouchers.length > 0 && (
            <div className="voucher-actions">
              <div className="selected-summary">
                <span className="selected-count">{selectedVouchers.length} selected</span>
                {cartTotal > 0 && (
                  <span className="potential-savings">
                    Save up to ${totalPotentialSavings.toFixed(2)}
                  </span>
                )}
              </div>
              
              <button 
                className="apply-btn"
                onClick={applySelected}
                disabled={isAutoApplying}
              >
                {isAutoApplying ? (
                  <>
                    <span className="btn-spinner"></span>
                    Testing Codes...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5"></path>
                    </svg>
                    Apply Selected
                  </>
                )}
              </button>

              <button 
                className="auto-apply-btn"
                onClick={autoApplyAll}
                disabled={isAutoApplying}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                Auto-Apply All ({allVouchers.length} codes)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Golden Combos Tab */}
      {activeTab === 'combos' && (
        <div className="combo-list">
          <h4 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            The Golden Combo
          </h4>
          <p className="combo-desc">Best voucher combinations that can stack together</p>

          {vouchers.combo?.length === 0 ? (
            <p className="no-combos">No stackable combos found. Try individual vouchers.</p>
          ) : (
            <div className="combo-stack">
              {vouchers.combo.slice(0, 3).map((combo, idx) => (
                <div key={idx} className={`combo-card ${idx === 0 ? 'best' : ''}`}>
                  {idx === 0 && (
                    <div className="best-badge">Best Combo</div>
                  )}
                  
                  <div className="combo-vouchers">
                    {combo.vouchers.map((v, vidx) => (
                      <div key={vidx} className="combo-voucher-tag">
                        <span className="tag-type">{v.type}</span>
                        <span className="tag-code">{v.code}</span>
                      </div>
                    ))}
                  </div>

                  <div className="combo-savings">
                    <span className="savings-label">Total Savings</span>
                    <span className="savings-value">${combo.totalSavings.toFixed(2)}</span>
                  </div>

                  <div className="combo-requirements">
                    Min. order: ${combo.totalMinOrder.toFixed(0)}
                  </div>

                  <button 
                    className="select-combo-btn"
                    onClick={() => setSelectedVouchers(combo.vouchers.map(v => v.code))}
                  >
                    Select This Combo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="sniper-footer">
        <p>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          Scans store API, follower coupons & hidden thresholds
        </p>
      </div>
    </div>
  )
}

export default VoucherSniper
