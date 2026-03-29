/**
 * AliSmart Main Search API with Advanced Features
 * Enhanced search with category/specs keyword extraction
 */

import { kv } from '@vercel/kv';
import { storePricePoint } from './price-history.js';
import { checkPriceAlerts } from './alerts.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async function handler(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Route handling
  if (path === '/api/search' || path === '/api/search/') {
    return handleSearch(request);
  }
  
  if (path === '/api/price-history' || path === '/api/price-history/') {
    return handlePriceHistory(request);
  }
  
  if (path === '/api/alerts/create' || path === '/api/alerts/create/') {
    return handleCreateAlert(request);
  }
  
  if (path === '/api/alerts/list' || path === '/api/alerts/list/') {
    return handleListAlerts(request);
  }

  // AliExpress API proxy (existing functionality)
  if (path.includes('/api/aliexpress')) {
    return proxyAliExpress(request);
  }

  return new Response(
    JSON.stringify({ error: 'Not found', path }),
    { status: 404, headers: corsHeaders }
  );
}

/**
 * Enhanced search with keyword extraction from category and specs
 */
async function handleSearch(request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    const categoryPath = url.searchParams.get('category');
    const specs = url.searchParams.get('specs');
    const sort = url.searchParams.get('sort') || 'SALE_PRICE_ASC';
    const mode = url.searchParams.get('mode') || 'cheap'; // 'cheap' or 'quality'
    
    if (!q) {
      return new Response(
        JSON.stringify({ error: 'No search keyword provided' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract enhanced keywords
    const enhancedKeywords = extractKeywords(q, categoryPath, specs);
    
    // Build search query based on mode
    let searchQuery = q;
    if (mode === 'quality') {
      // For quality mode, add relevant quality keywords
      searchQuery = `${q} top rated best seller`;
    }

    // Call AliExpress API with 50 results and 4.5+ rating filter
    const rawResults = await searchAliExpress(searchQuery, sort, 4.5, 50);
    
    // Apply Price Sorter deduplication
    const results = priceSorterDedupe(rawResults);
    
    // Process and enhance results
    const enhancedResults = results.map(product => ({
      ...product,
      matchScore: calculateMatchScore(product, enhancedKeywords),
      valueScore: calculateValueScore(product),
      trustIndicators: extractTrustIndicators(product)
    }));

    // Sort based on mode
    if (mode === 'quality') {
      enhancedResults.sort((a, b) => (b.trustIndicators.score - a.trustIndicators.score));
    } else {
      enhancedResults.sort((a, b) => (a.salePrice - b.salePrice));
    }

    return new Response(
      JSON.stringify({
        success: true,
        query: q,
        mode,
        enhancedKeywords,
        results: enhancedResults,
        total: enhancedResults.length,
        rawCount: rawResults.length,
        dedupedCount: results.length,
        filters: {
          minRating: 4.5,
          pageSize: 50,
          choicePriority: true,
          deduplication: true
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Extract keywords from title, category path, and specs
 */
function extractKeywords(title, categoryPath, specs) {
  const keywords = new Set();
  
  // Extract from title
  const titleWords = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !isStopWord(w));
  titleWords.forEach(w => keywords.add(w));
  
  // Extract from category path
  if (categoryPath) {
    const categoryWords = categoryPath.toLowerCase()
      .split(/[>/,&]+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !isStopWord(w));
    categoryWords.forEach(w => keywords.add(w));
  }
  
  // Parse specs JSON if provided
  if (specs) {
    try {
      const specsObj = JSON.parse(specs);
      Object.values(specsObj).forEach(value => {
        if (typeof value === 'string') {
          value.toLowerCase()
            .split(/[\s,]+/)
            .filter(w => w.length > 1 && !isStopWord(w))
            .forEach(w => keywords.add(w));
        }
      });
    } catch (e) {
      // Invalid specs JSON, ignore
    }
  }
  
  return Array.from(keywords);
}

function isStopWord(word) {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has', 'had',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'need',
    'new', 'old', 'good', 'best', 'top', 'high', 'low', 'big', 'small', 'free',
    'ship', 'shipping', 'delivery', 'warranty', 'guarantee', 'original', 'official'
  ]);
  return stopWords.has(word.toLowerCase());
}

function calculateMatchScore(product, keywords) {
  let score = 0;
  const productText = `${product.title} ${product.category || ''}`.toLowerCase();
  
  keywords.forEach(keyword => {
    if (productText.includes(keyword)) score += 1;
  });
  
  return score / Math.max(keywords.length, 1);
}

function calculateValueScore(product) {
  // Value = (rating * orders) / price
  const rating = product.evaluateScore || 4;
  const orders = parseInt(product.sale30days || 0);
  const price = product.salePrice || 1;
  
  return (rating * Math.log10(orders + 1)) / price;
}

function extractTrustIndicators(product) {
  const sellerRating = product.sellerRating || 90;
  const sellerYears = product.sellerYears || 0;
  const positiveRate = product.positiveRate || 90;
  const orders = parseInt(product.sale30days || 0);
  
  let score = 0;
  let level = 'medium';
  
  // Calculate trust score
  if (sellerRating >= 95 && positiveRate >= 95 && sellerYears >= 3) {
    score = 90 + (orders > 1000 ? 10 : 0);
    level = 'high';
  } else if (sellerRating >= 90 && positiveRate >= 90) {
    score = 70 + (sellerYears >= 2 ? 10 : 0);
    level = 'medium';
  } else {
    score = 50;
    level = 'low';
  }
  
  return {
    score,
    level,
    sellerRating,
    sellerYears,
    positiveRate,
    orders
  };
}

async function searchAliExpress(query, sort, minRating = 4.5, pageSize = 50) {
  try {
    // AliExpress Affiliate API configuration
    const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
    const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
    const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
    
    if (!APP_KEY || !APP_SECRET) {
      console.warn('AliExpress API credentials not configured, returning mock data');
      return [];
    }

    // Build API request
    const timestamp = Date.now();
    const apiUrl = 'https://openapi.aliexpress.com/gateway.do';
    
    const params = {
      app_key: APP_KEY,
      timestamp: timestamp,
      sign_method: 'md5',
      v: '2.0',
      format: 'json',
      method: 'aliexpress.affiliate.product.query',
      app_signature: '', // Will be calculated
      fields: 'product_id,product_title,product_main_image_url,product_detail_url,target_sale_price,target_original_price,shop_id,sale30days,evaluate_rate,shop_url,shop_name,discount,delivery_days,score,commission_rate,is_choice',
      keywords: query,
      page_size: pageSize,
      page_no: 1,
      sort: sort,
      tracking_id: TRACKING_ID
    };

    // Calculate signature (MD5 hash of sorted parameters + secret)
    const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
      if (key !== 'sign' && params[key]) {
        acc[key] = params[key];
      }
      return acc;
    }, {});
    
    const signString = Object.entries(sortedParams)
      .map(([k, v]) => `${k}${v}`)
      .join('') + APP_SECRET;
    
    const crypto = await import('crypto');
    params.sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();

    // Build query string
    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const fullUrl = `${apiUrl}?${queryString}`;
    
    console.log('Fetching AliExpress API:', fullUrl.substring(0, 100) + '...');

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`AliExpress API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract products from response
    let products = [];
    if (data.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product) {
      products = data.aliexpress_affiliate_product_query_response.resp_result.result.products.product;
    }

    console.log(`AliExpress returned ${products.length} products`);

    // Filter products by minimum rating (4.5 stars)
    const filteredProducts = products.filter(p => {
      const rating = parseFloat(p.evaluate_rate || p.score || 0);
      return rating >= minRating;
    });

    console.log(`${filteredProducts.length} products after rating filter (>= ${minRating})`);

    return filteredProducts;
  } catch (error) {
    console.error('AliExpress search error:', error);
    return [];
  }
}

/**
 * Price Sorter - Deduplicates identical items and keeps lowest price
 * Groups products by similarity and returns best price from each group
 */
function priceSorterDedupe(products) {
  if (!products || products.length === 0) return [];

  console.log(`Price Sorter: Processing ${products.length} products for deduplication`);

  // Group similar products
  const groups = [];
  const processed = new Set();

  for (let i = 0; i < products.length; i++) {
    if (processed.has(i)) continue;

    const product = products[i];
    const similarGroup = [product];
    processed.add(i);

    // Find similar products
    for (let j = i + 1; j < products.length; j++) {
      if (processed.has(j)) continue;

      const other = products[j];
      const similarity = calculateProductSimilarity(product, other);

      if (similarity >= 0.85) { // 85% similarity threshold
        similarGroup.push(other);
        processed.add(j);
      }
    }

    groups.push(similarGroup);
  }

  console.log(`Price Sorter: Grouped into ${groups.length} unique product groups`);

  // From each group, select best product (lowest price, highest rating, is_choice)
  const bestProducts = groups.map(group => {
    return group.sort((a, b) => {
      // Prioritize Choice products
      const aIsChoice = a.is_choice === 'Y' || a.is_choice === true;
      const bIsChoice = b.is_choice === 'Y' || b.is_choice === true;
      
      if (aIsChoice && !bIsChoice) return -1;
      if (!aIsChoice && bIsChoice) return 1;
      
      // Then by price (lowest first)
      const aPrice = parseFloat(a.target_sale_price || a.sale_price || 999999);
      const bPrice = parseFloat(b.target_sale_price || b.sale_price || 999999);
      if (aPrice !== bPrice) return aPrice - bPrice;
      
      // Then by rating (highest first)
      const aRating = parseFloat(a.evaluate_rate || a.score || 0);
      const bRating = parseFloat(b.evaluate_rate || b.score || 0);
      return bRating - aRating;
    })[0];
  });

  // Sort final results: Choice first, then by price
  bestProducts.sort((a, b) => {
    const aIsChoice = a.is_choice === 'Y' || a.is_choice === true;
    const bIsChoice = b.is_choice === 'Y' || b.is_choice === true;
    
    if (aIsChoice && !bIsChoice) return -1;
    if (!aIsChoice && bIsChoice) return 1;
    
    const aPrice = parseFloat(a.target_sale_price || a.sale_price || 0);
    const bPrice = parseFloat(b.target_sale_price || b.sale_price || 0);
    return aPrice - bPrice;
  });

  console.log(`Price Sorter: Returning ${bestProducts.length} deduplicated products`);
  
  return bestProducts;
}

/**
 * Calculate similarity between two products (0-1 scale)
 */
function calculateProductSimilarity(a, b) {
  const titleA = (a.product_title || a.title || '').toLowerCase();
  const titleB = (b.product_title || b.title || '').toLowerCase();
  
  // Normalize titles
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  
  // Check if normalized titles are similar
  if (normA === normB) return 1.0;
  
  // Calculate word overlap
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2));
  
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  
  const jaccardScore = intersection.size / Math.max(union.size, 1);
  
  // Check price similarity (within 20% of each other)
  const priceA = parseFloat(a.target_sale_price || a.sale_price || 0);
  const priceB = parseFloat(b.target_sale_price || b.sale_price || 0);
  
  if (priceA === 0 || priceB === 0) return jaccardScore;
  
  const priceDiff = Math.abs(priceA - priceB) / Math.max(priceA, priceB);
  const priceScore = priceDiff <= 0.2 ? 1.0 : Math.max(0, 1 - (priceDiff - 0.2));
  
  // Combined score (70% title, 30% price)
  return (jaccardScore * 0.7) + (priceScore * 0.3);
}

/**
 * Normalize product title for comparison
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    // Remove common fluff words
    .replace(/\b(original|official|authentic|genuine|brand new|hot sale|2025|2026|new arrival|trending|popular|high quality|best seller|top rated|limited edition|special offer|free shipping|premium)\b/g, '')
    // Remove special characters
    .replace(/[^\w\s]/g, ' ')
    // Remove numbers (often vary between listings)
    .replace(/\b\d+\b/g, '')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim()
    // Keep only meaningful words (3+ chars)
    .split(' ')
    .filter(w => w.length >= 3)
    .join(' ');
}

async function handlePriceHistory(request) {
  const { getPriceHistory } = await import('./price-history.js');
  return getPriceHistory(request);
}

async function handleCreateAlert(request) {
  const { createAlert } = await import('./alerts.js');
  return createAlert(request);
}

async function handleListAlerts(request) {
  const { listAlerts } = await import('./alerts.js');
  return listAlerts(request);
}

async function proxyAliExpress(request) {
  // Existing AliExpress proxy logic
  return new Response(
    JSON.stringify({ message: 'AliExpress proxy endpoint' }),
    { status: 200, headers: corsHeaders }
  );
}
