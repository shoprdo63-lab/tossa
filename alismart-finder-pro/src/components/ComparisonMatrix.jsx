import { useState, useEffect, useMemo } from 'react'
import { calculateGoldenScore, filterAndSortCompetitors, formatPriceDifference } from '../utils/scoring.js'
import './ComparisonMatrix.css'

/**
 * ComparisonMatrix Component
 * Displays top 5 competitors with Golden Score, filtering, and one-click deal links
 * World Class Performance - Skeletal loading, instant filtering
 */
function ComparisonMatrix({ sourceProduct, competitors = [], isLoading = false, onSelectDeal }) {
  const [activeFilters, setActiveFilters] = useState({
    freeShipping: false,
    topRated: false,
    choiceOnly: false,
    eliteOnly: false
  })
  const [expandedRow, setExpandedRow] = useState(null)

  // Process competitors with scoring
  const processedCompetitors = useMemo(() => {
    if (!competitors.length || !sourceProduct) return []
    
    return filterAndSortCompetitors(competitors, sourceProduct, activeFilters)
      .slice(0, 5)
      .map((competitor, index) => ({
        ...competitor,
        rank: index + 1
      }))
  }, [competitors, sourceProduct, activeFilters])

  // Toggle filter
  const toggleFilter = (filterKey) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }))
  }

  // Handle go to deal
  const handleGoToDeal = (competitor) => {
    const url = competitor.productUrl || competitor.url || competitor.link
    if (url) {
      // Add affiliate ID if available
      const affiliateUrl = appendAffiliateId(url)
      window.open(affiliateUrl, '_blank', 'noopener,noreferrer')
    }
    if (onSelectDeal) {
      onSelectDeal(competitor)
    }
  }

  // Append affiliate ID to URL
  const appendAffiliateId = (url) => {
    // This would be configured with actual affiliate ID
    const affiliateId = 'alismart2024'
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}aff=${affiliateId}`
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="comparison-matrix loading">
        <div className="matrix-header-skeleton">
          <div className="skeleton-title"></div>
          <div className="skeleton-chips">
            <div className="skeleton-chip"></div>
            <div className="skeleton-chip"></div>
            <div className="skeleton-chip"></div>
          </div>
        </div>
        <div className="matrix-table-skeleton">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-cell rank"></div>
              <div className="skeleton-cell product">
                <div className="skeleton-image"></div>
                <div className="skeleton-text">
                  <div className="skeleton-line short"></div>
                  <div className="skeleton-line long"></div>
                </div>
              </div>
              <div className="skeleton-cell price">
                <div className="skeleton-line"></div>
                <div className="skeleton-line short"></div>
              </div>
              <div className="skeleton-cell score">
                <div className="skeleton-circle"></div>
              </div>
              <div className="skeleton-cell action"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (!processedCompetitors.length) {
    return (
      <div className="comparison-matrix empty">
        <div className="matrix-empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <h3>Better Deals Found</h3>
          <p>Browse AliExpress products to see competitive alternatives ranked by value</p>
        </div>
      </div>
    )
  }

  return (
    <div className="comparison-matrix">
      {/* Header */}
      <div className="matrix-header">
        <h3 className="matrix-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20v-6M6 20V10M18 20V4"></path>
          </svg>
          Competitive Matrix
          <span className="matrix-count">{processedCompetitors.length} found</span>
        </h3>
      </div>

      {/* Filter Chips - Pro Filters */}
      <div className="filter-chips">
        <button
          className={`filter-chip ${activeFilters.freeShipping ? 'active' : ''}`}
          onClick={() => toggleFilter('freeShipping')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
          </svg>
          Free Shipping
        </button>
        <button
          className={`filter-chip ${activeFilters.topRated ? 'active' : ''}`}
          onClick={() => toggleFilter('topRated')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          Top Rated 4.8+
        </button>
        <button
          className={`filter-chip ${activeFilters.choiceOnly ? 'active' : ''}`}
          onClick={() => toggleFilter('choiceOnly')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 12l2 2 4-4"></path>
          </svg>
          Choice Only
        </button>
        <button
          className={`filter-chip ${activeFilters.eliteOnly ? 'active' : ''}`}
          onClick={() => toggleFilter('eliteOnly')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm11 16h-2"></path>
          </svg>
          Elite Only
        </button>
      </div>

      {/* Comparison Table */}
      <div className="matrix-table">
        {/* Table Header */}
        <div className="table-header">
          <div className="th rank">#</div>
          <div className="th product">Product</div>
          <div className="th price">Price</div>
          <div className="th shipping">Delivery</div>
          <div className="th score">Value Score</div>
          <div className="th action"></div>
        </div>

        {/* Table Body */}
        {processedCompetitors.map((competitor, index) => {
          const analysis = competitor.analysis || calculateGoldenScore(competitor, sourceProduct)
          const priceDiff = formatPriceDifference(
            extractNumericPrice(sourceProduct?.price),
            analysis.totalCost
          )
          const isExpanded = expandedRow === competitor.productId

          return (
            <div 
              key={competitor.productId || index}
              className={`matrix-row ${analysis.tier.name} ${isExpanded ? 'expanded' : ''}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Rank */}
              <div className="td rank">
                <span className={`rank-badge rank-${competitor.rank}`}>{competitor.rank}</span>
              </div>

              {/* Product */}
              <div className="td product">
                <div className="product-image">
                  <img 
                    src={competitor.imageUrl || competitor.img} 
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                </div>
                <div className="product-info">
                  <h4 className="product-title">
                    {(competitor.title || competitor.productTitle || 'Product').substring(0, 45)}
                    {(competitor.title || competitor.productTitle || '').length > 45 ? '...' : ''}
                  </h4>
                  
                  {/* Badges */}
                  <div className="product-badges">
                    {analysis.badges.slice(0, 2).map((badge, idx) => (
                      <span 
                        key={idx} 
                        className={`badge ${badge.type}`}
                        style={{ 
                          backgroundColor: `${getBadgeColor(badge.type)}20`,
                          color: getBadgeColor(badge.type),
                          borderColor: `${getBadgeColor(badge.type)}40`
                        }}
                      >
                        <BadgeIcon type={badge.icon} />
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="td price">
                <div className="price-current">
                  ${analysis.totalCost.toFixed(2)}
                </div>
                <div className="price-diff" style={{ color: priceDiff.color }}>
                  {priceDiff.text}
                </div>
                {competitor.originalPrice && (
                  <div className="price-original">
                    was ${extractNumericPrice(competitor.originalPrice).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Delivery */}
              <div className="td shipping">
                <div className="delivery-days">
                  {analysis.deliveryDays} days
                </div>
                <div className="shipping-type">
                  {competitor.shipping || 'Standard'}
                </div>
              </div>

              {/* Golden Score */}
              <div className="td score">
                <div className="score-circle" style={{ 
                  background: `conic-gradient(${analysis.tier.color} ${analysis.total * 3.6}deg, transparent 0)` 
                }}>
                  <div className="score-inner">
                    <span className="score-value" style={{ color: analysis.tier.color }}>
                      {analysis.total}
                    </span>
                    <span className="score-max">/100</span>
                  </div>
                </div>
                <span className="tier-label" style={{ color: analysis.tier.color }}>
                  {analysis.tier.label}
                </span>
              </div>

              {/* Action */}
              <div className="td action">
                <button 
                  className="go-deal-btn"
                  onClick={() => handleGoToDeal(competitor)}
                >
                  <span>Go to Deal</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 17L17 7M17 7H7M17 7V17"></path>
                  </svg>
                </button>
                <button 
                  className="expand-btn"
                  onClick={() => setExpandedRow(isExpanded ? null : competitor.productId)}
                >
                  <svg className={isExpanded ? 'expanded' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="expanded-details">
                  <div className="score-breakdown">
                    <div className="score-item">
                      <span className="score-label">Price</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(analysis.scores.price / 40) * 100}%` }}></div>
                      </div>
                      <span className="score-num">{analysis.scores.price}/40</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Reliability</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(analysis.scores.reliability / 30) * 100}%` }}></div>
                      </div>
                      <span className="score-num">{analysis.scores.reliability}/30</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Shipping</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(analysis.scores.shipping / 20) * 100}%` }}></div>
                      </div>
                      <span className="score-num">{analysis.scores.shipping}/20</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Trust</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(analysis.scores.trust / 10) * 100}%` }}></div>
                      </div>
                      <span className="score-num">{analysis.scores.trust}/10</span>
                    </div>
                  </div>
                  
                  <div className="seller-details">
                    <div className="seller-row">
                      <span>Seller Rating:</span>
                      <strong>{(competitor.sellerRating || competitor.storeRating || 0).toFixed(1)} ⭐</strong>
                    </div>
                    <div className="seller-row">
                      <span>Feedback:</span>
                      <strong>{competitor.feedbackPercent || competitor.positiveFeedback || 0}% positive</strong>
                    </div>
                    <div className="seller-row">
                      <span>Store Age:</span>
                      <strong>{competitor.storeAge || competitor.yearsActive || 0} years</strong>
                    </div>
                    <div className="seller-row">
                      <span>Orders:</span>
                      <strong>{(competitor.orders || competitor.sales || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary Footer */}
      <div className="matrix-footer">
        <p>Showing top {processedCompetitors.length} elite competitors based on Golden Score algorithm</p>
      </div>
    </div>
  )
}

/**
 * Badge icon component
 */
function BadgeIcon({ type }) {
  const icons = {
    dollar: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>,
    tag: <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>,
    truck: <><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></>,
    package: <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>,
    check: <polyline points="20 6 9 17 4 12"></polyline>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>,
    crown: <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm11 16h-2"></path>
  }
  
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {icons[type] || icons.check}
    </svg>
  )
}

/**
 * Gets badge color based on type
 */
function getBadgeColor(type) {
  const colors = {
    cheapest: '#00d084',
    good_price: '#3b82f6',
    fastest: '#ff6a00',
    free_shipping: '#00d084',
    trusted: '#ffd700',
    reliable: '#3b82f6',
    choice: '#ff6a00',
    elite: '#ffd700'
  }
  return colors[type] || '#888'
}

/**
 * Extracts numeric price
 */
function extractNumericPrice(priceValue) {
  if (typeof priceValue === 'number') return priceValue
  if (!priceValue) return 0
  const match = String(priceValue).match(/[\d,.]+/)
  return match ? parseFloat(match[0].replace(',', '')) || 0 : 0
}

export default ComparisonMatrix
