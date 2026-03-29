/**
 * AliSmart Price History API
 * Store and retrieve price history using Vercel KV
 * 
 * Environment variables needed:
 * - KV_URL (Vercel KV connection string)
 * - KV_REST_API_TOKEN (Vercel KV token)
 */

import { kv } from '@vercel/kv';

/**
 * Store a price point for a product
 * POST /api/price-history/store
 */
export async function storePricePoint(request) {
  try {
    const { productId, title, price, currency = 'USD', imageUrl, category, seller } = await request.json();
    
    if (!productId || !price) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productId and price' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pricePoint = {
      productId,
      title: title || 'Unknown Product',
      price: parseFloat(price),
      currency,
      imageUrl: imageUrl || '',
      category: category || '',
      seller: seller || {},
      timestamp: Date.now(),
      date: new Date().toISOString()
    };

    // Store in sorted set with timestamp as score for easy range queries
    const key = `price:history:${productId}`;
    await kv.zadd(key, { member: JSON.stringify(pricePoint), score: pricePoint.timestamp });
    
    // Keep only last 90 days of data (cleanup old entries)
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    await kv.zremrangebyscore(key, 0, ninetyDaysAgo);
    
    // Also store in a global index for "recently tracked" products
    await kv.zadd('price:global:index', { member: productId, score: Date.now() });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Price point stored',
        data: pricePoint
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Store price point error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to store price point', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get price history for a product
 * GET /api/price-history?productId=xxx&days=90
 */
export async function getPriceHistory(request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    const days = parseInt(url.searchParams.get('days')) || 90;
    
    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'Missing productId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const key = `price:history:${productId}`;
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Get all price points from the last N days
    const priceData = await kv.zrangebyscore(key, since, Infinity);
    
    const history = priceData.map(item => {
      try {
        return JSON.parse(item);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    // Calculate statistics
    const prices = history.map(h => h.price);
    const stats = {
      current: prices[prices.length - 1] || 0,
      lowest: Math.min(...prices) || 0,
      highest: Math.max(...prices) || 0,
      average: prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : 0,
      change: prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(1) : 0
    };

    return new Response(
      JSON.stringify({
        success: true,
        productId,
        history,
        stats,
        count: history.length,
        days
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get price history error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get price history', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get all tracked products (for user dashboard)
 * GET /api/price-history/tracked
 */
export async function getTrackedProducts(request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    
    // Get recently tracked product IDs
    const productIds = await kv.zrevrange('price:global:index', 0, limit - 1);
    
    const products = [];
    for (const productId of productIds) {
      const key = `price:history:${productId}`;
      const latest = await kv.zrevrange(key, 0, 0);
      if (latest && latest[0]) {
        try {
          const data = JSON.parse(latest[0]);
          products.push({
            productId: data.productId,
            title: data.title,
            currentPrice: data.price,
            imageUrl: data.imageUrl,
            lastUpdated: data.timestamp
          });
        } catch (e) {
          // Skip invalid entries
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        products,
        count: products.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get tracked products error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get tracked products', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
