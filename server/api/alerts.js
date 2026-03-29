/**
 * AliSmart Price Alerts API
 * Manage user price drop alerts
 */

import { kv } from '@vercel/kv';

/**
 * Create a price alert
 * POST /api/alerts/create
 */
export async function createAlert(request) {
  try {
    const { productId, title, targetPrice, currentPrice, email, imageUrl } = await request.json();
    
    if (!productId || !targetPrice) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const alertId = `alert:${Date.now()}:${productId}`;
    const alert = {
      id: alertId,
      productId,
      title: title || 'Unknown Product',
      targetPrice: parseFloat(targetPrice),
      currentPrice: parseFloat(currentPrice) || 0,
      email: email || '',
      imageUrl: imageUrl || '',
      createdAt: Date.now(),
      status: 'active',
      notified: false
    };

    // Store alert
    await kv.hset(`alerts:${productId}`, { [alertId]: JSON.stringify(alert) });
    
    // Add to active alerts index
    await kv.sadd('alerts:active', alertId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alert,
        message: 'Price alert created successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create alert error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create alert' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Check and trigger price alerts
 * Called when new price is stored
 */
export async function checkPriceAlerts(productId, currentPrice) {
  try {
    const alerts = await kv.hgetall(`alerts:${productId}`);
    if (!alerts) return;

    const triggered = [];
    
    for (const [alertId, alertData] of Object.entries(alerts)) {
      try {
        const alert = JSON.parse(alertData);
        
        if (alert.status === 'active' && !alert.notified && currentPrice <= alert.targetPrice) {
          // Trigger the alert
          alert.notified = true;
          alert.triggeredAt = Date.now();
          alert.triggeredPrice = currentPrice;
          
          // Update alert
          await kv.hset(`alerts:${productId}`, { [alertId]: JSON.stringify(alert) });
          
          // Move to triggered index
          await kv.srem('alerts:active', alertId);
          await kv.sadd('alerts:triggered', alertId);
          
          triggered.push(alert);
          
          // Here you would typically send an email notification
          // For now, we'll just mark it as triggered
          console.log(`🚨 Price alert triggered: ${alert.title} - Target: $${alert.targetPrice}, Current: $${currentPrice}`);
        }
      } catch (e) {
        console.error('Error processing alert:', e);
      }
    }
    
    return triggered;
  } catch (error) {
    console.error('Check price alerts error:', error);
    return [];
  }
}

/**
 * Get user's active alerts
 * GET /api/alerts/list?email=xxx
 */
export async function listAlerts(request) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    // Get all active alert IDs
    const alertIds = await kv.smembers('alerts:active');
    
    const alerts = [];
    for (const alertId of alertIds.slice(0, 100)) { // Limit to 100
      try {
        // Parse alertId to get productId
        const parts = alertId.split(':');
        if (parts.length >= 3) {
          const productId = parts[2];
          const alertData = await kv.hget(`alerts:${productId}`, alertId);
          if (alertData) {
            const alert = JSON.parse(alertData);
            if (!email || alert.email === email) {
              alerts.push(alert);
            }
          }
        }
      } catch (e) {
        // Skip invalid entries
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts,
        count: alerts.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('List alerts error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list alerts' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Delete an alert
 * DELETE /api/alerts/delete
 */
export async function deleteAlert(request) {
  try {
    const { alertId } = await request.json();
    
    if (!alertId) {
      return new Response(
        JSON.stringify({ error: 'Missing alertId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parts = alertId.split(':');
    if (parts.length >= 3) {
      const productId = parts[2];
      await kv.hdel(`alerts:${productId}`, alertId);
      await kv.srem('alerts:active', alertId);
      await kv.srem('alerts:triggered', alertId);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Alert deleted' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete alert error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete alert' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
