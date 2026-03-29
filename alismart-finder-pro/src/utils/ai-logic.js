/**
 * AI Price Prediction Logic
 * Analyzes seller behavior, price history, and upcoming sales to provide deal scores
 */

// Major AliExpress sales events throughout the year
const ALIEXPRESS_SALES_CALENDAR = [
  { name: '11.11 Global Shopping Festival', month: 10, day: 11, daysBefore: 7 },
  { name: 'Choice Day', month: 0, day: 1, daysBefore: 5, recurring: 'monthly' },
  { name: 'Summer Sale', month: 6, day: 15, daysBefore: 7 },
  { name: 'Back to School', month: 7, day: 20, daysBefore: 7 },
  { name: 'Black Friday', month: 10, day: 25, daysBefore: 7 },
  { name: 'Cyber Monday', month: 10, day: 28, daysBefore: 5 },
  { name: 'Spring Sale', month: 2, day: 15, daysBefore: 7 },
  { name: 'Anniversary Sale', month: 2, day: 28, daysBefore: 10 }
];

/**
 * Gets upcoming sales events within the next N days
 * @param {number} daysWindow - Number of days to look ahead
 * @returns {Array} Upcoming sales events
 */
export function getUpcomingSales(daysWindow = 14) {
  const now = new Date();
  const upcoming = [];
  
  for (const sale of ALIEXPRESS_SALES_CALENDAR) {
    const saleDate = new Date(now.getFullYear(), sale.month, sale.day);
    
    // Handle recurring events (like monthly Choice Day)
    if (sale.recurring === 'monthly') {
      // Check if there's one this month
      if (saleDate >= now && saleDate <= new Date(now.getTime() + daysWindow * 24 * 60 * 60 * 1000)) {
        upcoming.push({ ...sale, date: saleDate, daysUntil: Math.ceil((saleDate - now) / (24 * 60 * 60 * 1000)) });
      }
      // Check next month
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, sale.day);
      if (nextMonthDate <= new Date(now.getTime() + daysWindow * 24 * 60 * 60 * 1000)) {
        upcoming.push({ ...sale, date: nextMonthDate, daysUntil: Math.ceil((nextMonthDate - now) / (24 * 60 * 60 * 1000)) });
      }
    } else {
      // Annual events - check this year and next year
      const checkDates = [saleDate];
      if (saleDate < now) {
        checkDates.push(new Date(now.getFullYear() + 1, sale.month, sale.day));
      }
      
      for (const date of checkDates) {
        const daysUntil = Math.ceil((date - now) / (24 * 60 * 60 * 1000));
        if (daysUntil <= daysWindow && daysUntil >= 0) {
          upcoming.push({ ...sale, date, daysUntil });
        }
      }
    }
  }
  
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Calculates price statistics from history
 * @param {Array} priceHistory - Array of {date, price} objects
 * @returns {Object} Statistics object
 */
export function calculatePriceStats(priceHistory) {
  if (!priceHistory || priceHistory.length === 0) {
    return null;
  }
  
  const prices = priceHistory.map(h => h.price).sort((a, b) => a - b);
  const count = prices.length;
  
  const avg = prices.reduce((sum, p) => sum + p, 0) / count;
  const min = prices[0];
  const max = prices[count - 1];
  
  // Calculate standard deviation
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  
  // Calculate median
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
  
  // Current vs average
  const current = prices[count - 1];
  const vsAverage = ((current - avg) / avg) * 100;
  const vsMin = ((current - min) / min) * 100;
  const vsMax = ((current - max) / max) * 100;
  
  // Volatility (coefficient of variation)
  const volatility = (stdDev / avg) * 100;
  
  return {
    current,
    average: avg,
    min,
    max,
    median,
    stdDev,
    volatility,
    vsAverage,
    vsMin,
    vsMax,
    sampleSize: count
  };
}

/**
 * Detects if seller inflates prices before sales
 * @param {Array} priceHistory - Price history data
 * @param {Array} salesHistory - Known past sale dates and prices
 * @returns {Object} Price manipulation analysis
 */
export function detectPriceManipulation(priceHistory, salesHistory) {
  if (!priceHistory || priceHistory.length < 30) {
    return { pattern: 'insufficient_data', score: 0 };
  }
  
  // Sort by date
  const sorted = [...priceHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Look for patterns of price increases followed by drops
  let manipulationScore = 0;
  let spikeCount = 0;
  
  for (let i = 5; i < sorted.length; i++) {
    const window = sorted.slice(i - 5, i + 1);
    const prices = window.map(h => h.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Detect spike (price > 15% above average of previous 5)
    if (prices[5] > prices.slice(0, 5).reduce((a, b) => a + b, 0) / 5 * 1.15) {
      spikeCount++;
    }
  }
  
  // More spikes = more likely manipulation
  const spikeRate = spikeCount / (sorted.length - 5);
  
  if (spikeRate > 0.3) {
    return { pattern: 'high_manipulation', score: -25, spikeRate };
  } else if (spikeRate > 0.15) {
    return { pattern: 'moderate_manipulation', score: -15, spikeRate };
  } else if (spikeRate > 0.05) {
    return { pattern: 'low_manipulation', score: -5, spikeRate };
  }
  
  return { pattern: 'stable', score: 10, spikeRate };
}

/**
 * Main prediction engine - calculates deal score
 * @param {Object} productData - Current product data
 * @param {Array} priceHistory - Historical prices
 * @param {Object} sellerData - Seller information
 * @param {number} shippingCost - Shipping cost
 * @returns {Object} Prediction result with deal score
 */
export function predictPriceTrend(productData, priceHistory, sellerData, shippingCost = 0) {
  const stats = calculatePriceStats(priceHistory);
  const upcomingSales = getUpcomingSales(14);
  const manipulation = detectPriceManipulation(priceHistory, []);
  
  let score = 50; // Start neutral
  let reasons = [];
  let recommendation = 'neutral';
  
  if (!stats) {
    return {
      score: 50,
      recommendation: 'neutral',
      reasons: ['insufficient_history'],
      verdict: 'Wait for more price data',
      confidence: 'low'
    };
  }
  
  // Score adjustments based on current price position
  if (stats.vsAverage > 20) {
    score -= 20;
    reasons.push('price_above_average');
  } else if (stats.vsAverage > 10) {
    score -= 10;
    reasons.push('price_slightly_above_average');
  } else if (stats.vsAverage < -10) {
    score += 15;
    reasons.push('price_below_average');
  } else if (stats.vsAverage < -20) {
    score += 25;
    reasons.push('price_well_below_average');
  }
  
  // Check if at all-time low
  if (stats.vsMin < 5) {
    score += 20;
    reasons.push('near_all_time_low');
  }
  
  // Check if at all-time high
  if (stats.vsMax > -5) {
    score -= 20;
    reasons.push('near_all_time_high');
  }
  
  // Upcoming sales impact
  if (upcomingSales.length > 0) {
    const nextSale = upcomingSales[0];
    if (nextSale.daysUntil <= 7) {
      score -= 15;
      reasons.push('sale_approaching');
    } else if (nextSale.daysUntil <= 3) {
      score -= 25;
      reasons.push('sale_imminent');
    }
  }
  
  // Price manipulation factor
  score += manipulation.score;
  if (manipulation.pattern !== 'stable' && manipulation.pattern !== 'insufficient_data') {
    reasons.push(manipulation.pattern);
  }
  
  // Volatility factor
  if (stats.volatility > 30) {
    score -= 5;
    reasons.push('high_volatility');
  } else if (stats.volatility < 10) {
    score += 5;
    reasons.push('stable_price');
  }
  
  // Shipping cost consideration
  const totalCost = stats.current + shippingCost;
  const shippingRatio = shippingCost / totalCost;
  if (shippingRatio > 0.3) {
    score -= 10;
    reasons.push('high_shipping_impact');
  }
  
  // Clamp score to 1-100
  score = Math.max(1, Math.min(100, score));
  
  // Determine recommendation
  if (score >= 90) {
    recommendation = 'buy_now';
  } else if (score >= 70) {
    recommendation = 'good_deal';
  } else if (score >= 50) {
    recommendation = 'fair_price';
  } else if (score >= 30) {
    recommendation = 'wait';
  } else {
    recommendation = 'strong_wait';
  }
  
  // Generate expert verdict text
  let verdict = generateVerdict(score, stats, upcomingSales, reasons);
  
  // Calculate confidence based on data quality
  let confidence = 'medium';
  if (stats.sampleSize >= 60 && stats.volatility < 20) {
    confidence = 'high';
  } else if (stats.sampleSize < 14 || stats.volatility > 50) {
    confidence = 'low';
  }
  
  return {
    score,
    recommendation,
    reasons,
    verdict,
    confidence,
    stats,
    upcomingSales: upcomingSales.slice(0, 3),
    manipulation,
    savingsPotential: stats.current - stats.min,
    estimatedDrop: score < 40 ? Math.abs(stats.vsAverage) * 0.6 : 0
  };
}

/**
 * Generates human-readable verdict text
 * @param {number} score - Deal score
 * @param {Object} stats - Price statistics
 * @param {Array} upcomingSales - Upcoming sales
 * @param {Array} reasons - Analysis reasons
 * @returns {string} Verdict text
 */
function generateVerdict(score, stats, upcomingSales, reasons) {
  if (score >= 90) {
    return 'Golden Deal! Price is at or near all-time low. Buy now!';
  } else if (score >= 70) {
    return `Good deal - ${Math.abs(stats.vsAverage).toFixed(0)}% below average price.`;
  } else if (score >= 50) {
    return 'Fair price - close to historical average.';
  } else if (score >= 30) {
    if (upcomingSales.length > 0) {
      return `Wait ${upcomingSales[0].daysUntil} days for ${upcomingSales[0].name}. Similar items typically drop 15-25% during sales.`;
    }
    return 'Consider waiting - price may drop soon based on historical patterns.';
  } else {
    if (stats.vsAverage > 20) {
      return `Overpriced by ${stats.vsAverage.toFixed(0)}%. Wait for a sale.`;
    }
    return 'Strong wait recommendation - price is inflated.';
  }
}

/**
 * Gets the deal tier for styling
 * @param {number} score - Deal score
 * @returns {Object} Tier info with color and label
 */
export function getDealTier(score) {
  if (score >= 90) {
    return { name: 'golden', color: '#ffd700', label: 'Golden Deal', icon: 'crown' };
  } else if (score >= 70) {
    return { name: 'excellent', color: '#00d084', label: 'Excellent', icon: 'check-circle' };
  } else if (score >= 50) {
    return { name: 'fair', color: '#3b82f6', label: 'Fair Price', icon: 'info' };
  } else if (score >= 30) {
    return { name: 'wait', color: '#f59e0b', label: 'Wait & See', icon: 'clock' };
  } else {
    return { name: 'avoid', color: '#ff4757', label: 'Overpriced', icon: 'alert-triangle' };
  }
}

console.log('🚀 AliSmart: AI-Logic Loaded');
