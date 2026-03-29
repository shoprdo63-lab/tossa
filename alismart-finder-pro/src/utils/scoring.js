/**
 * Golden Score Algorithm
 * Calculates comprehensive value-for-money score for products
 * Formula: Price (40%) + Reliability (30%) + Shipping Speed (20%) + Trust (10%)
 */

// Minimum thresholds for elite products
const ELITE_THRESHOLDS = {
  minRating: 4.0,        // Minimum product rating
  minSellerRating: 94,   // Minimum seller feedback percentage
  minStoreAge: 1,        // Minimum years active
  minOrders: 100         // Minimum orders for statistical significance
};

// Shipping speed tiers
const SHIPPING_SPEED_SCORES = {
  'aliexpress_standard': 10,   // AliExpress Standard Shipping
  'standard': 8,                 // Standard shipping
  'express': 9,                  // Express/DHL
  'free': 7,                     // Free shipping (slower)
  'unknown': 5,                  // Not specified
  'slow': 3                      // Slow/untracked
};

/**
 * Calculates the Golden Score for a product
 * @param {Object} product - Product data
 * @param {Object} sourceProduct - Source product for comparison
 * @returns {Object} Score breakdown and total
 */
export function calculateGoldenScore(product, sourceProduct = null) {
  const scores = {
    price: 0,
    reliability: 0,
    shipping: 0,
    trust: 0
  };
  
  // 1. Price Score (40%) - relative to source product or absolute
  const price = extractNumericPrice(product.price);
  const sourcePrice = sourceProduct ? extractNumericPrice(sourceProduct.price) : null;
  
  if (sourcePrice && sourcePrice > 0) {
    // Compare to source product
    const priceRatio = price / sourcePrice;
    if (priceRatio <= 0.5) scores.price = 40;      // 50% or less
    else if (priceRatio <= 0.7) scores.price = 35; // 30% cheaper
    else if (priceRatio <= 0.9) scores.price = 30; // 10% cheaper
    else if (priceRatio <= 1.0) scores.price = 25; // Same price
    else if (priceRatio <= 1.2) scores.price = 15; // 20% more
    else scores.price = 5;                          // Much more expensive
  } else {
    // Absolute price score (based on typical AliExpress ranges)
    if (price < 10) scores.price = 35;
    else if (price < 25) scores.price = 30;
    else if (price < 50) scores.price = 25;
    else if (price < 100) scores.price = 20;
    else scores.price = 15;
  }
  
  // 2. Reliability Score (30%) - seller metrics
  const sellerRating = product.sellerRating || product.storeRating || 0;
  const feedbackPercent = product.feedbackPercent || product.positiveFeedback || 0;
  const storeAge = product.storeAge || product.yearsActive || 0;
  const orders = product.orders || product.sales || 0;
  
  // Seller rating component (15 points max)
  if (sellerRating >= 4.9) scores.reliability += 15;
  else if (sellerRating >= 4.8) scores.reliability += 13;
  else if (sellerRating >= 4.7) scores.reliability += 11;
  else if (sellerRating >= 4.5) scores.reliability += 9;
  else if (sellerRating >= 4.0) scores.reliability += 6;
  else scores.reliability += 3;
  
  // Feedback percentage component (10 points max)
  if (feedbackPercent >= 98) scores.reliability += 10;
  else if (feedbackPercent >= 95) scores.reliability += 8;
  else if (feedbackPercent >= 94) scores.reliability += 6;
  else if (feedbackPercent >= 90) scores.reliability += 4;
  else scores.reliability += 2;
  
  // Store age component (5 points max)
  if (storeAge >= 5) scores.reliability += 5;
  else if (storeAge >= 3) scores.reliability += 4;
  else if (storeAge >= 2) scores.reliability += 3;
  else if (storeAge >= 1) scores.reliability += 2;
  else scores.reliability += 1;
  
  // 3. Shipping Speed Score (20%)
  const shippingType = detectShippingType(product.shipping || product.shippingMethod);
  scores.shipping = SHIPPING_SPEED_SCORES[shippingType] || 5;
  
  // Bonus for free shipping
  if (product.freeShipping || product.shipping === 'free' || product.shippingCost === 0) {
    scores.shipping += 2;
  }
  
  // 4. Trust Score (10%) - buyer protection and guarantees
  const hasProtection = product.buyerProtection || product.hasGuarantee || false;
  const hasReturn = product.freeReturn || product.returnPolicy || false;
  const isChoice = product.isChoice || product.choiceProduct || false;
  
  if (hasProtection && hasReturn && isChoice) scores.trust = 10;
  else if (hasProtection && hasReturn) scores.trust = 8;
  else if (hasProtection || hasReturn) scores.trust = 6;
  else if (isChoice) scores.trust = 7;
  else scores.trust = 3;
  
  // Calculate total (max 100)
  const total = scores.price + scores.reliability + scores.shipping + scores.trust;
  
  // Determine tier
  const tier = getScoreTier(total);
  
  // Calculate estimated delivery
  const deliveryDays = estimateDelivery(shippingType);
  
  // Calculate total landed cost
  const shippingCost = extractNumericPrice(product.shippingCost) || 0;
  const totalCost = price + shippingCost;
  
  return {
    total,
    scores,
    tier,
    deliveryDays,
    totalCost,
    meetsElite: checkEliteStatus(product),
    badges: generateBadges(product, scores, total)
  };
}

/**
 * Extracts numeric price from string or number
 * @param {string|number} priceValue
 * @returns {number}
 */
function extractNumericPrice(priceValue) {
  if (typeof priceValue === 'number') return priceValue;
  if (!priceValue) return 0;
  
  const match = String(priceValue).match(/[\d,.]+/);
  if (!match) return 0;
  
  return parseFloat(match[0].replace(',', '')) || 0;
}

/**
 * Detects shipping type from description
 * @param {string} shippingDesc
 * @returns {string}
 */
function detectShippingType(shippingDesc) {
  if (!shippingDesc) return 'unknown';
  
  const desc = String(shippingDesc).toLowerCase();
  
  if (desc.includes('aliexpress') && desc.includes('standard')) return 'aliexpress_standard';
  if (desc.includes('dhl') || desc.includes('fedex') || desc.includes('ups')) return 'express';
  if (desc.includes('free')) return 'free';
  if (desc.includes('standard')) return 'standard';
  if (desc.includes('slow') || desc.includes('untracked')) return 'slow';
  
  return 'unknown';
}

/**
 * Estimates delivery days based on shipping type
 * @param {string} shippingType
 * @returns {number}
 */
function estimateDelivery(shippingType) {
  const estimates = {
    'express': 7,
    'aliexpress_standard': 15,
    'standard': 20,
    'free': 25,
    'unknown': 25,
    'slow': 35
  };
  
  return estimates[shippingType] || 25;
}

/**
 * Gets tier based on total score
 * @param {number} total
 * @returns {Object}
 */
function getScoreTier(total) {
  if (total >= 85) {
    return { name: 'exceptional', label: 'Exceptional Value', color: '#00d084', priority: 1 };
  } else if (total >= 70) {
    return { name: 'excellent', label: 'Excellent Value', color: '#3b82f6', priority: 2 };
  } else if (total >= 55) {
    return { name: 'good', label: 'Good Value', color: '#f59e0b', priority: 3 };
  } else if (total >= 40) {
    return { name: 'fair', label: 'Fair Value', color: '#888', priority: 4 };
  } else {
    return { name: 'poor', label: 'Poor Value', color: '#ff4757', priority: 5 };
  }
}

/**
 * Checks if product meets elite thresholds
 * @param {Object} product
 * @returns {boolean}
 */
function checkEliteStatus(product) {
  const sellerRating = product.sellerRating || product.storeRating || 0;
  const feedbackPercent = product.feedbackPercent || product.positiveFeedback || 0;
  const storeAge = product.storeAge || product.yearsActive || 0;
  const rating = product.rating || product.productRating || 0;
  
  return (
    rating >= ELITE_THRESHOLDS.minRating &&
    feedbackPercent >= ELITE_THRESHOLDS.minSellerRating &&
    storeAge >= ELITE_THRESHOLDS.minStoreAge
  );
}

/**
 * Generates badges based on scores
 * @param {Object} product
 * @param {Object} scores
 * @param {number} total
 * @returns {Array}
 */
function generateBadges(product, scores, total) {
  const badges = [];
  
  // Price badges
  if (scores.price >= 35) {
    badges.push({ type: 'cheapest', label: 'Cheapest', icon: 'dollar', priority: 1 });
  } else if (scores.price >= 25) {
    badges.push({ type: 'good_price', label: 'Good Price', icon: 'tag', priority: 3 });
  }
  
  // Shipping badges
  if (scores.shipping >= 10) {
    badges.push({ type: 'fastest', label: 'Fastest Shipping', icon: 'truck', priority: 1 });
  } else if (product.freeShipping || product.shippingCost === 0) {
    badges.push({ type: 'free_shipping', label: 'Free Shipping', icon: 'package', priority: 2 });
  }
  
  // Reliability badges
  if (scores.reliability >= 25) {
    badges.push({ type: 'trusted', label: 'Most Trusted', icon: 'shield', priority: 1 });
  } else if (scores.reliability >= 20) {
    badges.push({ type: 'reliable', label: 'Reliable Seller', icon: 'check', priority: 3 });
  }
  
  // Choice badge
  if (product.isChoice || product.choiceProduct) {
    badges.push({ type: 'choice', label: 'Choice', icon: 'star', priority: 2 });
  }
  
  // Elite badge
  if (total >= 80 && checkEliteStatus(product)) {
    badges.push({ type: 'elite', label: 'Elite Pick', icon: 'crown', priority: 1 });
  }
  
  // Sort by priority
  return badges.sort((a, b) => a.priority - b.priority);
}

/**
 * Filters and sorts competitive products
 * @param {Array} products - Array of competitive products
 * @param {Object} sourceProduct - Source product
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered and sorted products
 */
export function filterAndSortCompetitors(products, sourceProduct, filters = {}) {
  // Calculate scores for all products
  const scored = products.map(product => ({
    ...product,
    analysis: calculateGoldenScore(product, sourceProduct)
  }));
  
  // Apply filters
  let filtered = scored;
  
  if (filters.freeShipping) {
    filtered = filtered.filter(p => p.freeShipping || p.shippingCost === 0 || p.analysis.scores.shipping >= 8);
  }
  
  if (filters.topRated) {
    filtered = filtered.filter(p => {
      const rating = p.sellerRating || p.storeRating || 0;
      return rating >= 4.8;
    });
  }
  
  if (filters.choiceOnly) {
    filtered = filtered.filter(p => p.isChoice || p.choiceProduct);
  }
  
  if (filters.eliteOnly) {
    filtered = filtered.filter(p => p.analysis.meetsElite);
  }
  
  // Sort by total score descending
  return filtered.sort((a, b) => b.analysis.total - a.analysis.total);
}

/**
 * Gets top competitors with analysis
 * @param {Array} products
 * @param {Object} sourceProduct
 * @param {number} limit
 * @returns {Array}
 */
export function getTopCompetitors(products, sourceProduct, limit = 5) {
  const sorted = filterAndSortCompetitors(products, sourceProduct);
  return sorted.slice(0, limit);
}

/**
 * Formats price difference for display
 * @param {number} currentPrice
 * @param {number} comparedPrice
 * @returns {Object}
 */
export function formatPriceDifference(currentPrice, comparedPrice) {
  const diff = comparedPrice - currentPrice;
  const percent = ((diff / currentPrice) * 100).toFixed(1);
  
  if (diff < 0) {
    return {
      text: `Save ${Math.abs(diff).toFixed(2)} (${Math.abs(percent)}%)`,
      type: 'cheaper',
      color: '#00d084'
    };
  } else if (diff > 0) {
    return {
      text: `+${diff.toFixed(2)} (+${percent}%)`,
      type: 'expensive',
      color: '#ff4757'
    };
  }
  
  return {
    text: 'Same price',
    type: 'same',
    color: '#888'
  };
}

console.log('🚀 AliSmart: Scoring Engine Loaded');
