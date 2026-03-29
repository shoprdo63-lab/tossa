import { useState, useEffect, useCallback } from 'react'
import { 
  addToWishlist, 
  removeFromWishlist, 
  createCollection, 
  calculateCollectionStats,
  createShareableLink,
  getSyncStatus,
  syncWishlist
} from '../services/cloud-sync.js'
import './SmartWishlist.css'

/**
 * SmartWishlist Component
 * Cloud-synchronized wishlist with folders/collections
 * Drag & drop reordering, price alerts, shareable lists
 */
function SmartWishlist({ product, onAddComplete }) {
  const [collections, setCollections] = useState([])
  const [items, setItems] = useState([])
  const [activeCollection, setActiveCollection] = useState('default')
  const [isSyncing, setIsSyncing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [draggedItem, setDraggedItem] = useState(null)
  const [shareUrl, setShareUrl] = useState(null)

  // Load data on mount
  useEffect(() => {
    loadWishlistData()
    setupAutoSync()
  }, [])

  // Handle product prop changes
  useEffect(() => {
    if (product && product !== selectedProduct) {
      setSelectedProduct(product)
      setShowAddModal(true)
    }
  }, [product])

  const loadWishlistData = async () => {
    try {
      const result = await chrome.storage.local.get([
        'alismart_wishlist_items',
        'alismart_wishlist_collections'
      ])
      
      setItems(result.alismart_wishlist_items || [])
      setCollections(result.alismart_wishlist_collections || [
        { id: 'default', name: 'All Items', color: '#ff6a00', itemCount: 0 }
      ])
    } catch (error) {
      console.error('[AliSmart Wishlist] Load failed:', error)
    }
  }

  const setupAutoSync = () => {
    // Sync every 30 seconds
    const interval = setInterval(() => {
      syncWishlist().catch(console.error)
    }, 30000)

    // Sync on window focus
    const handleFocus = () => {
      syncWishlist().catch(console.error)
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }

  const handleAddToWishlist = async (collectionId) => {
    if (!selectedProduct) return

    const result = await addToWishlist(selectedProduct, collectionId)
    
    if (result.success) {
      await loadWishlistData()
      setShowAddModal(false)
      
      if (onAddComplete) {
        onAddComplete(result.item)
      }
    }
  }

  const handleRemoveItem = async (itemId) => {
    const result = await removeFromWishlist(itemId)
    
    if (result.success) {
      await loadWishlistData()
    }
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return

    const result = await createCollection(newCollectionName)
    
    if (result.success) {
      await loadWishlistData()
      setShowNewCollection(false)
      setNewCollectionName('')
    }
  }

  const handleShare = (collectionId) => {
    const collectionItems = items.filter(i => i.collectionId === collectionId || collectionId === 'default')
    const url = createShareableLink(collectionId, collectionItems)
    setShareUrl(url)
    
    // Copy to clipboard
    navigator.clipboard.writeText(url).catch(() => {})
    
    setTimeout(() => setShareUrl(null), 3000)
  }

  const handleDragStart = (item) => {
    setDraggedItem(item)
  }

  const handleDragOver = (e, targetItem) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetItem.id) return
    
    // Reorder items
    const newItems = [...items]
    const dragIdx = newItems.findIndex(i => i.id === draggedItem.id)
    const targetIdx = newItems.findIndex(i => i.id === targetItem.id)
    
    newItems.splice(dragIdx, 1)
    newItems.splice(targetIdx, 0, draggedItem)
    
    setItems(newItems)
  }

  const handleDragEnd = async () => {
    setDraggedItem(null)
    // Save new order
    await chrome.storage.local.set({
      'alismart_wishlist_items': items
    })
    syncWishlist().catch(console.error)
  }

  // Filter items by collection
  const filteredItems = activeCollection === 'default' 
    ? items 
    : items.filter(i => i.collectionId === activeCollection)

  // Calculate collection stats
  const collectionStats = calculateCollectionStats(filteredItems)

  // Get active collection info
  const activeCollectionInfo = collections.find(c => c.id === activeCollection) || collections[0]

  return (
    <div className="smart-wishlist">
      {/* Header */}
      <div className="wishlist-header">
        <h3 className="wishlist-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          Smart Wishlist
          {isSyncing && (
            <span className="sync-indicator">
              <span className="sync-spinner"></span>
              Syncing...
            </span>
          )}
        </h3>
        
        <button 
          className="new-collection-btn"
          onClick={() => setShowNewCollection(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Collection
        </button>
      </div>

      {/* Collections Tabs */}
      <div className="collections-tabs">
        {collections.map(collection => {
          const stats = collection.id === 'default' 
            ? { itemCount: items.length }
            : { itemCount: items.filter(i => i.collectionId === collection.id).length }
          
          return (
            <button
              key={collection.id}
              className={`collection-tab ${activeCollection === collection.id ? 'active' : ''}`}
              onClick={() => setActiveCollection(collection.id)}
              style={{ '--collection-color': collection.color }}
            >
              <span className="tab-dot" style={{ backgroundColor: collection.color }}></span>
              <span className="tab-name">{collection.name}</span>
              <span className="tab-count">{stats.itemCount}</span>
            </button>
          )
        })}
      </div>

      {/* Collection Stats */}
      {filteredItems.length > 0 && (
        <div className="collection-stats">
          <div className="stat-row">
            <span className="stat-label">{filteredItems.length} items</span>
            <span className="stat-value">
              Total: ${collectionStats.totalValue.toFixed(2)}
            </span>
          </div>
          {collectionStats.priceChangePercent !== 0 && (
            <div className={`price-change ${collectionStats.priceChangePercent < 0 ? 'dropped' : 'increased'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {collectionStats.priceChangePercent < 0 ? (
                  <path d="M12 19V5M5 12l7-7 7 7"></path>
                ) : (
                  <path d="M12 5v14M5 12l7 7 7-7"></path>
                )}
              </svg>
              {Math.abs(collectionStats.priceChangePercent).toFixed(1)}% 
              {collectionStats.priceChangePercent < 0 ? 'cheaper' : 'more expensive'} 
              than last week
            </div>
          )}
        </div>
      )}

      {/* Items Grid */}
      <div className="wishlist-grid">
        {filteredItems.length === 0 ? (
          <div className="wishlist-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <p>No items in this collection</p>
            <span className="empty-hint">Click the heart icon on any product to add it here</span>
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <div
              key={item.id}
              className={`wishlist-item ${draggedItem?.id === item.id ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(item)}
              onDragOver={(e) => handleDragOver(e, item)}
              onDragEnd={handleDragEnd}
            >
              <div className="item-drag-handle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="2"></circle>
                  <circle cx="9" cy="12" r="2"></circle>
                  <circle cx="9" cy="18" r="2"></circle>
                  <circle cx="15" cy="6" r="2"></circle>
                  <circle cx="15" cy="12" r="2"></circle>
                  <circle cx="15" cy="18" r="2"></circle>
                </svg>
              </div>
              
              <div className="item-image">
                <img 
                  src={item.imageUrl} 
                  alt={item.title}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="%23666"><rect width="60" height="60"/></svg>'
                  }}
                />
              </div>
              
              <div className="item-info">
                <h4 className="item-title">{item.title}</h4>
                <div className="item-price-row">
                  <span className="item-price">{item.price}</span>
                  {item.priceHistory && item.priceHistory.length > 1 && (
                    <span className={`price-trend ${
                      item.priceHistory[item.priceHistory.length - 1].price < item.priceHistory[0].price ? 'down' : 'up'
                    }`}>
                      {item.priceHistory[item.priceHistory.length - 1].price < item.priceHistory[0].price ? '↓' : '↑'}
                    </span>
                  )}
                </div>
                <span className="item-store">{item.storeName || 'AliExpress Store'}</span>
              </div>
              
              <div className="item-actions">
                <a 
                  href={item.affiliateUrl || `https://aliexpress.com/item/${item.productId}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="item-view-btn"
                  title="View product"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
                
                <button
                  className="item-remove-btn"
                  onClick={() => handleRemoveItem(item.id)}
                  title="Remove from wishlist"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Share Button */}
      {filteredItems.length > 0 && (
        <div className="wishlist-footer">
          <button 
            className="share-collection-btn"
            onClick={() => handleShare(activeCollection)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            {shareUrl ? 'Link copied!' : 'Share Collection'}
          </button>
          
          {shareUrl && (
            <div className="share-url-display">
              <input type="text" value={shareUrl} readOnly />
            </div>
          )}
        </div>
      )}

      {/* Add to Wishlist Modal */}
      {showAddModal && (
        <div className="wishlist-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="wishlist-modal" onClick={e => e.stopPropagation()}>
            <h4>Add to Wishlist</h4>
            <p className="modal-product">{selectedProduct?.title}</p>
            
            <div className="collection-selection">
              <p>Select a collection:</p>
              {collections.map(collection => (
                <button
                  key={collection.id}
                  className="collection-option"
                  onClick={() => handleAddToWishlist(collection.id)}
                  style={{ '--collection-color': collection.color }}
                >
                  <span className="option-dot" style={{ backgroundColor: collection.color }}></span>
                  <span className="option-name">{collection.name}</span>
                </button>
              ))}
            </div>
            
            <button 
              className="modal-cancel"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {showNewCollection && (
        <div className="wishlist-modal-overlay" onClick={() => setShowNewCollection(false)}>
          <div className="wishlist-modal" onClick={e => e.stopPropagation()}>
            <h4>Create New Collection</h4>
            
            <input
              type="text"
              placeholder="Collection name (e.g., 'Tech Gadgets')"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              className="collection-input"
              autoFocus
            />
            
            <div className="modal-actions">
              <button 
                className="modal-create"
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
              >
                Create
              </button>
              <button 
                className="modal-cancel"
                onClick={() => {
                  setShowNewCollection(false)
                  setNewCollectionName('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SmartWishlist
