/**
 * Cloud Sync Engine - Smart Wishlist Synchronization
 * iCloud-style seamless sync for AliExpress wishlist
 * Handles diff between local storage and cloud database
 */

// Sync configuration
const SYNC_CONFIG = {
  SYNC_INTERVAL: 30 * 1000, // 30 seconds
  MAX_RETRIES: 3,
  BATCH_SIZE: 50,
  CONFLICT_RESOLUTION: 'cloud_wins' // or 'local_wins', 'timestamp_wins'
}

// Storage keys
const STORAGE_KEYS = {
  WISHLIST_ITEMS: 'alismart_wishlist_items',
  WISHLIST_COLLECTIONS: 'alismart_wishlist_collections',
  LAST_SYNC: 'alismart_wishlist_last_sync',
  SYNC_QUEUE: 'alismart_wishlist_sync_queue'
}

/**
 * Calculates diff between local and cloud data
 * @param {Array} localItems - Items from local storage
 * @param {Array} cloudItems - Items from cloud database
 * @returns {Object} Changes needed for both sides
 */
export function calculateDiff(localItems, cloudItems) {
  const localMap = new Map(localItems.map(item => [item.id, item]))
  const cloudMap = new Map(cloudItems.map(item => [item.id, item]))
  
  const toCloud = [] // Items to push to cloud
  const toLocal = [] // Items to pull from cloud
  const conflicts = [] // Items needing resolution
  
  // Check local items against cloud
  for (const [id, localItem] of localMap) {
    const cloudItem = cloudMap.get(id)
    
    if (!cloudItem) {
      // New local item - push to cloud
      toCloud.push(localItem)
    } else {
      // Item exists in both - check for conflicts
      const localTime = new Date(localItem.lastModified || localItem.addedAt).getTime()
      const cloudTime = new Date(cloudItem.lastModified || cloudItem.addedAt).getTime()
      
      if (localTime > cloudTime) {
        // Local is newer
        toCloud.push(localItem)
      } else if (cloudTime > localTime) {
        // Cloud is newer
        toLocal.push(cloudItem)
      }
      // If equal timestamps, no change needed
    }
  }
  
  // Check cloud items against local
  for (const [id, cloudItem] of cloudMap) {
    if (!localMap.has(id)) {
      // New cloud item - pull to local
      toLocal.push(cloudItem)
    }
  }
  
  return {
    toCloud,
    toLocal,
    conflicts,
    stats: {
      localCount: localItems.length,
      cloudCount: cloudItems.length,
      pushCount: toCloud.length,
      pullCount: toLocal.length,
      conflictCount: conflicts.length
    }
  }
}

/**
 * Synchronizes wishlist between local storage and cloud
 * Silent background operation - no UI blocking
 * @returns {Promise<Object>} Sync result
 */
export async function syncWishlist() {
  console.log('[AliSmart Cloud] Starting wishlist sync...')
  
  try {
    // 1. Get local data
    const localItems = await getLocalWishlist()
    const localCollections = await getLocalCollections()
    
    // 2. Get cloud data (simulated - in production would fetch from Firebase/Supabase)
    const cloudData = await fetchCloudWishlist()
    
    // 3. Calculate diff
    const diff = calculateDiff(localItems, cloudData.items || [])
    
    // 4. Apply changes
    const results = {
      pushed: [],
      pulled: [],
      failed: []
    }
    
    // Push local changes to cloud
    if (diff.toCloud.length > 0) {
      try {
        await pushToCloud(diff.toCloud)
        results.pushed = diff.toCloud.map(i => i.id)
      } catch (e) {
        console.error('[AliSmart Cloud] Push failed:', e)
        results.failed.push(...diff.toCloud.map(i => i.id))
      }
    }
    
    // Pull cloud changes to local
    if (diff.toLocal.length > 0) {
      try {
        await saveToLocal([...localItems, ...diff.toLocal])
        results.pulled = diff.toLocal.map(i => i.id)
      } catch (e) {
        console.error('[AliSmart Cloud] Pull failed:', e)
        results.failed.push(...diff.toLocal.map(i => i.id))
      }
    }
    
    // 5. Update last sync timestamp
    await chrome.storage.local.set({
      [STORAGE_KEYS.LAST_SYNC]: Date.now()
    })
    
    console.log('[AliSmart Cloud] Sync complete:', {
      pushed: results.pushed.length,
      pulled: results.pulled.length,
      failed: results.failed.length
    })
    
    return {
      success: true,
      timestamp: Date.now(),
      ...diff.stats,
      ...results
    }
    
  } catch (error) {
    console.error('[AliSmart Cloud] Sync failed:', error)
    return {
      success: false,
      error: error.message,
      timestamp: Date.now()
    }
  }
}

/**
 * Gets wishlist from local storage
 * @returns {Promise<Array>} Wishlist items
 */
async function getLocalWishlist() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.WISHLIST_ITEMS)
    return result[STORAGE_KEYS.WISHLIST_ITEMS] || []
  } catch (e) {
    console.error('[AliSmart Cloud] Failed to get local wishlist:', e)
    return []
  }
}

/**
 * Gets collections from local storage
 * @returns {Promise<Array>} Collections
 */
async function getLocalCollections() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.WISHLIST_COLLECTIONS)
    return result[STORAGE_KEYS.WISHLIST_COLLECTIONS] || []
  } catch (e) {
    console.error('[AliSmart Cloud] Failed to get local collections:', e)
    return []
  }
}

/**
 * Saves items to local storage
 * @param {Array} items - Items to save
 */
async function saveToLocal(items) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.WISHLIST_ITEMS]: items
  })
}

/**
 * Fetches wishlist from cloud (simulated)
 * In production, this would call Firebase/Supabase API
 * @returns {Promise<Object>} Cloud data
 */
async function fetchCloudWishlist() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // For demo purposes, return empty or sample data
  // In production, this would be:
  // const response = await fetch('https://api.alismart.com/wishlist', {...})
  return {
    items: [],
    collections: [],
    lastModified: Date.now()
  }
}

/**
 * Pushes items to cloud (simulated)
 * @param {Array} items - Items to push
 */
async function pushToCloud(items) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200))
  
  // In production, this would be:
  // await fetch('https://api.alismart.com/wishlist/batch', {
  //   method: 'POST',
  //   body: JSON.stringify(items),
  //   headers: { 'Authorization': 'Bearer ' + token }
  // })
  
  console.log('[AliSmart Cloud] Pushed', items.length, 'items to cloud')
}

/**
 * Adds item to wishlist with immediate sync
 * @param {Object} product - Product to add
 * @param {string} collectionId - Optional collection ID
 * @returns {Promise<Object>} Result
 */
export async function addToWishlist(product, collectionId = 'default') {
  try {
    const wishlistItem = {
      id: generateId(),
      productId: product.productId || product.id,
      title: product.title,
      price: product.price,
      priceValue: product.priceValue,
      imageUrl: product.imageUrl || product.image,
      storeId: product.storeId,
      storeName: product.storeName,
      collectionId,
      addedAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      priceHistory: [{
        price: product.priceValue,
        date: new Date().toISOString()
      }],
      notifyOnDrop: true,
      dropThreshold: 5, // 5% price drop notification
      affiliateUrl: product.affiliateUrl || null
    }
    
    // Save to local
    const current = await getLocalWishlist()
    const exists = current.find(i => i.productId === wishlistItem.productId)
    
    if (exists) {
      return {
        success: false,
        error: 'Item already in wishlist',
        item: exists
      }
    }
    
    const updated = [...current, wishlistItem]
    await saveToLocal(updated)
    
    // Trigger background sync
    syncWishlist().catch(console.error)
    
    return {
      success: true,
      item: wishlistItem,
      totalItems: updated.length
    }
    
  } catch (error) {
    console.error('[AliSmart Cloud] Add to wishlist failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Removes item from wishlist
 * @param {string} itemId - Item ID to remove
 * @returns {Promise<Object>} Result
 */
export async function removeFromWishlist(itemId) {
  try {
    const current = await getLocalWishlist()
    const updated = current.filter(i => i.id !== itemId)
    
    await saveToLocal(updated)
    
    // Trigger background sync
    syncWishlist().catch(console.error)
    
    return {
      success: true,
      removedId: itemId,
      totalItems: updated.length
    }
    
  } catch (error) {
    console.error('[AliSmart Cloud] Remove from wishlist failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Creates a new collection
 * @param {string} name - Collection name
 * @param {string} color - Optional color theme
 * @returns {Promise<Object>} Created collection
 */
export async function createCollection(name, color = '#ff6a00') {
  try {
    const collections = await getLocalCollections()
    
    const collection = {
      id: generateId(),
      name,
      color,
      createdAt: new Date().toISOString(),
      itemCount: 0,
      totalValue: 0,
      priceChangePercent: 0
    }
    
    const updated = [...collections, collection]
    await chrome.storage.local.set({
      [STORAGE_KEYS.WISHLIST_COLLECTIONS]: updated
    })
    
    return {
      success: true,
      collection
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Calculates collection statistics (total value, price changes)
 * @param {Array} items - Items in collection
 * @returns {Object} Statistics
 */
export function calculateCollectionStats(items) {
  if (!items || items.length === 0) {
    return {
      itemCount: 0,
      totalValue: 0,
      priceChangePercent: 0,
      priceChangeAmount: 0
    }
  }
  
  const totalValue = items.reduce((sum, item) => sum + (item.priceValue || 0), 0)
  
  // Calculate price change from history
  let totalChange = 0
  let itemsWithHistory = 0
  
  for (const item of items) {
    if (item.priceHistory && item.priceHistory.length >= 2) {
      const first = item.priceHistory[0].price
      const last = item.priceHistory[item.priceHistory.length - 1].price
      const change = ((last - first) / first) * 100
      totalChange += change
      itemsWithHistory++
    }
  }
  
  const avgChange = itemsWithHistory > 0 ? totalChange / itemsWithHistory : 0
  
  return {
    itemCount: items.length,
    totalValue,
    priceChangePercent: avgChange,
    priceChangeAmount: totalValue * (avgChange / 100)
  }
}

/**
 * Generates a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * Creates shareable wishlist link with affiliate codes
 * @param {string} collectionId - Collection to share
 * @param {Array} items - Items in the collection
 * @returns {string} Shareable URL
 */
export function createShareableLink(collectionId, items) {
  const baseUrl = 'https://alismart.app/wishlist'
  const params = new URLSearchParams({
    collection: collectionId,
    items: items.map(i => i.productId).join(','),
    ref: 'alismart_ext'
  })
  
  return `${baseUrl}?${params.toString()}`
}

/**
 * Sets up automatic background sync
 * Called once on app initialization
 */
export function setupAutoSync() {
  // Initial sync
  syncWishlist().catch(console.error)
  
  // Periodic sync every 30 seconds
  setInterval(() => {
    syncWishlist().catch(console.error)
  }, SYNC_CONFIG.SYNC_INTERVAL)
  
  // Sync on window focus (user returned to tab)
  window.addEventListener('focus', () => {
    syncWishlist().catch(console.error)
  })
  
  console.log('[AliSmart Cloud] Auto-sync enabled (30s interval)')
}

/**
 * Gets sync status
 * @returns {Promise<Object>} Sync status info
 */
export async function getSyncStatus() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.LAST_SYNC,
      STORAGE_KEYS.SYNC_QUEUE
    ])
    
    const lastSync = result[STORAGE_KEYS.LAST_SYNC] || 0
    const queue = result[STORAGE_KEYS.SYNC_QUEUE] || []
    
    return {
      lastSync,
      lastSyncFormatted: lastSync ? new Date(lastSync).toLocaleString() : 'Never',
      pendingChanges: queue.length,
      isStale: Date.now() - lastSync > SYNC_CONFIG.SYNC_INTERVAL * 2
    }
    
  } catch (e) {
    return {
      lastSync: 0,
      pendingChanges: 0,
      isStale: true
    }
  }
}

console.log('☁️ AliSmart: Cloud Sync Engine Loaded')
