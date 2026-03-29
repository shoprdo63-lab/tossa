/**
 * Risk Engine - Seller Integrity Analysis
 * Anti-fraud risk assessment algorithms for detecting suspicious seller behavior
 * Based on PayPal-style fraud detection patterns
 */

// Risk thresholds
const RISK_THRESHOLDS = {
  // Store age vs sales volume (weeks)
  NEW_STORE_MAX_AGE: 4, // 4 weeks = "new"
  SUSPICIOUS_SALES_RATIO: 1000, // >1000 sales per week for new store = suspicious
  HIGH_VOLUME_THRESHOLD: 5000, // >5000 sales in first month = likely scam
  
  // Review patterns
  REVIEW_BURST_THRESHOLD: 50, // >50 reviews in one week
  REVIEW_BURST_WINDOW: 7, // days
  
  // Price manipulation
  PRICE_HIKE_THRESHOLD: 0.20, // 20% price increase
  PRICE_HIKE_WINDOW: 7, // days before sale
  
  // Response rates
  GOOD_RESPONSE_RATE: 0.90, // 90%+
  BAD_RESPONSE_RATE: 0.50, // below 50%
  
  // Feedback quality
  MIN_FEEDBACK_PERCENT: 94, // Elite threshold from comparison matrix
  SUSPICIOUS_FEEDBACK_JUMP: 15 // 15% jump in short time
}

// Risk scoring weights
const RISK_WEIGHTS = {
  ageVolumeMismatch: 30,      // Young store with huge volume
  reviewBurst: 25,            // Sudden review spike
  priceManipulation: 20,      // Price hiking before sales
  lowResponseRate: 15,        // Poor communication
  feedbackAnomaly: 10       // Suspicious feedback patterns
}

/**
 * Analyzes seller integrity and assigns risk scores
 * @param {Object} sellerData - Raw seller data from APIs
 * @param {Object} historicalData - Historical performance data
 * @returns {Object} Complete risk assessment
 */
export function analyzeSellerIntegrity(sellerData, historicalData = {}) {
  const riskFactors = []
  const warnings = []
  const positives = []
  let riskScore = 0 // 0-100, higher = more risky
  
  // 1. Store Age vs Sales Volume Analysis
  const storeAge = sellerData.storeAge || sellerData.yearsActive || 0
  const totalSales = sellerData.orders || sellerData.sales || 0
  const salesPerWeek = storeAge > 0 ? totalSales / (storeAge * 52) : totalSales
  
  if (storeAge < RISK_THRESHOLDS.NEW_STORE_MAX_AGE / 52) {
    // New store (less than 4 weeks)
    if (totalSales > RISK_THRESHOLDS.HIGH_VOLUME_THRESHOLD) {
      // Ghost store pattern: new store with massive sales
      riskFactors.push({
        type: 'ghost_store',
        severity: 'high',
        title: 'Potential Ghost Store',
        description: `Store opened ${Math.ceil(storeAge * 52)} weeks ago with ${totalSales.toLocaleString()} sales`,
        score: RISK_WEIGHTS.ageVolumeMismatch
      })
      riskScore += RISK_WEIGHTS.ageVolumeMismatch
    } else if (totalSales > RISK_THRESHOLDS.SUSPICIOUS_SALES_RATIO * storeAge * 52) {
      // Suspicious volume for age
      riskFactors.push({
        type: 'volume_anomaly',
        severity: 'medium',
        title: 'Unusual Sales Volume',
        description: 'High sales volume for a new store',
        score: RISK_WEIGHTS.ageVolumeMismatch * 0.6
      })
      riskScore += RISK_WEIGHTS.ageVolumeMismatch * 0.6
    } else {
      // Legitimate new store
      positives.push({
        type: 'emerging',
        title: 'Emerging Store',
        description: 'New store with normal growth pattern'
      })
    }
  }
  
  // 2. Review Pattern Analysis
  const reviews = historicalData.reviews || []
  const reviewDates = reviews.map(r => new Date(r.date)).sort((a, b) => a - b)
  
  if (reviewDates.length > 0) {
    // Check for review bursts
    const reviewBursts = detectReviewBursts(reviewDates)
    if (reviewBursts.length > 0) {
      riskFactors.push({
        type: 'review_burst',
        severity: 'high',
        title: 'Suspicious Review Pattern',
        description: `${reviewBursts[0].count} reviews in one week (possible bots)`,
        score: RISK_WEIGHTS.reviewBurst
      })
      riskScore += RISK_WEIGHTS.reviewBurst
    }
    
    // Check review recency distribution
    const recentReviews = reviews.filter(r => {
      const daysAgo = (Date.now() - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24)
      return daysAgo <= 30
    })
    
    if (reviews.length > 100 && recentReviews.length / reviews.length < 0.05) {
      // Very few recent reviews compared to total
      warnings.push({
        type: 'stale_reviews',
        title: 'Stale Review Activity',
        description: 'Few recent reviews compared to historical volume'
      })
    }
  }
  
  // 3. Price Manipulation Detection
  const priceHistory = historicalData.priceHistory || []
  if (priceHistory.length >= 2) {
    const recentPrices = priceHistory.slice(-RISK_THRESHOLDS.PRICE_HIKE_WINDOW)
    const oldestRecent = recentPrices[0]
    const newestRecent = recentPrices[recentPrices.length - 1]
    
    if (oldestRecent && newestRecent) {
      const priceChange = (newestRecent.price - oldestRecent.price) / oldestRecent.price
      
      if (priceChange > RISK_THRESHOLDS.PRICE_HIKE_THRESHOLD) {
        // Significant price hike - preparing for fake "sale"
        riskFactors.push({
          type: 'price_manipulation',
          severity: 'medium',
          title: 'Price Manipulation Detected',
          description: `Seller raised price by ${(priceChange * 100).toFixed(0)}% recently`,
          score: RISK_WEIGHTS.priceManipulation,
          details: {
            oldPrice: oldestRecent.price,
            newPrice: newestRecent.price,
            percentChange: priceChange * 100
          }
        })
        riskScore += RISK_WEIGHTS.priceManipulation
      } else if (priceChange < -0.10) {
        // Genuine price drop
        positives.push({
          type: 'fair_pricing',
          title: 'Genuine Price Reduction',
          description: 'Recent price decrease without manipulation'
        })
      }
    }
  }
  
  // 4. Communication Quality (Response Rate)
  const responseRate = sellerData.responseRate || sellerData.replyRate || 0
  if (responseRate > 0) {
    if (responseRate < RISK_THRESHOLDS.BAD_RESPONSE_RATE) {
      riskFactors.push({
        type: 'poor_communication',
        severity: 'medium',
        title: 'Slow Communication',
        description: `Only ${(responseRate * 100).toFixed(0)}% response rate`,
        score: RISK_WEIGHTS.lowResponseRate
      })
      riskScore += RISK_WEIGHTS.lowResponseRate
    } else if (responseRate > RISK_THRESHOLDS.GOOD_RESPONSE_RATE) {
      positives.push({
        type: 'responsive',
        title: 'Highly Responsive',
        description: `${(responseRate * 100).toFixed(0)}% response rate`
      })
    }
  }
  
  // 5. Feedback Quality Analysis
  const feedbackPercent = sellerData.feedbackPercent || sellerData.positiveFeedback || 0
  const rating = sellerData.rating || sellerData.storeRating || 0
  
  if (feedbackPercent < RISK_THRESHOLDS.MIN_FEEDBACK_PERCENT) {
    if (feedbackPercent < 90) {
      riskFactors.push({
        type: 'low_feedback',
        severity: 'high',
        title: 'Poor Feedback Score',
        description: `Only ${feedbackPercent}% positive feedback`,
        score: RISK_WEIGHTS.feedbackAnomaly * 1.5
      })
      riskScore += RISK_WEIGHTS.feedbackAnomaly * 1.5
    } else {
      warnings.push({
        type: 'below_elite',
        title: 'Below Elite Threshold',
        description: `${feedbackPercent}% feedback (below ${RISK_THRESHOLDS.MIN_FEEDBACK_PERCENT}% elite standard)`
      })
    }
  }
  
  // 6. Calculate Trust Score (inverse of risk)
  const trustScore = Math.max(0, 100 - riskScore)
  
  // 7. Determine Status Badge
  let statusBadge = calculateStatusBadge(riskScore, storeAge, feedbackPercent, totalSales)
  
  // 8. Category Comparison
  const categoryComparison = calculateCategoryComparison(sellerData, historicalData.categoryAvg)
  
  return {
    riskScore,
    trustScore,
    statusBadge,
    riskFactors,
    warnings,
    positives,
    categoryComparison,
    metrics: {
      storeAgeWeeks: Math.ceil(storeAge * 52),
      totalSales,
      salesPerWeek: Math.ceil(salesPerWeek),
      feedbackPercent,
      responseRate,
      rating
    },
    recommendation: generateRecommendation(riskScore, riskFactors)
  }
}

/**
 * Detects bursts of reviews (possible bot activity)
 * @param {Array} reviewDates - Array of review date objects
 * @returns {Array} Detected bursts
 */
function detectReviewBursts(reviewDates) {
  const bursts = []
  const windowMs = RISK_THRESHOLDS.REVIEW_BURST_WINDOW * 24 * 60 * 60 * 1000
  
  for (let i = 0; i < reviewDates.length; i++) {
    const windowStart = reviewDates[i]
    const windowEnd = new Date(windowStart.getTime() + windowMs)
    
    const reviewsInWindow = reviewDates.filter(d => d >= windowStart && d <= windowEnd)
    
    if (reviewsInWindow.length > RISK_THRESHOLDS.REVIEW_BURST_THRESHOLD) {
      bursts.push({
        startDate: windowStart,
        count: reviewsInWindow.length
      })
    }
  }
  
  // Return unique bursts (de-duplicate overlapping windows)
  return bursts.filter((burst, index, self) => 
    index === self.findIndex(b => Math.abs(b.startDate - burst.startDate) < windowMs)
  )
}

/**
 * Calculates status badge based on risk metrics
 * @param {number} riskScore - 0-100 risk score
 * @param {number} storeAge - Years
 * @param {number} feedbackPercent - Positive feedback %
 * @param {number} totalSales - Total orders
 * @returns {Object} Badge info
 */
function calculateStatusBadge(riskScore, storeAge, feedbackPercent, totalSales) {
  // Elite store criteria
  if (riskScore < 15 && storeAge >= 2 && feedbackPercent >= 97 && totalSales > 5000) {
    return {
      type: 'elite',
      label: 'Elite Store',
      color: '#ffd700',
      icon: 'crown'
    }
  }
  
  // Trusted store
  if (riskScore < 25 && storeAge >= 1 && feedbackPercent >= 94) {
    return {
      type: 'trusted',
      label: 'Trusted Merchant',
      color: '#00d084',
      icon: 'shield'
    }
  }
  
  // Emerging store (new but good)
  if (storeAge < 0.5 && riskScore < 30 && feedbackPercent >= 90) {
    return {
      type: 'emerging',
      label: 'Emerging Store',
      color: '#3b82f6',
      icon: 'trending-up'
    }
  }
  
  // Warning levels
  if (riskScore > 60) {
    return {
      type: 'danger',
      label: 'High Risk',
      color: '#ff4757',
      icon: 'alert-triangle'
    }
  }
  
  if (riskScore > 40) {
    return {
      type: 'warning',
      label: 'Caution Advised',
      color: '#f59e0b',
      icon: 'alert-circle'
    }
  }
  
  // Default
  return {
    type: 'standard',
    label: 'Standard Store',
    color: '#888',
    icon: 'store'
  }
}

/**
 * Compares seller to category averages
 * @param {Object} sellerData - Seller metrics
 * @param {Object} categoryAvg - Category averages
 * @returns {Object} Comparison results
 */
function calculateCategoryComparison(sellerData, categoryAvg = {}) {
  const comparisons = []
  
  // Shipping speed comparison
  if (sellerData.shippingDays && categoryAvg.shippingDays) {
    const diff = sellerData.shippingDays - categoryAvg.shippingDays
    if (diff > 2) {
      comparisons.push({
        metric: 'shipping_speed',
        label: 'Shipping Speed',
        sellerValue: sellerData.shippingDays,
        avgValue: categoryAvg.shippingDays,
        difference: diff,
        status: 'slower',
        message: `Ships ${diff} days slower than category average`
      })
    } else if (diff < -1) {
      comparisons.push({
        metric: 'shipping_speed',
        label: 'Shipping Speed',
        sellerValue: sellerData.shippingDays,
        avgValue: categoryAvg.shippingDays,
        difference: Math.abs(diff),
        status: 'faster',
        message: `Ships ${Math.abs(diff)} days faster than category average`
      })
    }
  }
  
  // Response rate comparison
  if (sellerData.responseRate && categoryAvg.responseRate) {
    const diff = sellerData.responseRate - categoryAvg.responseRate
    if (diff < -0.15) {
      comparisons.push({
        metric: 'response_rate',
        label: 'Response Rate',
        sellerValue: (sellerData.responseRate * 100).toFixed(0),
        avgValue: (categoryAvg.responseRate * 100).toFixed(0),
        difference: Math.abs(diff * 100).toFixed(0),
        status: 'worse',
        message: `Responds ${(Math.abs(diff) * 100).toFixed(0)}% less than average`
      })
    }
  }
  
  // Price comparison
  if (sellerData.avgPrice && categoryAvg.avgPrice) {
    const diff = (sellerData.avgPrice - categoryAvg.avgPrice) / categoryAvg.avgPrice
    if (diff > 0.15) {
      comparisons.push({
        metric: 'pricing',
        label: 'Pricing',
        sellerValue: sellerData.avgPrice,
        avgValue: categoryAvg.avgPrice,
        difference: (diff * 100).toFixed(0),
        status: 'higher',
        message: `Prices ${(diff * 100).toFixed(0)}% above category average`
      })
    } else if (diff < -0.10) {
      comparisons.push({
        metric: 'pricing',
        label: 'Pricing',
        sellerValue: sellerData.avgPrice,
        avgValue: categoryAvg.avgPrice,
        difference: (Math.abs(diff) * 100).toFixed(0),
        status: 'lower',
        message: `Prices ${(Math.abs(diff) * 100).toFixed(0)}% below category average`
      })
    }
  }
  
  return comparisons
}

/**
 * Generates recommendation text
 * @param {number} riskScore - Risk score
 * @param {Array} riskFactors - Risk factors
 * @returns {string} Recommendation
 */
function generateRecommendation(riskScore, riskFactors) {
  if (riskScore > 60) {
    return 'Avoid this seller. Multiple high-risk indicators detected.'
  }
  if (riskScore > 40) {
    return 'Proceed with caution. Review risk factors before purchasing.'
  }
  if (riskScore > 20) {
    return 'Generally reliable but check specific warnings.'
  }
  return 'Safe to purchase. Seller shows strong trust indicators.'
}

/**
 * Validates if tracking number looks legitimate
 * @param {string} trackingNumber - Tracking code
 * @param {string} carrier - Shipping carrier
 * @returns {Object} Validation result
 */
export function validateTrackingNumber(trackingNumber, carrier) {
  if (!trackingNumber) {
    return { valid: false, reason: 'No tracking provided' }
  }
  
  // Common fake tracking patterns
  const suspiciousPatterns = [
    /^000000/,           // Leading zeros
    /^111111/,           // Repeating digits
    /^(\d)\1{5,}/,      // Same digit repeated
    /^[A-Z]\d{3}$/       // Too short for international
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trackingNumber)) {
      return {
        valid: false,
        reason: 'Suspicious tracking pattern detected',
        flags: ['potentially_fake']
      }
    }
  }
  
  // Carrier-specific validation
  const carrierFormats = {
    'aliexpress_standard': /^[A-Z]{2}\d{9}[A-Z]{2}$/,
    'dhl': /^\d{10,12}$/,
    'fedex': /^\d{12,15}$/,
    'ups': /^1Z[A-Z0-9]{16}$/,
    'china_post': /^[A-Z]{2}\d{9}[A-Z]{2}$/
  }
  
  const format = carrierFormats[carrier?.toLowerCase()]
  if (format && !format.test(trackingNumber)) {
    return {
      valid: false,
      reason: `Invalid format for ${carrier}`,
      flags: ['format_mismatch']
    }
  }
  
  return { valid: true }
}

/**
 * Detects if seller has fake review patterns
 * @param {Array} reviews - Review objects
 * @returns {Object} Analysis result
 */
export function detectFakeReviews(reviews) {
  if (!reviews || reviews.length < 10) {
    return { suspicious: false, reason: 'Insufficient review data' }
  }
  
  const flags = []
  
  // Check for repetitive language
  const texts = reviews.map(r => r.content?.toLowerCase() || '')
  const duplicates = texts.filter((item, index) => texts.indexOf(item) !== index)
  if (duplicates.length > texts.length * 0.1) {
    flags.push('duplicate_content')
  }
  
  // Check for all 5-star reviews with similar timing
  const fiveStarReviews = reviews.filter(r => r.rating === 5)
  if (fiveStarReviews.length / reviews.length > 0.95) {
    flags.push('suspiciously_high_rating')
  }
  
  // Check review text length (fake reviews often very short or very long)
  const avgLength = texts.reduce((sum, t) => sum + t.length, 0) / texts.length
  if (avgLength < 20 || avgLength > 500) {
    flags.push('abnormal_review_length')
  }
  
  return {
    suspicious: flags.length > 0,
    flags,
    confidence: flags.length >= 2 ? 'high' : 'medium'
  }
}

console.log('🛡️ AliSmart: Risk Engine Loaded');
