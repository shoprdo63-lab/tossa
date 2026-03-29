import { useState, useEffect, useCallback } from 'react'
import { predictPriceTrend, getDealTier, getUpcomingSales } from '../utils/ai-logic.js'
import './AIDealAdvisor.css'

/**
 * AI Deal Advisor Component
 * Displays AI-powered deal analysis with Deal Score, expert verdict, and price pinning
 * World Class Analytics - Stock Market Style UI
 */
function AIDealAdvisor({ productData, priceHistory, sellerData, shippingCost = 0, onPinPrice }) {
  const [prediction, setPrediction] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pinnedPrice, setPinnedPrice] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  // Run prediction when data changes
  useEffect(() => {
    if (!productData) return
    
    setIsAnalyzing(true)
    
    // Simulate AI analysis delay
    const timer = setTimeout(() => {
      const result = predictPriceTrend(productData, priceHistory, sellerData, shippingCost)
      setPrediction(result)
      setIsAnalyzing(false)
    }, 800)
    
    return () => clearTimeout(timer)
  }, [productData, priceHistory, sellerData, shippingCost])

  // Load pinned price
  useEffect(() => {
    chrome.storage.local.get('alismart_pinned_price', (result) => {
      if (result.alismart_pinned_price && result.alismart_pinned_price.productId === productData?.productId) {
        setPinnedPrice(result.alismart_pinned_price)
      }
    })
  }, [productData])

  const handlePinPrice = useCallback(() => {
    if (!productData || !prediction) return
    
    const pinData = {
      productId: productData.productId,
      price: prediction.stats.current,
      pinnedAt: Date.now(),
      targetPrice: prediction.stats.current * 0.9 // 10% drop target
    }
    
    chrome.storage.local.set({ alismart_pinned_price: pinData }, () => {
      setPinnedPrice(pinData)
      if (onPinPrice) onPinPrice(pinData)
    })
  }, [productData, prediction, onPinPrice])

  const handleUnpinPrice = useCallback(() => {
    chrome.storage.local.remove('alismart_pinned_price', () => {
      setPinnedPrice(null)
    })
  }, [])

  if (isAnalyzing) {
    return (
      <div className="ai-advisor loading">
        <div className="ai-analyzing">
          <div className="ai-brain">
            <div className="brain-pulse"></div>
            <div className="brain-rings">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <p className="analyzing-text">AI Analyzing Market Data...</p>
          <p className="analyzing-sub">Checking price history, sales calendar, and seller patterns</p>
        </div>
      </div>
    )
  }

  if (!prediction) {
    return (
      <div className="ai-advisor empty">
        <div className="ai-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
          <p>View a product to see AI Deal Analysis</p>
        </div>
      </div>
    )
  }

  const tier = getDealTier(prediction.score)
  const isPinned = pinnedPrice && pinnedPrice.productId === productData?.productId

  return (
    <div className={`ai-advisor ${tier.name}`}>
      {/* Expert Card Header */}
      <div className="ai-expert-card">
        <div className="expert-avatar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
        </div>
        <div className="expert-info">
          <span className="expert-label">AI Expert Verdict</span>
          <span className={`confidence-badge ${prediction.confidence}`}>
            {prediction.confidence === 'high' ? 'High Confidence' : 
             prediction.confidence === 'medium' ? 'Medium Confidence' : 'Low Confidence'}
          </span>
        </div>
      </div>

      {/* Verdict Text */}
      <div className="ai-verdict">
        <p>{prediction.verdict}</p>
      </div>

      {/* Deal Score with Gradient Progress Bar */}
      <div className="deal-score-section">
        <div className="score-header">
          <span className="score-label">Deal Score</span>
          <span className="score-value" style={{ color: tier.color }}>
            {prediction.score}/100
          </span>
        </div>
        <div className="score-bar-container">
          <div 
            className="score-bar" 
            style={{ 
              width: `${prediction.score}%`,
              background: `linear-gradient(90deg, ${tier.color}80, ${tier.color})`
            }}
          >
            <div className="score-glow"></div>
          </div>
        </div>
        <div className="tier-badge" style={{ backgroundColor: `${tier.color}20`, color: tier.color, borderColor: tier.color }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {getTierIcon(tier.icon)}
          </svg>
          {tier.label}
        </div>
      </div>

      {/* Quick Stats */}
      {prediction.stats && (
        <div className="ai-quick-stats">
          <div className="stat-item">
            <span className="stat-label">Current</span>
            <span className="stat-value">${prediction.stats.current.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Average (30d)</span>
            <span className="stat-value">${prediction.stats.average.toFixed(2)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Lowest</span>
            <span className="stat-value lowest">${prediction.stats.min.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Savings Potential */}
      {prediction.savingsPotential > 0 && prediction.score < 70 && (
        <div className="savings-potential">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <span>
            Save up to <strong>${prediction.savingsPotential.toFixed(2)}</strong> if you wait
          </span>
        </div>
      )}

      {/* Upcoming Sales Alert */}
      {prediction.upcomingSales.length > 0 && prediction.score < 70 && (
        <div className="upcoming-sales-alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <div className="sale-info">
            <span className="sale-name">{prediction.upcomingSales[0].name}</span>
            <span className="sale-countdown">in {prediction.upcomingSales[0].daysUntil} days</span>
          </div>
        </div>
      )}

      {/* Price Pinning Section */}
      <div className="price-pinning-section">
        {isPinned ? (
          <div className="pinned-status">
            <div className="pin-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z"/>
              </svg>
              <span>Pinned at ${pinnedPrice.price.toFixed(2)}</span>
            </div>
            <div className="pin-target">
              Alert when below ${pinnedPrice.targetPrice.toFixed(2)}
            </div>
            <button className="unpin-btn" onClick={handleUnpinPrice}>
              Unpin Price
            </button>
          </div>
        ) : (
          <button className="pin-price-btn" onClick={handlePinPrice}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z"/>
            </svg>
            Pin This Price
          </button>
        )}
      </div>

      {/* Analysis Details Toggle */}
      <button className="details-toggle" onClick={() => setShowDetails(!showDetails)}>
        {showDetails ? 'Hide Analysis Details' : 'Show Analysis Details'}
        <svg className={showDetails ? 'expanded' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Detailed Analysis */}
      {showDetails && (
        <div className="analysis-details">
          <h4>Analysis Factors</h4>
          <ul className="factors-list">
            {prediction.reasons.map((reason, idx) => (
              <li key={idx} className={`factor ${reason.includes('manipulation') ? 'negative' : reason.includes('below') ? 'positive' : 'neutral'}`}>
                <span className="factor-dot"></span>
                {formatReason(reason)}
              </li>
            ))}
          </ul>
          
          {prediction.manipulation && prediction.manipulation.pattern !== 'stable' && (
            <div className="manipulation-warning">
              <strong>Seller Price Behavior:</strong>
              <p>{formatManipulationWarning(prediction.manipulation.pattern)}</p>
            </div>
          )}
          
          {prediction.upcomingSales.length > 0 && (
            <div className="upcoming-sales-list">
              <strong>Upcoming Sales:</strong>
              <ul>
                {prediction.upcomingSales.map((sale, idx) => (
                  <li key={idx}>
                    {sale.name} - {sale.daysUntil} days
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Gets the icon SVG path for a tier
 * @param {string} iconName - Icon name
 * @returns {JSX.Element} SVG content
 */
function getTierIcon(iconName) {
  const icons = {
    crown: <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm11 16h-2"/>,
    'check-circle': <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    'alert-triangle': <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
  }
  return icons[iconName] || icons.info
}
/**
 * Formats reason codes to readable text
 * @param {string} reason - Reason code
 * @returns {string} Human readable text
 */
function formatReason(reason) {
  const reasonMap = {
    'price_above_average': 'Current price is above 30-day average',
    'price_slightly_above_average': 'Current price is slightly above average',
    'price_below_average': 'Price is below average - good deal',
    'price_well_below_average': 'Price well below average - excellent',
    'near_all_time_low': 'Near all-time lowest price',
    'near_all_time_high': 'Near all-time highest price',
    'sale_approaching': 'Major sale approaching within 7 days',
    'sale_imminent': 'Sale starts very soon',
    'high_manipulation': 'Seller shows price manipulation patterns',
    'moderate_manipulation': 'Seller shows moderate price manipulation',
    'low_manipulation': 'Some price fluctuation detected',
    'stable': 'Seller pricing is stable',
    'high_volatility': 'High price volatility detected',
    'stable_price': 'Price is historically stable',
    'high_shipping_impact': 'High shipping cost affects value'
  }
  return reasonMap[reason] || reason
}

/**
 * Formats manipulation warning text
 */
function formatManipulationWarning(pattern) {
  const warnings = {
    'high_manipulation': 'This seller frequently inflates prices before sales. Expect price drops during sales events.',
    'moderate_manipulation': 'This seller sometimes increases prices before promotions.',
    'low_manipulation': 'Minor price fluctuations detected - normal market behavior.',
    'stable': 'Seller maintains consistent pricing.',
    'insufficient_data': 'Not enough data to analyze seller behavior.'
  }
  return warnings[pattern] || pattern
}

export default AIDealAdvisor
