/**
 * AliSmart Finder v1.0.1 — Smart Price Comparison & Seller Reliability
 * Content Script — Runs on AliExpress search results and category pages
 * 
 * @fileoverview Content script for AliSmart Finder extension.
 * This script injects UI components into AliExpress pages while maintaining
 * strict isolation from the host page's CSS and JavaScript to prevent
 * conflicts and ensure Chrome Web Store compliance.
 * 
 * Architecture decisions:
 * - Runs at document_start for early injection capability
 * - Uses requestIdleCallback for non-critical UI to prevent parser-blocking
 * - Creates isolated root container with all: unset to prevent CSS leakage
 * - Uses Shadow DOM-ready container structure for future encapsulation
 * - Vanilla JS only for performance and security
 * 
 * @author AliSmart Engineering Team
 * @version 1.0.1
 * @license MIT
 */

(function () {
  'use strict';

  // Global lock: Prevent multiple script initializations
  if (window.aliSmartLoaded) {
    console.log('[AliSmart] Already loaded, skipping initialization');
    return;
  }
  window.aliSmartLoaded = true;

  // Log module load
  console.log('🚀 AliSmart: ContentScript Loaded');

  // ─── CSS Isolation Constants ───────────────────────────────────────────
  /** @const {string} Root container ID for all extension UI elements */
  const ROOT_CONTAINER_ID = 'alismart-root-container';
  
  /** @const {number} Maximum z-index for overlay UI (topmost layer) */
  const Z_INDEX_MAX = 2147483647;
  
  /** @const {string} CSS reset to isolate extension from host page styles */
  const ISOLATION_STYLES = `
    all: unset !important;
    box-sizing: border-box !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  `;

  // ─── Configuration ───────────────────────────────────────────────────
  const ALISMART_CLASS = 'alismart-product-btn';
  const ALISMART_DATA_ATTR = 'data-alismart-injected';
  const Z_INDEX = 2147483646;

  // Quality thresholds for Israeli shoppers
  const MIN_RATING_THRESHOLD = 4.0;      // Minimum rating to display
  const TOP_RATED_THRESHOLD = 4.5;       // Threshold for "Top Rated" badge
  const BEST_PRICE_COMPARISON_COUNT = 3; // Number of products to compare for savings calc

  // Default shipping cost to Israel when not specified (in USD)
  const DEFAULT_SHIPPING_IL = 5.0;

  // ─── AliExpress Product Card Selectors ───────────────────────────────
  // These cover the main search results and category page layouts
  const PRODUCT_SELECTORS = [
    // Modern AliExpress UI (2024-2025)
    '[data-pl]', // Modern grid items
    '[data-product-id]', // Another common pattern
    // Search results pages
    '.search-item',
    '.search-card-item',
    // Category/flash deal pages
    '.list-item',
    '.product-item',
    // Product card containers
    '.product-card',
    '[class*="ProductCard"]',
    // Grid items in various layouts
    '.grid-item',
    '[class*="gallery-item"]',
    // Item containers
    '.item[role="listitem"]',
    // More specific patterns
    'a[href*="/item/"]',
    // Feed/grid structures
    '[class*="ProductContainer"]',
    // Catch-all for modern AliExpress UI
    '[class*="SearchProductContent"]',
    '[class*="ProductTitle"]'
  ];

  // Monitor processed elements to prevent duplicate detection and re-render loops
  const processedElements = new WeakSet();
  const recentlyProcessed = new Set(); // For debouncing rapid re-detections
  const RENDER_COOLDOWN = 2000; // 2 second cooldown between re-renders of same element

  /**
   * Checks if an element was recently processed (within cooldown period)
   * Prevents re-render loops caused by rapid DOM mutations
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element is in cooldown period
   */
  function isInCooldown(element) {
    const elementId = element.dataset.alismartProcessed;
    if (!elementId) return false;
    return recentlyProcessed.has(elementId);
  }

  /**
   * Marks an element as processed with cooldown to prevent re-render loops
   * @param {HTMLElement} element - Element to mark
   */
  function markWithCooldown(element) {
    const elementId = element.dataset.alismartProcessed;
    if (!elementId) return;
    
    recentlyProcessed.add(elementId);
    processedElements.add(element);
    
    // Remove from cooldown after delay
    setTimeout(() => {
      recentlyProcessed.delete(elementId);
    }, RENDER_COOLDOWN);
  }

  let sidebarInjected = false;
  let zIndexMonitorInterval = null;
  let messageHandler = null;
  let scrollHandler = null;
  let resizeHandler = null;

  // ─── Dynamic Z-Index Escalation ────────────────────────────────────────

  /**
   * Monitors AliExpress's top-layer elements and dynamically escalates
   * our root container z-index to stay above any native modals.
   * AliExpress often uses z-index values like 2147483647.
   */
  function startZIndexMonitor() {
    if (zIndexMonitorInterval) return;

    const container = document.getElementById(ROOT_CONTAINER_ID);
    if (!container) return;

    zIndexMonitorInterval = setInterval(() => {
      // Find the highest z-index in the document
      const allElements = document.querySelectorAll('*');
      let maxZIndex = 0;

      allElements.forEach(el => {
        if (el.id === ROOT_CONTAINER_ID) return;
        const zIndex = parseInt(window.getComputedStyle(el).zIndex);
        if (!isNaN(zIndex) && zIndex > maxZIndex && zIndex < 2147483647) {
          maxZIndex = zIndex;
        }
      });

      // Check for common modal selectors on AliExpress
      const modalSelectors = [
        '[class*="modal"]',
        '[class*="dialog"]',
        '[class*="popup"]',
        '[class*="overlay"]',
        '[class*="drawer"]',
        '[class*="toast"]',
        '[class*="notification"]'
      ];

      modalSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const zIndex = parseInt(window.getComputedStyle(el).zIndex);
            if (!isNaN(zIndex) && zIndex > maxZIndex && zIndex < 2147483647) {
              maxZIndex = zIndex;
            }
          });
        } catch (e) {
          // Selector not valid - skip
        }
      });

      // If we found a higher z-index, escalate our container
      const currentZIndex = parseInt(container.style.zIndex) || Z_INDEX_MAX;
      if (maxZIndex >= currentZIndex - 1) {
        const newZIndex = Math.min(maxZIndex + 1, 2147483647);
        container.style.zIndex = newZIndex;
        log('Z-index escalated to', newZIndex, 'due to competing element');
      }
    }, 500); // Check every 500ms

    log('Z-index monitor started');
  }

  function stopZIndexMonitor() {
    if (zIndexMonitorInterval) {
      clearInterval(zIndexMonitorInterval);
      zIndexMonitorInterval = null;
      log('Z-index monitor stopped');
    }
  }

  /**
   * Cleans up all global event listeners when sidebar closes.
   * Prevents memory leaks and 'looping' behavior.
   */
  function cleanupGlobalListeners() {
    // Remove window message listener
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
      messageHandler = null;
      log('Window message listener removed');
    }
    
    // Remove scroll listener
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler, true);
      scrollHandler = null;
      log('Scroll listener removed');
    }
    
    // Remove resize listener
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
      log('Resize listener removed');
    }
    
    // Stop z-index monitor
    stopZIndexMonitor();
    
    log('All global listeners cleaned up');
  }
  
  /**
   * Sets up global event listeners when sidebar opens.
   * Tracks listeners for proper cleanup on close.
   */
  function setupGlobalListeners() {
    // Clean up any existing listeners first
    cleanupGlobalListeners();
    
    // Setup message handler for cross-frame communication
    messageHandler = (event) => {
      // Handle messages from iframe or parent
      if (event.data && event.data.type && event.data.type.startsWith('ALISMART_')) {
        log('Received message:', event.data.type);
      }
    };
    window.addEventListener('message', messageHandler);
    
    // Setup scroll handler for sidebar positioning
    scrollHandler = () => {
      // Handle scroll events if needed
    };
    window.addEventListener('scroll', scrollHandler, true);
    
    // Setup resize handler
    resizeHandler = () => {
      // Handle resize if needed
    };
    window.addEventListener('resize', resizeHandler);
    
    log('Global listeners setup complete');
  }

  // ─── Price & Rating Utilities ────────────────────────────────────────

  /**
   * Parses a price string to extract numeric value
   * Supports various formats: "$12.99", "12.99 USD", "12,99 €", etc.
   * @param {string} priceStr - Raw price string from API
   * @returns {number} - Parsed price as float, 0 if invalid
   */
  function parsePrice(priceStr) {
    if (!priceStr || typeof priceStr !== 'string') return 0;
    // Remove currency symbols, keep digits, dots, and commas
    const cleaned = priceStr.replace(/[^\d.,]/g, '');
    // Handle European comma decimal separator
    const normalized = cleaned.replace(',', '.');
    const value = parseFloat(normalized);
    return isNaN(value) ? 0 : value;
  }

  /**
   * Calculates the final price including shipping to Israel
   * Israeli shoppers need the total landed cost for accurate comparison
   * @param {Object} product - Product data from API
   * @returns {Object} - { finalPrice, productPrice, shippingCost, savings }
   */
  function calculateFinalPrice(product) {
    // Extract product price from various API field names
    const productPrice = parsePrice(
      product.target_sale_price ||
      product.target_original_price ||
      product.sale_price ||
      product.original_price ||
      product.price ||
      '0'
    );

    // Extract shipping cost - prioritize Israel-specific shipping
    let shippingCost = 0;
    const shippingInfo = product.shipping || product.delivery;

    if (shippingInfo) {
      if (typeof shippingInfo === 'object') {
        // Try to find Israel-specific shipping first
        const ilShipping = shippingInfo.IL || shippingInfo.Israel;
        if (ilShipping && ilShipping.price) {
          shippingCost = parsePrice(ilShipping.price);
        } else if (shippingInfo.price) {
          shippingCost = parsePrice(shippingInfo.price);
        } else if (shippingInfo.freightAmount) {
          shippingCost = parseFloat(shippingInfo.freightAmount) || 0;
        }
      } else if (typeof shippingInfo === 'string') {
        shippingCost = parsePrice(shippingInfo);
      }
    }

    // Check for free shipping indicators
    const hasFreeShipping = product.free_shipping ||
                           product.is_free_shipping ||
                           (shippingInfo && shippingInfo.isFree);

    if (hasFreeShipping && shippingCost === 0) {
      shippingCost = 0;
    }

    // If no shipping info found, use conservative estimate for Israel
    if (shippingCost === 0 && !hasFreeShipping) {
      shippingCost = DEFAULT_SHIPPING_IL;
    }

    const finalPrice = productPrice + shippingCost;

    return {
      finalPrice,
      productPrice,
      shippingCost,
      hasFreeShipping: shippingCost === 0
    };
  }

  /**
   * Extracts rating value from product data
   * @param {Object} product - Product data
   * @returns {number} - Rating 0-5, 0 if not available
   */
  function extractRating(product) {
    const rating = product.evaluate_rate ||
                   product.rating ||
                   product.star ||
                   product.product_average_star ||
                   product.avg_rating;

    if (!rating) return 0;

    // Handle percentage format (e.g., "92%" -> 4.6 stars)
    if (typeof rating === 'string' && rating.includes('%')) {
      const percent = parseFloat(rating.replace('%', ''));
      return (percent / 100) * 5;
    }

    const numRating = parseFloat(rating);
    return isNaN(numRating) ? 0 : numRating;
  }

  /**
   * Determines which value badges a product should display
   * @param {Object} product - Enriched product with priceData
   * @param {number} index - Position in sorted results
   * @param {Array} allProducts - All products for comparison
   * @returns {Array} - Array of badge types: 'best-price', 'top-rated', 'value-pick'
   */
  function getProductBadges(product, index, allProducts) {
    const badges = [];
    const rating = extractRating(product);

    // Best Price: First item in sorted (cheapest final price)
    if (index === 0 && allProducts.length > 1) {
      badges.push('best-price');
    }

    // Top Rated: High rating with sufficient confidence
    if (rating >= TOP_RATED_THRESHOLD && product.orders > 10) {
      badges.push('top-rated');
    }

    // Value Pick: Good balance of price and rating
    if (index < 3 && rating >= 4.3 && product.orders > 20) {
      badges.push('value-pick');
    }

    return badges;
  }

  /**
   * Calculates savings compared to the most expensive option
   * @param {number} finalPrice - Product's final price
   * @param {Array} allProducts - All products for comparison
   * @returns {string} - Formatted savings string
   */
  function calculateSavings(finalPrice, allProducts) {
    if (!allProducts || allProducts.length < 2) return '';

    const maxPrice = Math.max(...allProducts.map(p => p.priceData?.finalPrice || 0));
    if (maxPrice <= finalPrice) return '';

    const savings = maxPrice - finalPrice;
    const savingsPercent = Math.round((savings / maxPrice) * 100);

    return `Save ${savingsPercent}%`;
  }

  /**
   * Filters and ranks products by value for Israeli shoppers
   * Logic: Remove low-rated, sort by final price, boost high-rated
   * @param {Array} products - Raw products from API
   * @returns {Array} - Filtered and sorted products with enriched data
   */
  function rankProductsByValue(products) {
    if (!products || !Array.isArray(products)) return [];

    // Step 1: Enrich products with calculated data and filter by quality
    const enriched = products
      .map(product => {
        const priceData = calculateFinalPrice(product);
        const rating = extractRating(product);
        const orders = parseInt(product.orders || product.sales || product.sold || 0);

        return {
          ...product,
          priceData,
          rating,
          orders,
          _qualityScore: (rating * 20) + Math.min(orders / 100, 20) // Internal ranking metric
        };
      })
      .filter(product => {
        // Quality gate: Must have rating above threshold or many orders as safety
        const hasGoodRating = product.rating >= MIN_RATING_THRESHOLD;
        const hasHighVolume = product.orders > 50 && product.rating >= 3.5;
        const isNewProduct = product.orders < 5 && product.rating === 0; // Allow unrated new items

        return hasGoodRating || hasHighVolume || isNewProduct;
      });

    // Step 2: Sort by final price (primary) and quality score (secondary)
    const sorted = enriched.sort((a, b) => {
      const priceDiff = a.priceData.finalPrice - b.priceData.finalPrice;
      if (Math.abs(priceDiff) > 0.5) return priceDiff; // Significant price difference

      // Similar prices: prefer higher rated
      return b._qualityScore - a._qualityScore;
    });

    // Step 3: Assign badges based on final ranking
    return sorted.map((product, index) => ({
      ...product,
      badges: getProductBadges(product, index, sorted),
      rank: index + 1,
      savingsText: index === 0 ? calculateSavings(product.priceData.finalPrice, sorted) : ''
    }));
  }
  function log(...args) {
    console.log('[AliSmart]', ...args);
  }

  // ─── Root Container & CSS Isolation ───────────────────────────────────
  
  /**
   * Creates an isolated root container for all extension UI elements.
   * Uses Shadow DOM for full CSS isolation to prevent AliExpress's CSS
   * from affecting our UI and vice versa. This prevents clipping issues.
   * Uses all: initial on root container to reset inherited styles.
   * 
   * @returns {HTMLElement} The isolated root container element
   */
  function createIsolatedRootContainer() {
    const existing = document.getElementById(ROOT_CONTAINER_ID);
    if (existing) return existing;

    const container = document.createElement('div');
    container.id = ROOT_CONTAINER_ID;
    
    // CRITICAL: Apply all: initial to reset ALL inherited styles from AliExpress
    // This ensures our extension UI is completely isolated from host page CSS
    container.style.cssText = `
      all: initial !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: ${Z_INDEX_MAX} !important;
      pointer-events: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      background: transparent !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    `;
    
    // Create Shadow DOM for CSS isolation
    const shadow = container.attachShadow({ mode: 'open' });
    
    // Add comprehensive reset styles to shadow DOM
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      /* Reset ALL inherited styles at shadow root */
      :host {
        all: initial !important;
        box-sizing: border-box !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      
      /* Ensure all elements in shadow DOM have pointer-events auto */
      * {
        pointer-events: auto !important;
        box-sizing: border-box !important;
      }
      
      /* Comprehensive reset for all AliSmart elements */
      div, button, span, a, img, svg, p, h1, h2, h3, h4, h5, h6,
      input, textarea, select, label, form, ul, ol, li {
        all: unset !important;
        box-sizing: border-box !important;
        font-family: inherit !important;
      }
      
      /* Restore basic display properties */
      div { display: block !important; }
      button { display: inline-flex !important; }
      span { display: inline !important; }
      a { display: inline !important; text-decoration: none !important; }
      img { display: inline-block !important; }
      svg { display: inline-block !important; }
      p { display: block !important; margin: 0 !important; }
    `;
    shadow.appendChild(styleSheet);
    
    // Store reference to shadow root for element injection
    container._shadowRoot = shadow;
    
    // Container holds all extension UI - append to documentElement to avoid body overflow clipping
    document.documentElement.appendChild(container);
    
    log('Isolated root container with Shadow DOM created (CSS isolated with all: initial)');
    return container;
  }

  /**
   * Gets the shadow root for injecting UI elements.
   * 
   * @returns {ShadowRoot|null} The shadow root or null if not ready
   */
  function getShadowRoot() {
    const container = getRootContainer();
    return container ? container._shadowRoot : null;
  }

  /**
   * Gets or creates the root container for extension UI elements.
   * Lazy initialization ensures DOM is ready before container creation.
   * 
   * @returns {HTMLElement|null} The root container or null if documentElement not ready
   */
  function getRootContainer() {
    if (!document.documentElement) return null;
    return createIsolatedRootContainer();
  }

  // DEBUG MODE: Simplified high-visibility sidebar for troubleshooting
  function injectDebugSidebar() {
    if (sidebarInjected) return;
    
    const shadow = getShadowRoot();
    if (!shadow) {
      console.error('[AliSmart DEBUG] Cannot inject - no shadow root');
      return;
    }
    
    if (shadow.getElementById('ali-smart-sidebar')) {
      sidebarInjected = true;
      return;
    }
    
    // HIGH VISIBILITY DEBUG STYLES
    const debugStyles = document.createElement('style');
    debugStyles.textContent = `
      #ali-smart-sidebar {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        width: 300px !important;
        height: 100vh !important;
        background: #ff0000 !important;
        border: 10px solid #00ff00 !important;
        z-index: 2147483647 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .debug-content {
        padding: 20px;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 18px;
        font-weight: bold;
      }
      .debug-btn {
        background: #00ff00;
        color: black;
        padding: 10px 20px;
        border: none;
        cursor: pointer;
        font-size: 16px;
        margin-top: 20px;
      }
    `;
    shadow.appendChild(debugStyles);
    
    // SIMPLE DEBUG SIDEBAR HTML
    const sidebar = document.createElement('div');
    sidebar.id = 'ali-smart-sidebar';
    sidebar.innerHTML = `
      <div class="debug-content">
        <h2>🐛 DEBUG MODE</h2>
        <p>AliSmart Sidebar</p>
        <p>If you can see this, the UI is working!</p>
        <button class="debug-btn" id="debug-close">Close Debug</button>
      </div>
    `;
    shadow.appendChild(sidebar);

    // Create TOP POPUP notification bar with icon
    const topPopup = document.createElement('div');
    topPopup.id = 'ali-smart-top-popup';
    topPopup.className = ''; // Visible by default
    topPopup.innerHTML = `
      <div class="as-top-popup-inner">
        <svg class="as-icon-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span>AliSmart Alert</span>
      </div>
    `;
    shadow.appendChild(topPopup);
    
    // Add click handler for top popup
    topPopup.addEventListener('click', () => {
      const sb = shadow.getElementById('ali-smart-sidebar');
      if (sb) {
        sb.style.display = sb.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Simple close handler
    shadow.getElementById('debug-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.style.display = 'none';
    });
    
    sidebarInjected = true;
    console.log('[AliSmart DEBUG] Debug sidebar injected - CHECK SCREEN NOW');
  }

  // ALIAS for backward compatibility - fixes ReferenceError
  function injectSidebarIfNeeded() {
    injectDebugSidebar();
  }

  // Original complex sidebar - ACTIVE FOR PRODUCT DISPLAY (kept for reference)
  function injectSidebarIfNeeded_ORIGINAL() {
    if (sidebarInjected) return;

    // Check if sidebar already exists in shadow DOM
    const shadow = getShadowRoot();
    if (!shadow) {
      log('Cannot inject sidebar: shadow root not available');
      return;
    }
    
    if (shadow.getElementById('ali-smart-sidebar')) {
      sidebarInjected = true;
      return;
    }

    // Inject CSS styles into Shadow DOM
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      /* Sidebar Container - ULTRA PREMIUM Glassmorphism Dark Theme */
      #ali-smart-sidebar {
        position: fixed !important;
        top: 0 !important;
        right: -420px !important;
        width: 400px !important;
        height: 100vh !important;
        background: linear-gradient(160deg, 
          rgba(25, 25, 45, 0.98) 0%, 
          rgba(15, 15, 35, 0.99) 50%, 
          rgba(10, 10, 30, 0.995) 100%) !important;
        backdrop-filter: blur(30px) saturate(250%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(250%) !important;
        border-left: 1px solid rgba(255, 255, 255, 0.15) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
        box-shadow: 
          -20px 0 60px rgba(0, 0, 0, 0.8),
          -8px 0 40px rgba(238, 9, 121, 0.2),
          inset 0 0 0 1px rgba(255, 255, 255, 0.1),
          inset 0 0 40px rgba(255, 106, 0, 0.08) !important;
        z-index: 2147483646 !important;
        transition: right 0.6s cubic-bezier(0.16, 1, 0.3, 1) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      
      #ali-smart-sidebar::before {
        content: '' !important;
        position: absolute !important;
        top: -50% !important;
        left: -50% !important;
        width: 200% !important;
        height: 200% !important;
        background: radial-gradient(circle at 30% 20%, rgba(255, 106, 0, 0.03) 0%, transparent 50%),
                    radial-gradient(circle at 70% 80%, rgba(238, 9, 121, 0.02) 0%, transparent 50%) !important;
        pointer-events: none !important;
        z-index: -1 !important;
      }
      
      #ali-smart-sidebar.open {
        right: 0 !important;
      }
      
      /* Header - ULTRA PREMIUM Glass Effect */
      .as-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 28px 32px !important;
        background: linear-gradient(180deg, 
          rgba(255,255,255,0.1) 0%, 
          rgba(255,255,255,0.03) 50%,
          rgba(255,255,255,0.01) 100%) !important;
        backdrop-filter: blur(25px) !important;
        -webkit-backdrop-filter: blur(25px) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
        flex-shrink: 0 !important;
        position: relative !important;
        overflow: hidden !important;
      }
      
      .as-header::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 2px !important;
        background: linear-gradient(90deg, 
          transparent 0%, 
          rgba(255,106,0,0.8) 20%, 
          rgba(238,9,121,0.8) 50%, 
          rgba(255,106,0,0.8) 80%, 
          transparent 100%) !important;
        box-shadow: 0 0 10px rgba(255,106,0,0.5) !important;
      }
      
      .as-header::after {
        content: '' !important;
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 1px !important;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent) !important;
      }
      
      .as-logo {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        font-size: 26px !important;
        font-weight: 900 !important;
        background: linear-gradient(135deg, #ff6a00 0%, #ff8c42 20%, #ff6a00 40%, #ee0979 60%, #ff6a00 80%, #ff8c42 100%) !important;
        background-size: 400% 400% !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        letter-spacing: -0.5px !important;
        animation: gradientShift 3s ease infinite !important;
        text-shadow: 0 0 40px rgba(255,106,0,0.5) !important;
        position: relative !important;
        filter: drop-shadow(0 0 15px rgba(238, 9, 121, 0.4)) !important;
      }
      
      .as-logo::after {
        content: '' !important;
        position: absolute !important;
        bottom: -4px !important;
        left: 0 !important;
        right: 0 !important;
        height: 2px !important;
        background: linear-gradient(90deg, transparent, #ff6a00, #ee0979, #ff6a00, transparent) !important;
        animation: shimmer 2s infinite !important;
      }
      
      @keyframes gradientShift {
        0% { background-position: 0% 50%; filter: drop-shadow(0 0 10px rgba(255,106,0,0.3)); }
        50% { background-position: 100% 50%; filter: drop-shadow(0 0 20px rgba(238,9,121,0.5)); }
        100% { background-position: 0% 50%; filter: drop-shadow(0 0 10px rgba(255,106,0,0.3)); }
      }
      
      .as-logo::before {
        content: '🔮' !important;
        font-size: 22px !important;
        -webkit-text-fill-color: initial !important;
        filter: drop-shadow(0 0 12px rgba(255,106,0,0.8)) !important;
        animation: crystal 3s ease-in-out infinite !important;
        margin-right: 4px !important;
      }
      
      @keyframes crystal {
        0%, 100% { transform: scale(1) rotate(0deg) translateY(0); filter: drop-shadow(0 0 8px rgba(255,106,0,0.6)); }
        25% { transform: scale(1.05) rotate(-5deg) translateY(-2px); filter: drop-shadow(0 0 15px rgba(255,106,0,0.9)); }
        50% { transform: scale(1.1) rotate(0deg) translateY(-4px); filter: drop-shadow(0 0 20px rgba(238,9,121,0.8)); }
        75% { transform: scale(1.05) rotate(5deg) translateY(-2px); filter: drop-shadow(0 0 15px rgba(255,106,0,0.9)); }
      }
      
      .as-badge {
        font-size: 10px !important;
        font-weight: 800 !important;
        padding: 5px 12px !important;
        background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%) !important;
        border-radius: 20px !important;
        -webkit-text-fill-color: white !important;
        text-transform: uppercase !important;
        letter-spacing: 1px !important;
        box-shadow: 
          0 4px 15px rgba(238, 9, 121, 0.5),
          0 0 0 1px rgba(255,255,255,0.2) inset !important;
        position: relative !important;
        overflow: hidden !important;
        animation: pulseBadge 2s ease-in-out infinite !important;
      }
      
      @keyframes pulseBadge {
        0%, 100% { box-shadow: 0 4px 15px rgba(238, 9, 121, 0.5), 0 0 0 1px rgba(255,255,255,0.2) inset; }
        50% { box-shadow: 0 6px 25px rgba(238, 9, 121, 0.7), 0 0 0 1px rgba(255,255,255,0.3) inset; }
      }
      
      .as-badge::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: -100% !important;
        width: 100% !important;
        height: 100% !important;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent) !important;
        animation: shimmer 2s infinite !important;
      }
      
      @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }
      
      .as-close-btn {
        width: 40px !important;
        height: 40px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(255, 255, 255, 0.1) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 12px !important;
        color: rgba(255, 255, 255, 0.8) !important;
        font-size: 24px !important;
        font-weight: 300 !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        position: relative !important;
        overflow: hidden !important;
      }
      
      .as-close-btn::before {
        content: '' !important;
        position: absolute !important;
        inset: 0 !important;
        background: linear-gradient(135deg, rgba(255,106,0,0.3), rgba(238,9,121,0.3)) !important;
        opacity: 0 !important;
        transition: opacity 0.3s ease !important;
      }
      
      .as-close-btn:hover {
        background: rgba(255, 255, 255, 0.15) !important;
        border-color: rgba(255, 106, 0, 0.6) !important;
        color: white !important;
        transform: rotate(90deg) scale(1.05) !important;
        box-shadow: 
          0 0 20px rgba(255,106,0,0.4),
          inset 0 0 10px rgba(255,106,0,0.1) !important;
      }
      
      .as-close-btn:hover::before {
        opacity: 1 !important;
      }
      
      /* Content Area */
      .as-content {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 20px !important;
        color: white !important;
      }
      
      .as-content::-webkit-scrollbar {
        width: 6px !important;
      }
      
      .as-content::-webkit-scrollbar-track {
        background: transparent !important;
      }
      
      .as-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15) !important;
        border-radius: 3px !important;
      }
      
      .as-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25) !important;
      }
      
      /* Search Info */
      .as-search-info {
        margin-bottom: 20px !important;
      }
      
      .as-source-product {
        display: flex !important;
        gap: 14px !important;
        padding: 16px !important;
        background: rgba(255, 255, 255, 0.05) !important;
        backdrop-filter: blur(8px) !important;
        border-radius: 16px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      
      .as-source-image {
        width: 64px !important;
        height: 64px !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        flex-shrink: 0 !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      
      .as-source-image img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }
      
      .as-source-details {
        flex: 1 !important;
        min-width: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
      }
      
      .as-source-label {
        font-size: 11px !important;
        color: rgba(255, 255, 255, 0.5) !important;
        margin: 0 0 6px 0 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }
      
      .as-source-title {
        font-size: 14px !important;
        color: white !important;
        margin: 0 !important;
        line-height: 1.4 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        font-weight: 500 !important;
      }
      
      /* Loading State - Futuristic */
      .as-loading {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 60px 20px !important;
        text-align: center !important;
      }
      
      .as-loading.hidden {
        display: none !important;
      }
      
      .as-spinner {
        width: 48px !important;
        height: 48px !important;
        border: 3px solid rgba(255, 255, 255, 0.1) !important;
        border-top-color: #ff6a00 !important;
        border-right-color: #ee0979 !important;
        border-radius: 50% !important;
        animation: spin 0.8s linear infinite !important;
        margin-bottom: 20px !important;
        position: relative !important;
      }
      
      .as-spinner::after {
        content: '' !important;
        position: absolute !important;
        inset: -5px !important;
        border-radius: 50% !important;
        border: 2px solid transparent !important;
        border-top-color: rgba(255, 106, 0, 0.3) !important;
        animation: spin 1.2s linear infinite reverse !important;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .as-loading p {
        color: rgba(255, 255, 255, 0.6) !important;
        font-size: 14px !important;
        margin: 0 !important;
        font-weight: 500 !important;
      }
      
      /* Toggle Button */
      #ali-smart-toggle {
        position: fixed !important;
        top: 50% !important;
        right: 0 !important;
        transform: translateY(-50%) !important;
        z-index: 2147483646 !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
      }
      
      #ali-smart-toggle.hidden {
        opacity: 0 !important;
        pointer-events: none !important;
        right: -60px !important;
      }
      
      .as-toggle-inner {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 14px 18px !important;
        background: linear-gradient(135deg, rgba(255, 106, 0, 0.95) 0%, rgba(238, 9, 121, 0.95) 100%) !important;
        color: white !important;
        border-radius: 12px 0 0 12px !important;
        box-shadow: 0 4px 20px rgba(238, 9, 121, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2) inset !important;
        font-weight: 700 !important;
        font-size: 13px !important;
        backdrop-filter: blur(10px) !important;
        transition: all 0.3s ease !important;
      }
      
      .as-toggle-inner:hover {
        padding-right: 28px !important;
        box-shadow: 0 8px 30px rgba(238, 9, 121, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.3) inset !important;
        transform: translateX(-4px) !important;
      }
      
      /* Top Popup / Notification Bar - Ultra Premium glassmorphism */
      #ali-smart-top-popup {
        position: fixed !important;
        top: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 2147483646 !important;
        cursor: pointer !important;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
        filter: drop-shadow(0 8px 32px rgba(238, 9, 121, 0.4)) !important;
      }
      
      #ali-smart-top-popup.hidden {
        opacity: 0 !important;
        pointer-events: none !important;
        transform: translateX(-50%) translateY(-100px) !important;
      }
      
      .as-top-popup-inner {
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
        padding: 16px 32px !important;
        background: linear-gradient(135deg, rgba(30, 30, 50, 0.98) 0%, rgba(22, 22, 45, 0.99) 100%) !important;
        color: white !important;
        border-radius: 50px !important;
        border: 1px solid rgba(255, 106, 0, 0.5) !important;
        box-shadow: 
          0 8px 32px rgba(238, 9, 121, 0.3),
          0 0 0 1px rgba(255, 255, 255, 0.1) inset,
          0 0 30px rgba(255, 106, 0, 0.15),
          inset 0 0 20px rgba(255, 106, 0, 0.05) !important;
        font-weight: 600 !important;
        font-size: 15px !important;
        backdrop-filter: blur(25px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(25px) saturate(200%) !important;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        letter-spacing: 0.3px !important;
        position: relative !important;
        overflow: hidden !important;
      }
      
      .as-top-popup-inner::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: -100% !important;
        width: 100% !important;
        height: 100% !important;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent) !important;
        transition: left 0.6s ease !important;
      }
      
      .as-top-popup-inner:hover::before {
        left: 100% !important;
      }
      
      .as-top-popup-inner:hover {
        transform: scale(1.05) !important;
        box-shadow: 
          0 12px 40px rgba(238, 9, 121, 0.5),
          0 0 0 2px rgba(255, 106, 0, 0.6) inset,
          0 0 40px rgba(255, 106, 0, 0.2) !important;
        border-color: rgba(255, 106, 0, 0.8) !important;
      }
      
      .as-top-popup-inner svg {
        width: 24px !important;
        height: 24px !important;
        stroke: #ff6a00 !important;
        stroke-width: 2.5 !important;
        filter: drop-shadow(0 0 10px rgba(255, 106, 0, 0.9)) !important;
      }
      
      .as-top-popup-inner .as-icon-bell {
        animation: bellRing 2s ease-in-out infinite !important;
      }
      
      @keyframes bellRing {
        0%, 100% { transform: rotate(0deg); }
        10%, 30%, 50% { transform: rotate(15deg); }
        20%, 40% { transform: rotate(-15deg); }
      }
      
      /* Close button for top popup */
      .as-top-popup-close {
        position: absolute !important;
        top: -8px !important;
        right: -8px !important;
        width: 24px !important;
        height: 24px !important;
        background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%) !important;
        border: 2px solid white !important;
        border-radius: 50% !important;
        color: white !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 4px 12px rgba(238, 9, 121, 0.5) !important;
        transition: all 0.2s ease !important;
        z-index: 1 !important;
      }
      
      .as-top-popup-close:hover {
        transform: scale(1.1) !important;
        box-shadow: 0 6px 20px rgba(238, 9, 121, 0.7) !important;
      }
      
      /* Results */
      .as-results {
        display: flex !important;
        flex-direction: column !important;
        gap: 14px !important;
      }
      
      /* Empty State - Futuristic */
      .as-empty-state {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 60px 30px !important;
        text-align: center !important;
        background: rgba(255, 255, 255, 0.03) !important;
        backdrop-filter: blur(8px) !important;
        border-radius: 20px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        margin: 20px 0 !important;
      }
      
      .as-empty-state svg {
        width: 64px !important;
        height: 64px !important;
        margin-bottom: 20px !important;
        opacity: 0.4 !important;
        stroke: url(#gradient) !important;
      }
      
      .as-empty-state p:first-of-type {
        font-size: 16px !important;
        font-weight: 600 !important;
        color: white !important;
        margin: 0 0 8px 0 !important;
      }
      
      .as-hint {
        font-size: 13px !important;
        color: rgba(255, 255, 255, 0.5) !important;
        margin: 4px 0 !important;
        line-height: 1.5 !important;
      }
      
      .as-retry-btn {
        margin-top: 20px !important;
        padding: 12px 24px !important;
        background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%) !important;
        border: none !important;
        border-radius: 10px !important;
        color: white !important;
        font-weight: 600 !important;
        font-size: 13px !important;
        cursor: pointer !important;
        transition: all 0.25s ease !important;
        box-shadow: 0 4px 15px rgba(238, 9, 121, 0.4) !important;
      }
      
      .as-retry-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 25px rgba(238, 9, 121, 0.5) !important;
      }
      
      /* Product Cards - Glass Effect */
      .as-product-card {
        display: block !important;
        background: rgba(255, 255, 255, 0.05) !important;
        backdrop-filter: blur(8px) !important;
        border-radius: 16px !important;
        padding: 14px !important;
        text-decoration: none !important;
        color: inherit !important;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        overflow: hidden !important;
      }
      
      .as-product-card:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
        transform: translateY(-3px) !important;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3) !important;
      }
      
      .as-product-card.as-best-deal {
        border: 1px solid rgba(255, 106, 0, 0.4) !important;
        background: linear-gradient(135deg, rgba(255, 106, 0, 0.1) 0%, rgba(238, 9, 121, 0.05) 100%) !important;
      }
      
      /* Product Image Styling with High Quality Rendering */
      .as-product-image-wrapper {
        position: relative !important;
        width: 100% !important;
        height: 170px !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        margin-bottom: 14px !important;
        background: rgba(0, 0, 0, 0.2) !important;
      }
      
      .as-product-image-wrapper img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        image-rendering: -webkit-optimize-contrast !important;
        image-rendering: crisp-edges !important;
        transition: transform 0.3s ease !important;
        filter: contrast(1.05) saturate(1.1) !important;
      }
      
      /* Image Error State with Placeholder */
      .as-product-image-wrapper.img-error {
        background: linear-gradient(135deg, rgba(255, 106, 0, 0.1) 0%, rgba(238, 9, 121, 0.05) 100%) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      .as-product-image-wrapper.img-error::before {
        content: '📷' !important;
        font-size: 48px !important;
        opacity: 0.5 !important;
      }
      
      /* Image Fallback State - Shows when image fails to load */
      .as-product-image-wrapper.img-fallback {
        background: #f5f5f5 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      .as-product-image-wrapper.img-fallback img {
        object-fit: contain !important;
        padding: 20px !important;
      }
      
      .as-product-card:hover .as-product-image-wrapper img {
        transform: scale(1.05) !important;
      }
      
      .as-product-title {
        font-size: 14px !important;
        color: white !important;
        margin: 0 0 10px 0 !important;
        line-height: 1.4 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        font-weight: 500 !important;
      }
      
      .as-product-info {
        color: white !important;
      }
      
      /* Trust Badges */
      .as-trust-high { background: linear-gradient(135deg, #00d084 0%, #00b368 100%) !important; }
      .as-trust-medium { background: linear-gradient(135deg, #ffa500 0%, #ff8c00 100%) !important; }
      .as-trust-low { background: linear-gradient(135deg, #888 0%, #666 100%) !important; }
      .as-trust-unknown { background: linear-gradient(135deg, #666 0%, #444 100%) !important; }
      
      .as-trust-badge {
        display: inline-block !important;
        padding: 4px 10px !important;
        border-radius: 6px !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        color: white !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }
      
      .as-best-value-badge {
        display: inline-block !important;
        padding: 4px 10px !important;
        border-radius: 6px !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        background: linear-gradient(135deg, #00d084 0%, #00b368 100%) !important;
        color: white !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }
      
      /* Price Display */
      .as-price-breakdown {
        margin-top: 12px !important;
        padding-top: 12px !important;
        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      
      .as-price-line {
        display: flex !important;
        justify-content: space-between !important;
        font-size: 13px !important;
        margin-bottom: 6px !important;
      }
      
      .as-price-label {
        color: rgba(255, 255, 255, 0.5) !important;
      }
      
      .as-price-value {
        color: rgba(255, 255, 255, 0.9) !important;
        font-weight: 500 !important;
      }
      
      .as-total-line {
        font-weight: 600 !important;
        margin-top: 8px !important;
        padding-top: 8px !important;
        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      
      .as-total-value {
        background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        font-weight: 700 !important;
        font-size: 16px !important;
      }
      
      /* Meta Row */
      .as-meta-row {
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
        margin-top: 10px !important;
        font-size: 12px !important;
      }
      
      .as-rating {
        color: #ffa500 !important;
        font-weight: 600 !important;
      }
      
      .as-orders {
        color: rgba(255, 255, 255, 0.5) !important;
      }
      
      .as-badges-row {
        display: flex !important;
        gap: 8px !important;
        margin-bottom: 10px !important;
      }
      
      .as-rank-badge {
        position: absolute !important;
        top: 10px !important;
        left: 10px !important;
        padding: 6px 12px !important;
        background: rgba(0, 0, 0, 0.7) !important;
        backdrop-filter: blur(4px) !important;
        border-radius: 8px !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        color: white !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
      }
      
      /* Skeleton Loading Animation */
      .as-skeleton {
        display: flex !important;
        gap: 14px !important;
        padding: 14px !important;
        background: rgba(255, 255, 255, 0.03) !important;
        border-radius: 16px !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        animation: skeletonPulse 2s ease-in-out infinite !important;
      }
      
      @keyframes skeletonPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      
      .as-skeleton-img {
        width: 80px !important;
        height: 80px !important;
        border-radius: 12px !important;
        background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%) !important;
        background-size: 200% 100% !important;
        animation: skeletonShimmer 1.5s infinite !important;
      }
      
      .as-skeleton-info {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
      }
      
      .as-skeleton-line {
        height: 12px !important;
        border-radius: 6px !important;
        background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%) !important;
        background-size: 200% 100% !important;
        animation: skeletonShimmer 1.5s infinite !important;
      }
      
      .as-skeleton-line.short { width: 60% !important; }
      .as-skeleton-line.tiny { width: 40% !important; height: 10px !important; }
      
      @keyframes skeletonShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      /* Progress Bar */
      .as-progress-bar {
        height: 3px !important;
        background: rgba(255, 255, 255, 0.1) !important;
        border-radius: 3px !important;
        margin-bottom: 20px !important;
        overflow: hidden !important;
        position: relative !important;
      }
      
      .as-progress-bar::after {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        height: 100% !important;
        width: 30% !important;
        background: linear-gradient(90deg, #ff6a00 0%, #ee0979 100%) !important;
        border-radius: 3px !important;
        animation: progressSlide 1.5s ease-in-out infinite !important;
      }
      
      @keyframes progressSlide {
        0% { left: -30%; }
        100% { left: 100%; }
      }
      
      /* Fade In Animation */
      .as-fade-in {
        animation: fadeIn 0.4s ease-out !important;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    shadow.appendChild(styleSheet);

    // Create sidebar HTML structure
    const sidebar = document.createElement('div');
    sidebar.id = 'ali-smart-sidebar';
    sidebar.innerHTML = `
      <svg width="0" height="0" style="position:absolute;">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ff6a00;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ee0979;stop-opacity:1" />
          </linearGradient>
        </defs>
      </svg>
      <div class="as-header">
        <div class="as-logo">
          <span>AliSmart</span>
          <span class="as-badge">Finder</span>
        </div>
        <button id="as-close-btn" class="as-close-btn" title="Close">×</button>
      </div>
      <div class="as-content">
        <div id="as-search-info" class="as-search-info"></div>
        <div id="as-results" class="as-results"></div>
        <div id="as-loading" class="as-loading hidden">
          <div class="as-spinner"></div>
          <p>Searching for similar items...</p>
        </div>
      </div>
    `;
    shadow.appendChild(sidebar);

    // Create toggle button
    const toggle = document.createElement('div');
    toggle.id = 'ali-smart-toggle';
    toggle.className = 'hidden';
    toggle.innerHTML = `
      <div class="as-toggle-inner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <span>AliSmart</span>
      </div>
    `;
    shadow.appendChild(toggle);

    // Add event listeners (using shadow.getElementById)
    shadow.getElementById('as-close-btn')?.addEventListener('click', closeSidebar);
    toggle.addEventListener('click', () => {
      const sb = shadow.getElementById('ali-smart-sidebar');
      if (sb?.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    sidebarInjected = true;
    log('Sidebar injected into Shadow DOM with styles');
  }

  function openSidebar() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const sidebar = shadow.getElementById('ali-smart-sidebar');
    const toggle = shadow.getElementById('ali-smart-toggle');
    if (sidebar) sidebar.classList.add('open');
    if (toggle) toggle.classList.add('hidden');
    
    // Start z-index monitor when sidebar opens
    startZIndexMonitor();
    
    // Ensure root container has pointer-events: auto when sidebar is open
    const container = document.getElementById(ROOT_CONTAINER_ID);
    if (container) {
      container.style.pointerEvents = 'auto';
    }
  }

  function closeSidebar() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const sidebar = shadow.getElementById('ali-smart-sidebar');
    const toggle = shadow.getElementById('ali-smart-toggle');
    if (sidebar) sidebar.classList.remove('open');
    if (toggle) toggle.classList.remove('hidden');
    
    // Stop z-index monitor when sidebar closes
    stopZIndexMonitor();
    
    // Reset root container to pointer-events: none when sidebar is closed
    // This allows clicks to pass through to the page
    const container = document.getElementById(ROOT_CONTAINER_ID);
    if (container) {
      container.style.pointerEvents = 'none';
    }
  }

  function showLoading() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const loading = shadow.getElementById('as-loading');
    const results = shadow.getElementById('as-results');
    if (loading) loading.classList.remove('hidden');
    if (results) results.innerHTML = '';
  }

  function hideLoading() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const loading = shadow.getElementById('as-loading');
    if (loading) loading.classList.add('hidden');
  }

  function displaySearchInfo(title, imgUrl) {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const info = shadow.getElementById('as-search-info');
    if (!info) return;

    const truncatedTitle = title.length > 60 ? title.substring(0, 60) + '...' : title;
    info.innerHTML = `
      <div class="as-source-product">
        <div class="as-source-image">
          <img src="${imgUrl}" alt="Source product" 
            onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22><rect fill=%22%23f0f0f0%22 width=%2264%22 height=%2264%22/><text fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>📷</text></svg>';">
        </div>
        <div class="as-source-details">
          <p class="as-source-label">Searching similar to:</p>
          <p class="as-source-title">${escapeHtml(truncatedTitle)}</p>
        </div>
      </div>
    `;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Calculates total price (item + shipping) and sorts products by total cost.
   * Products with missing data are placed at the bottom of the list.
   * 
   * @param {Array} products - Array of product objects with priceValue and shippingValue
   * @returns {Array} Sorted array with totalPrice added to each product
   */
  function calculateTotalAndSort(products) {
    if (!products || !Array.isArray(products)) return [];
    
    // Calculate total for each product and add ranking data
    const productsWithTotal = products.map(product => {
      const price = product.priceValue || 0;
      const shipping = product.shippingValue || 0;
      const hasPrice = price > 0;
      const hasShippingInfo = product.shipping && product.shipping !== 'Check website';
      
      return {
        ...product,
        totalPrice: hasPrice ? (price + shipping) : Infinity,
        hasCompleteData: hasPrice && hasShippingInfo
      };
    });
    
    // Sort: complete data first (by total price), then incomplete data
    const sorted = productsWithTotal.sort((a, b) => {
      // If both have complete data, sort by total price
      if (a.hasCompleteData && b.hasCompleteData) {
        return a.totalPrice - b.totalPrice;
      }
      // Products with incomplete data go to the bottom
      if (!a.hasCompleteData && b.hasCompleteData) return 1;
      if (a.hasCompleteData && !b.hasCompleteData) return -1;
      // Both incomplete - sort by what we have
      return a.totalPrice - b.totalPrice;
    });
    
    // Add rank field for badge display
    return sorted.map((product, index) => ({
      ...product,
      rank: index + 1
    }));
  }

  /**
   * Calculates trust level based on rating and sales count.
   * Trust levels: high (green), medium (yellow), low (gray/red)
   * 
   * @param {{rating: number, salesCount: number}} product - Product with rating and sales data
   * @returns {{level: string, label: string, className: string}} Trust level info
   */
  function calculateTrustLevel(product) {
    const rating = product.rating || 0;
    const sales = product.salesCount || 0;
    
    // High Trust: 4.8+ stars and 500+ sales
    if (rating >= 4.8 && sales >= 500) {
      return {
        level: 'high',
        label: 'Top Rated',
        className: 'as-trust-high'
      };
    }
    
    // Medium Trust: 4.5-4.7 stars OR 100-499 sales with good rating
    if ((rating >= 4.5 && rating < 4.8) || 
        (rating >= 4.5 && sales >= 100 && sales < 500)) {
      return {
        level: 'medium',
        label: 'Verified',
        className: 'as-trust-medium'
      };
    }
    
    // Low Trust: below 4.4 stars OR no sales history
    if (rating > 0 && rating < 4.5) {
      return {
        level: 'low',
        label: 'New Seller',
        className: 'as-trust-low'
      };
    }
    
    // No rating data available
    return {
      level: 'unknown',
      label: 'New Seller',
      className: 'as-trust-unknown'
    };
  }

  /**
   * Updates the anchor product display and comparison insight.
   * Shows savings between source product and best deal found.
   * 
   * @param {Array} products - Sorted products array
   * @param {Object} sourceProduct - Original product that was clicked
   */
  function updateComparisonInsight(products, sourceProduct) {
    const anchorEl = document.getElementById('alismart-anchor-product');
    if (!anchorEl || !products || products.length === 0) return;

    const bestDeal = products[0];
    const sourcePrice = sourceProduct?.priceValue || 0;
    const bestPrice = bestDeal?.totalPrice || 0;
    const currencyMatch = sourceProduct?.price?.match(/[₪$€£]/);
    const currencySymbol = currencyMatch ? currencyMatch[0] : '$';

    // Calculate savings
    let savingsHtml = '';
    if (sourcePrice > 0 && bestPrice > 0 && bestPrice < sourcePrice) {
      const savings = sourcePrice - bestPrice;
      const savingsPercent = ((savings / sourcePrice) * 100).toFixed(0);
      
      // Only show if savings > 1%
      if (savingsPercent >= 1) {
        savingsHtml = `
          <div class="as-savings-insight">
            <span class="as-savings-amount">Save ${currencySymbol}${savings.toFixed(2)}</span>
            <span class="as-savings-percent">(${savingsPercent}% cheaper)</span>
          </div>
        `;
      }
    }

    // Update anchor display
    anchorEl.innerHTML = `
      <div class="as-anchor-header">
        <span class="as-anchor-label">Searching for</span>
        ${savingsHtml}
      </div>
      <div class="as-anchor-product">
        <div class="as-anchor-image">
          <img src="${escapeHtml(sourceProduct?.imgUrl || '')}" alt="" 
            onerror="this.parentElement.classList.add('img-error')">
        </div>
        <div class="as-anchor-details">
          <p class="as-anchor-title">${escapeHtml((sourceProduct?.title || 'Unknown').substring(0, 60))}</p>
          <p class="as-anchor-price">
            <span class="as-anchor-label-sm">Your item:</span>
            <span class="as-anchor-value">${currencySymbol}${sourcePrice.toFixed(2)}</span>
          </p>
        </div>
      </div>
    `;
  }

  function displayResults(products) {
    // DEBUG: Log products array to diagnose data flow issue
    console.log('[AliSmart DEBUG] displayResults called with:', {
      productsLength: products?.length,
      isArray: Array.isArray(products),
      firstProduct: products?.[0],
      sampleIds: products?.slice(0, 3).map(p => p.productId)
    });
    
    const shadow = getShadowRoot();
    if (!shadow) {
      console.error('[AliSmart DEBUG] No shadow root found');
      return;
    }
    const results = shadow.getElementById('as-results');
    if (!results) {
      console.error('[AliSmart DEBUG] No #as-results element found in shadow root');
      return;
    }

    // Calculate totals and sort products by price (cheapest first)
    const sortedProducts = calculateTotalAndSort(products);

    if (!sortedProducts || sortedProducts.length === 0) {
      results.innerHTML = `
        <div class="as-empty-state as-fade-in">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
            <path d="M11 8v3m0 3v.01"></path>
          </svg>
          <p>No similar products found</p>
          <p class="as-hint">Try a different product or check your filters</p>
          <p class="as-hint" style="font-size: 11px; margin-top: 8px;">
            Products need ${MIN_RATING_THRESHOLD}+ stars to appear
          </p>
          <button class="as-retry-btn" onclick="location.reload()">Try Again</button>
        </div>
      `;
      return;
    }

    results.innerHTML = sortedProducts.map((product, index) => {
      const img = product.product_main_image_url || product.imageUrl || product.img || '';
      const title = product.product_title || product.title || 'Unknown Product';
      const url = product.product_detail_url || product.url || '#';
      const rating = product.rating;
      const orders = product.orders;

      // Determine currency symbol from price string
      const currencyMatch = product.price?.match(/[₪$€£]/);
      const currencySymbol = currencyMatch ? currencyMatch[0] : '$';
      
      // Format prices with 2 decimal places
      const itemPriceFormatted = product.priceValue > 0 
        ? `${currencySymbol}${product.priceValue.toFixed(2)}` 
        : 'N/A';
      const shippingPriceFormatted = product.shippingValue > 0
        ? `${currencySymbol}${product.shippingValue.toFixed(2)}`
        : (product.shipping && /free/i.test(product.shipping) ? 'Free' : 'Check');
      const totalFormatted = product.totalPrice < Infinity
        ? `${currencySymbol}${product.totalPrice.toFixed(2)}`
        : 'N/A';

      // Best Value badge for cheapest product (rank 1)
      const bestValueBadge = index === 0 && product.hasCompleteData
        ? `<span class="as-best-value-badge">Best Value</span>`
        : '';

      // Trust level badge (Instruction 8)
      const trustLevel = calculateTrustLevel(product);
      const trustBadge = `<span class="as-trust-badge ${trustLevel.className}">${trustLevel.label}</span>`;

      // Rating display
      const ratingHtml = rating > 0
        ? `<span class="as-rating" title="${rating.toFixed(1)} stars">★ ${rating.toFixed(1)}</span>`
        : '<span class="as-rating as-rating-new">New</span>';

      // Orders display
      const ordersHtml = orders > 0
        ? `<span class="as-orders">${orders.toLocaleString()} sold</span>`
        : '';

      // Rank indicator for top 3
      const rankBadge = index < 3
        ? `<span class="as-rank-badge">#${product.rank}</span>`
        : '';

      return `
        <a href="${url}" target="_blank" class="as-product-card ${index === 0 ? 'as-best-deal' : ''}">
          <div class="as-product-image-wrapper">
            ${rankBadge}
            <img src="${img}" alt="${escapeHtml(title)}" loading="lazy"
              onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/><text fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2236%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>📷</text></svg>'; this.parentElement.classList.add('img-fallback');"
              onload="this.parentElement.classList.remove('img-error');">
          </div>
          <div class="as-product-info">
            <p class="as-product-title">${escapeHtml(title.substring(0, 80))}${title.length > 80 ? '...' : ''}</p>
            <div class="as-badges-row">
              ${bestValueBadge}
              ${trustBadge}
            </div>
            <div class="as-price-breakdown">
              <div class="as-price-line">
                <span class="as-price-label">Item:</span>
                <span class="as-price-value">${escapeHtml(itemPriceFormatted)}</span>
              </div>
              <div class="as-price-line">
                <span class="as-price-label">Shipping:</span>
                <span class="as-price-value as-shipping-value">${escapeHtml(shippingPriceFormatted)}</span>
              </div>
              <div class="as-price-line as-total-line">
                <span class="as-price-label">Total:</span>
                <span class="as-price-value as-total-value">${escapeHtml(totalFormatted)}</span>
              </div>
            </div>
            <div class="as-meta-row">
              ${ratingHtml}
              ${ordersHtml}
            </div>
          </div>
        </a>
      `;
    }).join('');

    // Update anchor comparison insight (Instruction 12)
    const sourceProduct = window.alismartSourceProduct || null;
    updateComparisonInsight(sortedProducts, sourceProduct);

    log('Displayed', sortedProducts.length, 'products sorted by total price');
  }

  /** @type {HTMLElement|null} Current active quick peek element */
  let activeQuickPeek = null;
  
  /** @type {number|null} Hover delay timer */
  let quickPeekTimer = null;
  
  /** @const {number} Delay before showing quick peek (ms) */
  const QUICK_PEEK_DELAY = 400;

  /**
   * Creates and shows the Quick Peek tooltip for a product.
   * Displays detailed info on hover with glassmorphism effect.
   * 
   * @param {HTMLElement} cardEl - The product card element
   * @param {Object} product - Product data object
   */
  function showQuickPeek(cardEl, product) {
    // Clear any existing timer
    if (quickPeekTimer) {
      clearTimeout(quickPeekTimer);
      quickPeekTimer = null;
    }
    
    // Hide any existing peek
    hideQuickPeek();
    
    // Set delay timer
    quickPeekTimer = setTimeout(() => {
      createQuickPeekTooltip(cardEl, product);
    }, QUICK_PEEK_DELAY);
  }

  /**
   * Creates the Quick Peek tooltip DOM element.
   * 
   * @param {HTMLElement} cardEl - The product card element to position relative to
   * @param {Object} product - Product data
   */
  function createQuickPeekTooltip(cardEl, product) {
    const sidebar = document.getElementById('ali-smart-sidebar');
    if (!sidebar) return;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'as-quick-peek';
    tooltip.className = 'as-quick-peek';
    
    // Get card position relative to viewport
    const cardRect = cardEl.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    
    // Calculate position (left of sidebar, aligned with card)
    let top = cardRect.top;
    let left = sidebarRect.left - 320; // 320px width + gap
    
    // Collision detection - if would go off screen left, show on right
    if (left < 10) {
      left = sidebarRect.right + 10;
    }
    
    // Ensure doesn't go off bottom
    const peekHeight = 280;
    if (top + peekHeight > window.innerHeight) {
      top = window.innerHeight - peekHeight - 10;
    }
    
    tooltip.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      z-index: 2147483647;
    `;
    
    // Build tooltip content
    const img = product.product_main_image_url || product.imageUrl || product.img || '';
    const title = product.product_title || product.title || 'Unknown Product';
    const rating = product.rating || 0;
    const orders = product.orders || 0;
    
    // Format price display
    const currencyMatch = product.price?.match(/[₪$€£]/);
    const currencySymbol = currencyMatch ? currencyMatch[0] : '$';
    const totalPrice = product.totalPrice < Infinity 
      ? `${currencySymbol}${product.totalPrice.toFixed(2)}` 
      : 'N/A';
    
    tooltip.innerHTML = `
      <div class="as-peek-header">
        <div class="as-peek-image-gallery">
          <img src="${img}" alt="" onerror="this.style.display='none'">
        </div>
        <div class="as-peek-title-section">
          <h4 class="as-peek-title">${escapeHtml(title.substring(0, 60))}${title.length > 60 ? '...' : ''}</h4>
          <div class="as-peek-price">${totalPrice}</div>
        </div>
      </div>
      <div class="as-peek-details">
        ${rating > 0 ? `
          <div class="as-peek-row">
            <span class="as-peek-icon">★</span>
            <span>${rating.toFixed(1)} rating</span>
          </div>
        ` : ''}
        ${orders > 0 ? `
          <div class="as-peek-row">
            <span class="as-peek-icon">🛒</span>
            <span>${orders.toLocaleString()} sold</span>
          </div>
        ` : ''}
        <div class="as-peek-row">
          <span class="as-peek-icon">🚚</span>
          <span>Est. delivery: 7-15 days</span>
        </div>
        <div class="as-peek-row">
          <span class="as-peek-icon">✓</span>
          <span>Buyer protection included</span>
        </div>
      </div>
      <div class="as-peek-hint">
        Click card to open on AliExpress
      </div>
    `;
    
    document.body.appendChild(tooltip);
    activeQuickPeek = tooltip;
    
    // Add hover out handlers
    cardEl.addEventListener('mouseleave', hideQuickPeek, { once: true });
    
    log('Quick peek shown for:', title.substring(0, 30));
  }

  /**
   * Hides the Quick Peek tooltip if visible.
   */
  function hideQuickPeek() {
    // Clear any pending timer
    if (quickPeekTimer) {
      clearTimeout(quickPeekTimer);
      quickPeekTimer = null;
    }
    
    // Remove tooltip if exists
    if (activeQuickPeek) {
      activeQuickPeek.remove();
      activeQuickPeek = null;
      log('Quick peek hidden');
    }
  }

  /** @const {Map} Cache for visual search results to prevent duplicate API calls */
  const visualSearchCache = new Map();
  
  /** @const {number} Cache TTL in milliseconds (5 minutes) */
  const CACHE_TTL = 5 * 60 * 1000;

  /**
   * Extracts meaningful keywords from messy AliExpress product titles.
   * Removes spam words like "Hot Sale", "2026 New" and keeps only essential terms.
   * Limits to max 5 keywords to avoid confusing the search engine.
   * 
   * @param {string} title - Raw product title
   * @returns {string} Cleaned keywords string
   */
  function extractKeywords(title) {
    if (!title || typeof title !== 'string') return '';
    
    // Spam words and phrases to remove
    const spamWords = [
      'hot sale', 'new', '2026', '2025', '2024', 'brand', 'genuine', 'authentic',
      'high quality', 'best seller', 'top rated', 'popular', 'trending',
      'limited time', 'special offer', 'discount', 'cheap', 'wholesale',
      'free shipping', 'fast delivery', 'dropshipping', 'bestseller',
      '100%', 'official', 'original', 'premium', 'luxury', 'cheap'
    ];
    
    // Clean title: lowercase, remove special chars except spaces
    let cleaned = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove special characters
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();
    
    // Remove spam words
    spamWords.forEach(spam => {
      const regex = new RegExp('\\b' + spam + '\\b', 'gi');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Split into words and filter
    const words = cleaned
      .split(' ')
      .map(w => w.trim())
      .filter(w => w.length > 2)           // Skip short words
      .filter(w => !/^\d+$/.test(w))      // Skip pure numbers
      .filter((w, i, arr) => arr.indexOf(w) === i); // Remove duplicates
    
    // Limit to max 5 keywords
    const keywords = words.slice(0, 5);
    
    log('Extracted keywords:', keywords.join(' '), 'from:', title.substring(0, 50));
    return keywords.join(' ');
  }

  /**
   * Performs text-based search on AliExpress using cleaned keywords.
   * Sends keyword and productId to background script for API request.
   * 
   * @param {string} query - Search query (cleaned title)
   * @param {string} productId - Source product ID to exclude from results
   * @returns {Promise<Array>} Array of products from text search
   */
  async function performTextSearch(query, productId = '') {
    if (!query || query.trim().length < 3) {
      log('Query too short for text search');
      return [];
    }
    
    const keywords = extractKeywords(query);
    if (!keywords) {
      log('No keywords extracted for search');
      return [];
    }
    
    log('Performing text search with keywords:', keywords, 'productId:', productId);
    
    try {
      // Build AliExpress search URL
      const searchUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(keywords)}`;
      
      // Try to fetch search results via background script (to bypass CORS)
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'searchByKeyword',
          keyword: keywords,
          currentId: productId,
          imgUrl: '',
          title: query
        }, resolve);
      });
      
      // DEBUG: Log the raw response from background script
      console.log('[AliSmart DEBUG] performTextSearch received response:', {
        hasSuccess: response?.success,
        hasProducts: !!response?.products,
        productsLength: response?.products?.length,
        isProductsArray: Array.isArray(response?.products),
        firstProductKeys: response?.products?.[0] ? Object.keys(response.products[0]) : 'N/A',
        sampleProduct: response?.products?.[0]
      });
      
      if (response?.success && response.products && Array.isArray(response.products)) {
        log('Text search returned', response.products.length, 'products');
        return response.products.map(p => ({
          ...p,
          searchSource: 'text'
        }));
      }
      
      return [];
    } catch (error) {
      log('Text search error:', error.message);
      return [];
    }
  }

  /**
   * Merges visual and text search results, removing duplicates.
   * Prioritizes visual search results, adds unique items from text search.
   * 
   * @param {Array} visualResults - Products from visual search
   * @param {Array} textResults - Products from text search
   * @returns {Array} Merged and deduplicated products
   */
  function mergeSearchResults(visualResults, textResults) {
    const merged = [...(visualResults || [])];
    const seenIds = new Set(merged.map(p => p.productId).filter(Boolean));
    
    // Add unique text results
    (textResults || []).forEach(product => {
      const id = product.productId;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        merged.push({ ...product, searchSource: 'text' });
      }
    });
    
    log('Merged', visualResults?.length || 0, 'visual +', textResults?.length || 0, 
        'text =', merged.length, 'unique products');
    
    return merged;
  }

  /**
   * Cleans image URL by removing AliExpress size suffixes.
   * Converts URLs like "..._80x80.jpg" to original high-res version.
   * 
   * @param {string} url - Original image URL
   * @returns {string} Cleaned image URL without size suffixes
   */
  function cleanImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    // Remove AliExpress size suffixes: _80x80.jpg, _300x300.jpg, _640x640.jpg, etc.
    let cleaned = url.replace(/_\d+x\d+\.[a-zA-Z]+$/, '');
    
    // Remove other variants like .jpg_50x50
    cleaned = cleaned.replace(/\.[a-zA-Z]+_\d+x\d+$/, '');
    
    // Ensure protocol
    if (cleaned.startsWith('//')) {
      cleaned = 'https:' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Performs visual search on AliExpress using image URL.
   * Fetches search results and parses product data from HTML.
   * Uses caching to prevent duplicate searches.
   * Includes retry logic and multiple fallback mechanisms.
   * 
   * @param {string} imgUrl - Image URL to search for
   * @param {number} retryCount - Number of retries attempted (internal use)
   * @returns {Promise<Array>} Array of similar products
   */
  async function performVisualSearch(imgUrl, retryCount = 0) {
    if (!imgUrl) {
      log('No image URL provided for visual search');
      return [];
    }
    
    // Clean and validate image URL
    const cleanUrl = cleanImageUrl(imgUrl);
    if (!cleanUrl || cleanUrl.length < 10) {
      log('Invalid image URL after cleaning:', imgUrl?.substring(0, 50));
      return [];
    }
    
    const cacheKey = cleanUrl;
    
    // Check cache first
    const cached = visualSearchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      log('Using cached visual search results:', cached.products.length, 'products');
      return cached.products;
    }
    
    log('Performing visual search (attempt ' + (retryCount + 1) + '):', cleanUrl.substring(0, 60));
    
    try {
      // Route through background script to bypass CORS and ad blockers
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Visual search timeout after 15000ms'));
        }, 15000);
        
        chrome.runtime.sendMessage({
          action: 'searchByImage',
          imageUrl: cleanUrl
        }, (result) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });
      
      console.log('[AliSmart DEBUG] Visual search response:', {
        success: response?.success,
        productCount: response?.products?.length,
        error: response?.error
      });
      
      if (response?.success && response.products && Array.isArray(response.products)) {
        // Process and standardize the products
        const products = response.products
          .filter(p => p && (p.productId || p.id || p.product_id)) // Filter valid products
          .map(p => ({
            productId: p.productId || p.id || p.product_id || '',
            product_title: p.product_title || p.title || p.productTitle || 'Unknown Product',
            product_main_image_url: p.product_main_image_url || p.imageUrl || p.image || p.imgUrl || '',
            product_detail_url: p.product_detail_url || p.productUrl || p.url || 
              (p.productId ? `https://www.aliexpress.com/item/${p.productId}.html` : ''),
            price: p.price || p.salePrice || p.originalPrice || 'N/A',
            priceValue: parseFloat(p.priceValue || p.sale_price || p.original_price || 0),
            searchSource: 'visual',
            rating: parseFloat(p.rating || p.evaluationStar || p.productAverageStar || 0),
            orders: parseInt(p.orders || p.tradeCount || p.sales || 0)
          }));
        
        // Cache results only if we have valid products
        if (products.length > 0) {
          visualSearchCache.set(cacheKey, {
            products,
            timestamp: Date.now()
          });
          log('Visual search successful:', products.length, 'products found');
        } else {
          log('Visual search returned empty results');
        }
        
        return products;
      }
      
      // Handle error response
      if (response?.error) {
        console.warn('[AliSmart] Visual search error:', response.error);
      }
      
      // Retry logic for failed requests (max 2 retries)
      if (retryCount < 2 && response?.error) {
        log('Retrying visual search in 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return performVisualSearch(imgUrl, retryCount + 1);
      }
      
      return [];
      
    } catch (error) {
      console.error('[AliSmart] Visual search failed:', error.message);
      
      // Retry on network errors (max 2 retries)
      if (retryCount < 2 && (error.message.includes('timeout') || error.message.includes('network'))) {
        log('Retrying visual search after error...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return performVisualSearch(imgUrl, retryCount + 1);
      }
      
      return [];
    }
  }

  /**
   * Parses API results into standardized product format.
   * 
   * @param {Array} apiProducts - Products from AliExpress API
   * @returns {Array} Standardized product objects
   */
  function parseApiResults(apiProducts) {
    return apiProducts.map(item => {
      // Extract price value
      const priceStr = item.price || item.salePrice || '0';
      const priceMatch = priceStr.match(/[\d,.]+/);
      const priceValue = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : 0;
      
      // Extract shipping (often in logistics field)
      let shippingValue = 0;
      let shippingText = 'Check website';
      if (item.logistics && item.logistics.freightAmount) {
        shippingValue = parseFloat(item.logistics.freightAmount.value) || 0;
        shippingText = shippingValue === 0 ? 'Free shipping' : `$${shippingValue.toFixed(2)}`;
      }
      
      return {
        product_title: item.title || item.productTitle || 'Unknown Product',
        product_main_image_url: item.imageUrl || item.imgUrl || item.image,
        product_detail_url: item.productUrl || item.url || `https://www.aliexpress.com/item/${item.productId}.html`,
        price: priceStr,
        priceValue: priceValue,
        shipping: shippingText,
        shippingValue: shippingValue,
        rating: parseFloat(item.evaluationStar) || 0,
        orders: parseInt(item.tradeCount) || 0,
        productId: item.productId
      };
    });
  }

  // ─── Search Function ────────────────────────────────────────────────
  async function triggerSearch(title, imgUrl) {
    // Get productId from the stored source product if available
    const productId = window.alismartSourceProduct?.productId || '';
    
    log('Triggering hybrid search:', { title: title?.substring(0, 50), imgUrl: imgUrl?.substring(0, 50), productId });

    openSidebar();
    showSkeletonLoader();

    // Run both searches in parallel for maximum coverage
    const [visualResults, textResults] = await Promise.all([
      // Visual search (if image available)
      imgUrl ? performVisualSearch(imgUrl).catch(err => {
        log('Visual search failed:', err.message);
        return [];
      }) : Promise.resolve([]),
      
      // Text search (always run as fallback/enhancement)
      performTextSearch(title, productId).catch(err => {
        log('Text search failed:', err.message);
        return [];
      })
    ]);

    log('Visual search:', visualResults.length, 'products, Text search:', textResults.length, 'products');

    // Merge results, remove duplicates
    const mergedProducts = mergeSearchResults(visualResults, textResults);
    
    // DEBUG: Log merged products before displaying
    console.log('[AliSmart DEBUG] triggerSearch merged results:', {
      visualCount: visualResults.length,
      textCount: textResults.length,
      mergedCount: mergedProducts.length,
      firstMergedProduct: mergedProducts?.[0],
      sampleProductIds: mergedProducts?.slice(0, 3).map(p => p.productId)
    });

    // Hide loading and display merged results
    hideLoading();
    
    if (mergedProducts.length === 0) {
      showEmptyState('No similar products found. Try a different item.');
      return;
    }

    // Display merged results (will be sorted by calculateTotalAndSort)
    displayResults(mergedProducts);
    
    // BRIDGE DATA GAP: Send products to sidebar via chrome.runtime.sendMessage
    // Using SEARCH_RESULTS type to match sidebar listener in SidebarContainer.jsx
    try {
      chrome.runtime.sendMessage({
        type: 'SEARCH_RESULTS',
        results: mergedProducts,
        sourceProduct: window.alismartSourceProduct || null,
        timestamp: Date.now()
      }, (response) => {
        if (chrome.runtime.lastError) {
          log('Message send error:', chrome.runtime.lastError.message);
        } else {
          log('Products sent to sidebar:', mergedProducts.length);
        }
      });
    } catch (err) {
      log('Failed to send message to sidebar:', err.message);
    }
    
    log('Hybrid search complete:', mergedProducts.length, 'total unique products');
  }

  /**
   * Displays search results in the sidebar.
   * Renders product cards with images, titles, prices, and ratings.
   * 
   * @param {Array} products - Array of product objects to display
   */
  function displayResults(products) {
    const shadow = getShadowRoot();
    if (!shadow) {
      log('Cannot display results: no shadow root');
      return;
    }
    
    // Find the product list container in the sidebar
    let productList = shadow.getElementById('as-product-list');
    
    if (!productList) {
      log('Product list container (as-product-list) not found');
      return;
    }
    
    // Clear previous content
    productList.innerHTML = '';
    
    // Sort products by price (lowest first)
    const sortedProducts = [...products].sort((a, b) => {
      const priceA = a.priceValue || parseFloat(a.price?.replace(/[^\d.]/g, '')) || 0;
      const priceB = b.priceValue || parseFloat(b.price?.replace(/[^\d.]/g, '')) || 0;
      return priceA - priceB;
    });
    
    // Render each product
    sortedProducts.forEach((product, index) => {
      const productCard = createProductCard(product, index);
      productList.appendChild(productCard);
    });
    
    log('Displayed', sortedProducts.length, 'products in sidebar');
  }

  /**
   * Creates a product card element for the sidebar.
   * 
   * @param {Object} product - Product data
   * @param {number} index - Product index for styling
   * @returns {HTMLElement} Product card element
   */
  function createProductCard(product, index) {
    const card = document.createElement('a');
    card.className = 'as-product-card';
    card.href = product.product_detail_url || product.url || '#';
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    
    // Extract and format data
    const title = product.product_title || product.title || 'Unknown Product';
    const image = product.product_main_image_url || product.imageUrl || '';
    const price = product.price || 'N/A';
    const priceValue = product.priceValue || 0;
    const rating = product.rating || 0;
    const orders = product.orders || 0;
    
    // Calculate savings badge
    let savingsHtml = '';
    if (window.alismartSourceProduct?.priceValue > 0 && priceValue > 0) {
      const sourcePrice = window.alismartSourceProduct.priceValue;
      if (priceValue < sourcePrice) {
        const savingsPercent = Math.round(((sourcePrice - priceValue) / sourcePrice) * 100);
        savingsHtml = `<div class="as-savings-badge">Save ${savingsPercent}%</div>`;
      }
    }
    
    // Rating stars
    const starsHtml = rating > 0 ? `<div class="as-rating">⭐ ${rating.toFixed(1)}</div>` : '';
    
    card.innerHTML = `
      <div class="as-product-image">
        <img src="${image}" alt="" loading="lazy" onerror="this.style.display='none'">
        ${savingsHtml}
      </div>
      <div class="as-product-info">
        <div class="as-product-title">${escapeHtml(title)}</div>
        <div class="as-product-price-row">
          <span class="as-price">${price}</span>
          ${starsHtml}
        </div>
      </div>
    `;
    
    // Add styles if needed
    addProductCardStyles();
    
    return card;
  }

  /**
   * Adds CSS styles for product cards in the sidebar.
   */
  function addProductCardStyles() {
    const shadow = getShadowRoot();
    if (!shadow || shadow.getElementById('as-product-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'as-product-styles';
    styleEl.textContent = `
      .as-product-card {
        display: flex;
        gap: 12px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        text-decoration: none;
        color: white;
        transition: all 0.3s ease;
        margin-bottom: 10px;
      }
      .as-product-card:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 106, 0, 0.5);
        transform: translateX(-4px);
      }
      .as-product-image {
        width: 80px;
        height: 80px;
        border-radius: 8px;
        overflow: hidden;
        flex-shrink: 0;
        position: relative;
        background: rgba(0, 0, 0, 0.3);
      }
      .as-product-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .as-savings-badge {
        position: absolute;
        top: 4px;
        left: 4px;
        background: linear-gradient(135deg, #00d084, #00a854);
        color: white;
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 10px;
        font-weight: 700;
      }
      .as-product-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .as-product-title {
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: #f0f6fc;
      }
      .as-product-price-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
      }
      .as-price {
        font-size: 15px;
        font-weight: 700;
        background: linear-gradient(135deg, #ff6b6b, #f06595);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .as-rating {
        font-size: 12px;
        color: #ffc107;
      }
    `;
    shadow.appendChild(styleEl);
  }

  /**
   * Displays search info in sidebar.
   */
  function displaySearchInfo(title, imgUrl) {
    const shadow = getShadowRoot();
    if (!shadow) return;
    
    const sidebar = shadow.getElementById('ali-smart-sidebar');
    if (!sidebar) return;
    
    let searchInfo = shadow.getElementById('as-search-info');
    if (!searchInfo) {
      searchInfo = document.createElement('div');
      searchInfo.id = 'as-search-info';
      searchInfo.style.cssText = 'padding: 16px; background: rgba(255,106,0,0.1); border-bottom: 1px solid rgba(255,106,0,0.3); margin-bottom: 16px;';
      const header = sidebar.querySelector('div');
      if (header) sidebar.insertBefore(searchInfo, header.nextSibling);
    }
    
    searchInfo.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        ${imgUrl ? `<img src="${imgUrl}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">` : ''}
        <div>
          <div style="font-size: 11px; color: #ff6a00; text-transform: uppercase;">Searching for:</div>
          <div style="font-size: 13px; color: #f0f6fc; font-weight: 500;">${escapeHtml(title)}</div>
        </div>
      </div>
    `;
  }

  // ─── Product Data Extraction ──────────────────────────────────────────
  function extractProductData(productElement) {
    let title = '';
    let imgUrl = '';

    // Try to find product title
    const titleSelectors = [
      'h1', 'h2', 'h3', 'h4',
      '[class*="title"]', '[class*="Title"]',
      '[class*="product-title"]', '[class*="ProductTitle"]',
      '.product-name', '.item-title',
      'a[title]'
    ];

    for (const selector of titleSelectors) {
      const el = productElement.querySelector(selector);
      if (el) {
        title = el.getAttribute('title') || el.textContent.trim();
        if (title && title.length > 3) break;
      }
    }

    // Try to find product image
    const imgSelectors = [
      'img[class*="main"]', 'img[class*="Main"]',
      'img[class*="product"]', 'img[class*="Product"]',
      'img[class*="primary"]', 'img[class*="Primary"]',
      'img[class*="image"]', 'img[class*="Image"]',
      'img[class*="pic"]', 'img[class*="Pic"]',
      '.main-image img', '.product-image img',
      'img:first-of-type', 'img'
    ];

    for (const selector of imgSelectors) {
      const img = productElement.querySelector(selector);
      if (img) {
        // Try multiple lazy-loading attributes in priority order
        imgUrl = img.getAttribute('src') || 
                 img.getAttribute('data-src') || 
                 img.getAttribute('data-original') ||
                 img.getAttribute('data-lazy-src') ||
                 img.getAttribute('data-image-src') ||
                 img.getAttribute('data-preview-src') ||
                 img.getAttribute('data-placeholder-src') ||
                 img.getAttribute('data-echo') ||
                 img.getAttribute('srcset')?.split(',')[0]?.split(' ')[0]; // Get first srcset URL
        
        // Skip data URIs and blobs
        if (imgUrl && !imgUrl.includes('data:image') && !imgUrl.startsWith('blob:')) {
          break;
        }
      }
    }

    // Clean up image URL - remove size suffixes and ensure protocol
    if (imgUrl) {
      // Remove AliExpress size suffixes (_300x300.jpg, _80x80.jpg, etc.)
      imgUrl = imgUrl.replace(/_[0-9]+x[0-9]+\.[a-zA-Z]+$/, '');
      imgUrl = imgUrl.replace(/\.[a-zA-Z]+_\d+x\d+$/, '');
      
      // Ensure protocol is present
      if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('//')) {
        imgUrl = 'https://' + imgUrl;
      } else if (imgUrl && imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      }
    }

    // If still no title, try parent links
    if (!title) {
      const link = productElement.closest('a') || productElement.querySelector('a[href*="/item/"]');
      if (link) {
        title = link.getAttribute('title') || link.textContent.trim();
      }
    }

    return { title, imgUrl };
  }

  // ─── Smart Product Detection Engine ─────────────────────────────────
  
  /** @const {string} Attribute to mark processed products */
  const PROCESSED_ATTR = 'data-alismart-processed';
  
  /** @const {WeakSet} Track processed elements to prevent duplicates */
  const processedProducts = new WeakSet();
  
  /** @type {Array<HTMLElement>} Queue of pending products to process */
  let pendingProductsQueue = [];
  
  /** @type {boolean} Whether a processing task is scheduled */
  let isProcessingScheduled = false;

  /**
   * Checks if an element is a valid product card.
   * Validates dimensions and presence of required elements.
   * 
   * @param {HTMLElement} element - Element to validate
   * @returns {boolean} True if element is a valid product card
   */
  function isValidProductCard(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    
    // Skip if already processed (attribute check for persistence)
    if (element.getAttribute(PROCESSED_ATTR) === 'true') return false;
    if (processedProducts.has(element)) return false;
    
    // Must have reasonable dimensions (not too small, not too large)
    const rect = element.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return false;
    if (rect.width > 600 || rect.height > 600) return false;
    
    // Must contain an image (product photo) or product link
    const hasImage = element.querySelector('img') !== null;
    const hasProductLink = element.querySelector('a[href*="/item/"]') !== null;
    
    return hasImage || hasProductLink;
  }

  /**
   * Parses a price string to extract numeric value.
   * Handles various formats: "$12.99", "12.99 USD", "₪45.90", "1,234.56", etc.
   * 
   * @param {string} priceStr - Raw price string from DOM
   * @returns {{value: number, currency: string}} Parsed price value and currency
   */
  function parsePriceValue(priceStr) {
    if (!priceStr || typeof priceStr !== 'string') return { value: 0, currency: '' };
    
    // Detect currency symbol/code
    const currencyMatch = priceStr.match(/^[^\d\s.,]+|[\s]*(USD|EUR|GBP|ILS|₪|\$|€|£)[\s]*$/i);
    const currency = currencyMatch ? currencyMatch[0].trim() : '';
    
    // Remove currency symbols and normalize
    const cleaned = priceStr
      .replace(/[^\d.,]/g, '')     // Keep only digits, dots, commas
      .replace(/,/g, '.');          // Convert commas to dots for consistency
    
    // Handle multiple dots (keep last one as decimal)
    const parts = cleaned.split('.');
    let normalized;
    if (parts.length > 2) {
      normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    } else {
      normalized = cleaned;
    }
    
    const value = parseFloat(normalized) || 0;
    return { value, currency };
  }

  /**
   * Extracts product data from a product card element.
   * Targets: Image URL, Product Title, Price, Shipping
   * 
   * @param {HTMLElement} productElement - Product card element
   * @returns {{title: string, imgUrl: string, price: string, shipping: string, priceValue: number, shippingValue: number}} Extracted product data
   */
  function extractProductData(productElement) {
    let title = '';
    let imgUrl = '';
    let price = '';
    let shipping = '';
    let productId = '';

    // Title extraction selectors (ordered by priority)
    const titleSelectors = [
      'h1[class*="title"]', 'h2[class*="title"]', 'h3[class*="title"]', 'h4[class*="title"]',
      '[class*="product-title"]', '[class*="ProductTitle"]',
      '[class*="item-title"]', '[class*="ItemTitle"]',
      '.product-name', '.productTitle',
      'a[title]', 'a[data-testid*="title"]'
    ];

    for (const selector of titleSelectors) {
      const el = productElement.querySelector(selector);
      if (el) {
        title = el.getAttribute('title') || el.textContent.trim();
        if (title && title.length > 3) break;
      }
    }

    // Fallback: try parent link
    let productLink = null;
    if (!title) {
      productLink = productElement.closest('a') || 
                   productElement.querySelector('a[href*="/item/"]');
      if (productLink) {
        title = productLink.getAttribute('title') || productLink.textContent.trim();
      }
    } else {
      productLink = productElement.querySelector('a[href*="/item/"]');
    }

    // Extract productId from data attribute or from link href
    productId = productElement.getAttribute('data-product-id') || 
                productElement.getAttribute('data-pl');
    
    if (!productId && productLink) {
      const href = productLink.getAttribute('href') || '';
      const match = href.match(/\/item\/(\d+)\.html/);
      if (match) {
        productId = match[1];
      }
    }

    // Image extraction with comprehensive lazy-loading support
    const imgSelectors = [
      'img[class*="main"]', 'img[class*="Main"]',
      'img[class*="product"]', 'img[class*="Product"]',
      'img[class*="primary"]', 'img[class*="Primary"]',
      'img[class*="image"]', 'img[class*="Image"]',
      'img[class*="pic"]', 'img[class*="Pic"]',
      '.main-image img', '.product-image img',
      'img:first-of-type', 'img'
    ];

    for (const selector of imgSelectors) {
      const img = productElement.querySelector(selector);
      if (img) {
        // Try multiple lazy-loading attributes in priority order
        imgUrl = img.getAttribute('src') || 
                 img.getAttribute('data-src') || 
                 img.getAttribute('data-original') ||
                 img.getAttribute('data-lazy-src') ||
                 img.getAttribute('data-image-src') ||
                 img.getAttribute('data-preview-src') ||
                 img.getAttribute('data-placeholder-src');
        if (imgUrl && !imgUrl.includes('data:image') && !imgUrl.startsWith('blob:')) {
          break;
        }
      }
    }

    // Price extraction selectors (AliExpress specific patterns)
    const priceSelectors = [
      '[class*="price-sale"]', '[class*="price-current"]',
      '[class*="price--"]',
      '.multi--price-sale--', '.multi--price--',
      '[class*="product-price"]', '[class*="ProductPrice"]',
      '[class*="price-wrap"]',
      '.price', '[class*="sale-price"]'
    ];

    for (const selector of priceSelectors) {
      const el = productElement.querySelector(selector);
      if (el) {
        price = el.textContent.trim();
        if (price && /[\d$€£₪]/.test(price)) break;
      }
    }

    // Shipping extraction selectors
    const shippingSelectors = [
      '[class*="shipping"]',
      '[class*="delivery"]',
      '[class*="logistics"]',
      '.multi--shipping--',
      '[data-testid*="shipping"]',
      '[class*="free-shipping"]', '[class*="FreeShipping"]'
    ];

    for (const selector of shippingSelectors) {
      const el = productElement.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        if (text && (/shipping|delivery|משלוח/i.test(text) || /free/i.test(text))) {
          shipping = text;
          break;
        }
      }
    }

    // If no shipping element found, check for "Free shipping" text anywhere
    if (!shipping) {
      const allText = productElement.textContent;
      if (/free\s*shipping/i.test(allText)) {
        shipping = 'Free shipping';
      }
    }

    // Clean up image URL
    if (imgUrl) {
      // Remove AliExpress size suffixes (_300x300.jpg)
      imgUrl = imgUrl.replace(/_[0-9]+x[0-9]+\.[a-zA-Z]+$/, '');
      // Ensure protocol is present
      if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('//')) {
        imgUrl = 'https://' + imgUrl;
      } else if (imgUrl && imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      }
    }

    // Parse price values
    const { value: priceValue } = parsePriceValue(price);
    
    // Parse shipping value
    let shippingValue = 0;
    if (shipping && /free/i.test(shipping)) {
      shippingValue = 0;
    } else {
      const { value: sVal } = parsePriceValue(shipping);
      shippingValue = sVal;
    }

    // Extract rating (stars)
    let rating = 0;
    const ratingSelectors = [
      '[class*="rating"]',
      '[class*="stars"]',
      '[data-testid*="rating"]',
      '.multi--item-rating--'
    ];
    
    for (const selector of ratingSelectors) {
      const el = productElement.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        const match = text.match(/(\d\.?\d*)/);
        if (match) {
          rating = parseFloat(match[1]);
          if (rating > 0 && rating <= 5) break;
        }
      }
    }

    // Extract sales count
    let salesCount = 0;
    const salesSelectors = [
      '[class*="sold"]',
      '[class*="sales"]',
      '[class*="orders"]',
      '[data-testid*="sold"]'
    ];
    
    for (const selector of salesSelectors) {
      const el = productElement.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        const match = text.replace(/,/g, '').match(/(\d+)/);
        if (match) {
          salesCount = parseInt(match[1], 10);
          if (salesCount > 0) break;
        }
      }
    }

    return { 
      title: title || 'Unknown Product', 
      imgUrl: imgUrl || '',
      price: price || 'N/A',
      shipping: shipping || 'Check website',
      priceValue,
      shippingValue,
      rating,
      salesCount,
      productId
    };
  }

  /**
   * Marks a product element as processed to prevent duplicate detection.
   * Uses both WeakSet (memory) and data attribute (DOM persistence).
   * 
   * @param {HTMLElement} element - Product element to mark
   */
  function markProductProcessed(element) {
    processedProducts.add(element);
    element.setAttribute(PROCESSED_ATTR, 'true');
  }

  /**
   * Creates a floating action button for a product card.
   * Glassmorphism design matching sidebar aesthetic.
   * Includes loading state for visual feedback.
   * 
   * @param {{title: string, imgUrl: string}} productData - Product data
   * @returns {HTMLButtonElement} The floating button element
   */
  function createFloatingButton(productData) {
    const button = document.createElement('button');
    button.className = 'alismart-action-btn';
    button.setAttribute('data-alismart-btn', 'true');
    button.setAttribute('aria-label', 'Search similar products');
    
    button.dataset.productTitle = productData.title || '';
    button.dataset.productImg = productData.imgUrl || '';
    button.dataset.productPrice = productData.price || '';
    button.dataset.productPriceValue = productData.priceValue || '0';
    button.dataset.productId = productData.productId || '';
    
    // Store original SVG for loading state toggle
    button.dataset.originalSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>`;
    
    // Loading spinner SVG
    button.dataset.loadingSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="as-spinner-icon">
        <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
        </circle>
      </svg>`;
    
    button.innerHTML = button.dataset.originalSvg;
    
    // Clean premium button styles with gradient and enhanced shadow for visibility above images
    button.style.cssText = `
      position: fixed !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 48px !important;
      height: 48px !important;
      padding: 0 !important;
      background: linear-gradient(135deg, #ff6b6b 0%, #f06595 50%, #cc5de8 100%) !important;
      color: white !important;
      border: 2px solid rgba(255, 255, 255, 0.8) !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      box-shadow: 
        0 6px 20px rgba(240, 101, 149, 0.5),
        0 0 0 4px rgba(255, 255, 255, 0.3),
        0 0 20px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      backdrop-filter: blur(10px) !important;
    `;
    
    // Add loading state styles
    const loadingStyle = document.createElement('style');
    loadingStyle.textContent = `
      .alismart-action-btn[data-loading="true"] {
        background: linear-gradient(135deg, #888 0%, #666 50%, #555 100%) !important;
        pointer-events: none !important;
        opacity: 0.8 !important;
      }
      .alismart-action-btn .as-spinner-icon {
        animation: spin 1s linear infinite !important;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(loadingStyle);
    
    button.addEventListener('mouseenter', () => {
      if (button.dataset.loading === 'true') return;
      button.style.background = 'linear-gradient(135deg, #ff8585 0%, #f585b0 50%, #d97af0 100%) !important';
      button.style.transform = 'scale(1.15) translateY(-2px) !important';
      button.style.boxShadow = '0 10px 30px rgba(240, 101, 149, 0.6), 0 0 0 4px rgba(255, 255, 255, 0.5), 0 0 30px rgba(0, 0, 0, 0.4) !important';
    });
    
    button.addEventListener('mouseleave', () => {
      if (button.dataset.loading === 'true') return;
      button.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #f06595 50%, #cc5de8 100%) !important';
      button.style.transform = 'scale(1) translateY(0) !important';
      button.style.boxShadow = '0 6px 20px rgba(240, 101, 149, 0.5), 0 0 0 4px rgba(255, 255, 255, 0.3), 0 0 20px rgba(0, 0, 0, 0.3) !important';
    });
    
    button.addEventListener('click', handleButtonClick);
    return button;
  }

  /**
   * Sets the loading state on a floating button.
   * Provides visual feedback that search has started.
   * 
   * @param {HTMLButtonElement} button - The button to set loading state on
   * @param {boolean} isLoading - True to show loading, false to restore normal state
   */
  function setButtonLoadingState(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
      button.dataset.loading = 'true';
      button.innerHTML = button.dataset.loadingSvg;
      button.style.background = 'linear-gradient(135deg, #888 0%, #666 50%, #555 100%) !important';
      button.style.pointerEvents = 'none';
      button.style.opacity = '0.8';
      log('Button loading state: ON');
    } else {
      button.dataset.loading = 'false';
      button.innerHTML = button.dataset.originalSvg;
      button.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #f06595 50%, #cc5de8 100%) !important';
      button.style.pointerEvents = 'auto';
      button.style.opacity = '1';
      log('Button loading state: OFF');
    }
  }

  /**
   * Handles button click event - sends message to existing sidebar or creates one.
   * ANTI-DUPLICATION: Checks for existing sidebar first, sends postMessage if found.
   * Extracts productId once per click and passes cleanly to background script.
   * LOADING STATE: Shows spinner on button immediately after click for visual feedback.
   * KEYWORD VALIDATION: Verifies title/keyword is not empty, falls back to h1 if needed.
   * 
   * @param {MouseEvent} event - Click event
   */
  function handleButtonClick(event) {
    // Prevent any default behavior and event bubbling
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Get product data from button dataset - EXTRACT ONCE
    const button = event.currentTarget;
    let title = button.dataset.productTitle || '';
    
    // CRITICAL FIX: Validate keyword is not empty, fallback to h1 if needed
    if (!title || title.trim() === '' || title === 'Unknown Product' || title === 'Product Search') {
      // Try to extract from page h1 element
      const h1Element = document.querySelector('h1');
      if (h1Element) {
        title = h1Element.textContent.trim();
        log('Title empty from button, extracted from h1:', title.substring(0, 50));
      }
    }
    
    // Final fallback if still empty
    if (!title || title.trim() === '') {
      title = 'Product Search';
      log('WARNING: Could not extract product title, using default');
    }
    
    const productData = {
      title: title,
      imgUrl: button.dataset.productImg || '',
      price: button.dataset.productPrice || '',
      priceValue: parseFloat(button.dataset.productPriceValue) || 0,
      productId: button.dataset.productId || ''
    };
    
    // Store source product for anchor comparison
    window.alismartSourceProduct = productData;
    
    // VISUAL FEEDBACK: Show loading state on button immediately
    // This lets the user know the search has started before sidebar slides in
    setButtonLoadingState(button, true);
    
    // Reset loading state after 3 seconds (or when search completes)
    setTimeout(() => {
      setButtonLoadingState(button, false);
    }, 3000);
    
    log('Button clicked for:', productData.title, 'productId:', productData.productId);
    
    // ANTI-DUPLICATION: Check if sidebar already exists
    const shadow = getShadowRoot();
    const existingSidebar = shadow?.getElementById('ali-smart-sidebar');
    
    if (existingSidebar) {
      // Sidebar exists - send message to it instead of triggering new render
      log('Sidebar exists, sending message to existing instance');
      
      // Dispatch custom event to notify sidebar of new search
      window.dispatchEvent(new CustomEvent('ALISMART_PRODUCT_CLICKED', {
        detail: productData
      }));
      
      // Open sidebar if closed
      openSidebar();
      
      // Update sidebar with current search context
      displaySearchInfo(productData.title, productData.imgUrl);
      
      // Trigger search with extracted productId
      triggerSearch(productData.title, productData.imgUrl);
    } else {
      // No sidebar exists - create new one
      log('No sidebar found, creating new instance');
      ensureSidebarExists();
      openSidebar();
      displaySearchInfo(productData.title, productData.imgUrl);
      triggerSearch(productData.title, productData.imgUrl);
    }
  }

  /**
   * Ensures the sidebar DOM element exists, injecting it if necessary.
   * Uses the shadow DOM for full CSS isolation.
   */
  function ensureSidebarExists() {
    const shadow = getShadowRoot();
    if (!shadow) {
      log('Cannot inject sidebar: shadow root not available');
      return;
    }
    
    // DEBUG MODE: Always inject debug sidebar
    injectDebugSidebar();
    return;
    log('Sidebar exists, toggle shown');
  }

  /**
   * Shows skeleton loading animation in the results area.
   * Displays 6 skeleton cards with staggered animation and progress bar.
   */
  function showSkeletonLoader() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const results = shadow.getElementById('as-results');
    const loading = shadow.getElementById('as-loading');
    
    // Hide old spinner if exists
    if (loading) loading.classList.add('hidden');
    
    // Clear previous results
    if (results) {
      // Generate 6 skeleton cards with proper structure
      results.innerHTML = `
        <div class="as-progress-bar"></div>
        ${Array(6).fill(0).map((_, i) => `
          <div class="as-skeleton">
            <div class="as-skeleton-img"></div>
            <div class="as-skeleton-info">
              <div class="as-skeleton-line"></div>
              <div class="as-skeleton-line short"></div>
              <div class="as-skeleton-line tiny"></div>
            </div>
          </div>
        `).join('')}
      `;
    }
    
    // Set timeout to prevent skeletons showing too long (10 seconds max)
    window.alismartLoadingTimeout = setTimeout(() => {
      hideLoading();
      showEmptyState('Loading timeout. Please try again.');
    }, 10000);
  }

  /**
   * Hides loading state and shows results or empty state.
   * Clears loading timeout and removes progress bar.
   */
  function hideLoading() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const loading = shadow.getElementById('as-loading');
    const results = shadow.getElementById('as-results');
    
    // Clear timeout if exists
    if (window.alismartLoadingTimeout) {
      clearTimeout(window.alismartLoadingTimeout);
      window.alismartLoadingTimeout = null;
    }
    
    // Hide loading spinner
    if (loading) loading.classList.add('hidden');
    
    // Remove progress bar if exists
    const progressBar = shadow.querySelector('.as-progress-bar');
    if (progressBar) progressBar.remove();
    
    log('Loading state hidden');
  }

  /**
   * Shows empty state with optional custom message and retry button.
   * 
   * @param {string} message - Custom message to display
   */
  function showEmptyState(message = '') {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const results = shadow.getElementById('as-results');
    if (!results) return;
    
    results.innerHTML = `
      <div class="as-empty-state as-fade-in">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <p>${escapeHtml(message || 'No similar products found')}</p>
        <p class="as-hint">Try a different product or check your filters</p>
        <button class="as-retry-btn" onclick="location.reload()">Try Again</button>
      </div>
    `;
    
    log('Empty state displayed');
  }

  /**
   * Opens the sidebar by adding the 'open' class.
   * Also hides the toggle button when sidebar is open.
   * Sets up global listeners and starts z-index monitor.
   */
  function openSidebar() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const sidebar = shadow.getElementById('ali-smart-sidebar');
    const toggle = shadow.getElementById('ali-smart-toggle');
    
    if (sidebar) {
      sidebar.classList.add('open');
      log('Sidebar opened');
    }
    
    if (toggle) {
      toggle.classList.add('hidden');
    }
    
    // Setup global listeners when sidebar opens
    setupGlobalListeners();
    
    // Ensure root container has pointer-events: auto when sidebar is open
    const container = document.getElementById(ROOT_CONTAINER_ID);
    if (container) {
      container.style.pointerEvents = 'auto';
    }
  }

  /**
   * Closes the sidebar by removing the 'open' class.
   * Also shows the toggle button when sidebar is closed.
   * Cleans up all global listeners when sidebar closes.
   */
  function closeSidebar() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    const sidebar = shadow.getElementById('ali-smart-sidebar');
    const toggle = shadow.getElementById('ali-smart-toggle');
    
    if (sidebar) {
      sidebar.classList.remove('open');
      log('Sidebar closed');
    }
    
    if (toggle) {
      toggle.classList.remove('hidden');
    }
    
    // CRITICAL: Clean up all global listeners when sidebar closes
    // This prevents memory leaks and 'looping' behavior
    cleanupGlobalListeners();
    
    // Reset root container to pointer-events: none when sidebar is closed
    const container = document.getElementById(ROOT_CONTAINER_ID);
    if (container) {
      container.style.pointerEvents = 'none';
    }
  }
  /**
   * Injects the floating action button directly into the product element.
   * PRECISION INJECTION: Targets .multi--image--container as direct parent.
   * Button is positioned absolutely with top: 10px; right: 10px.
   * Parent container forced to position: relative to trap button inside card.
   * SMART LOGIC: Checks for existing buttons and small images before injection.
   * 
   * @param {HTMLElement} productElement - Product card element
   * @param {{title: string, imgUrl: string}} productData - Product data
   */
  function injectButtonIntoProduct(productElement, productData) {
    // ANTI-DUPLICATION: Check if button already exists for this product
    const existingBtn = productElement.querySelector('[data-alismart-btn]');
    if (existingBtn) {
      log('Button already exists for product, skipping:', productData.title?.substring(0, 30));
      return;
    }
    
    // SMART BUTTON: Check if product image is too small - hide button for tiny images
    // This maintains a clean, professional look on recommendation strips
    const imgElement = productElement.querySelector('img');
    if (imgElement) {
      const imgRect = imgElement.getBoundingClientRect();
      // Hide button if image is smaller than 120x120 pixels
      if (imgRect.width < 120 || imgRect.height < 120) {
        log('Product image too small, hiding button for clean look:', 
          `${imgRect.width}x${imgRect.height}`, productData.title?.substring(0, 30));
        return;
      }
    }
    
    // PRECISION: Find the image container - prioritize .multi--image--container
    const imgContainer = productElement.querySelector('.multi--image--container') ||
                        productElement.querySelector('.multi--image--') ||
                        productElement.querySelector('.product-img') ||
                        productElement.querySelector('[class*="multi--image"]') ||
                        productElement.querySelector('[class*="image--container"]') ||
                        productElement.querySelector('[class*="img--wrapper"]') ||
                        productElement.querySelector('img')?.parentElement ||
                        productElement.querySelector('a[href*="/item/"]') ||
                        productElement;
    
    // FORCE: Ensure container has position: relative to trap button inside
    imgContainer.style.setProperty('position', 'relative', 'important');
    imgContainer.style.setProperty('overflow', 'visible', 'important');
    
    // Create button
    const button = createFloatingButton(productData);
    
    // PRECISION CSS: Absolute positioning trapped inside container
    button.style.cssText = button.style.cssText + `
      position: absolute !important;
      top: 10px !important;
      right: 10px !important;
      z-index: 2147483647 !important;
      margin: 0 !important;
      display: flex !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      transform: none !important;
    `;
    
    // Append as direct child of image container
    imgContainer.appendChild(button);
    
    log('Button injected into product:', productData.title.substring(0, 30));
  }

  /**
   * Processes a detected product card with button injection.
   * Uses cooldown mechanism to prevent re-render loops.
   * 
   * @param {HTMLElement} element - Product card element
   */
  function processDetectedProduct(element) {
    // Skip if already processed or in cooldown period
    if (element.getAttribute(PROCESSED_ATTR) === 'true') return;
    if (processedElements.has(element)) return;
    if (isInCooldown(element)) return; // Prevent re-render loops
    
    // Mark as processed immediately to prevent race conditions
    markProductProcessed(element);
    markWithCooldown(element); // Add to cooldown
    
    // Extract product data
    const data = extractProductData(element);
    
    // Log detection
    if (data.title && data.title !== 'Unknown Product') {
      log('Product detected:', data.title);
      
      // Inject floating button
      injectButtonIntoProduct(element, data);
    }
  }

  /**
   * Processes the pending products queue using requestIdleCallback.
   * Batches processing to avoid blocking the main thread.
   */
  function processPendingProducts() {
    isProcessingScheduled = false;
    
    if (pendingProductsQueue.length === 0) return;
    
    // Process up to 10 products per batch to maintain responsiveness
    const batchSize = 10;
    const batch = pendingProductsQueue.splice(0, batchSize);
    
    batch.forEach(element => {
      try {
        if (isValidProductCard(element)) {
          processDetectedProduct(element);
        }
      } catch (e) {
        // Silently skip problematic elements
      }
    });
    
    // If more products remain, schedule another batch
    if (pendingProductsQueue.length > 0) {
      scheduleProductProcessing();
    }
  }

  /**
   * Schedules product processing using requestIdleCallback.
   * Falls back to setTimeout if requestIdleCallback is unavailable.
   */
  function scheduleProductProcessing() {
    if (isProcessingScheduled) return;
    isProcessingScheduled = true;
    
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(processPendingProducts, { timeout: 100 });
    } else {
      setTimeout(processPendingProducts, 50);
    }
  }

  /**
   * Initializes the smart product detection MutationObserver.
   * Detects new product cards as they're added to the DOM and processes
   * them efficiently using requestIdleCallback.
   * 
   * Selector strategy:
   * - [data-pl] - Modern AliExpress grid items
   * - [data-product-id] - Product identifier attribute
   * - .search-item, .search-card-item - Search results
   * - .list-item, .product-item - Category/flash deal pages
   * - a[href*="/item/"] - Product links (fallback)
   */
  function initProductObserver() {
    // UPDATED: Modern AliExpress selectors (2024-2026 DOM structure)
    const PRODUCT_SELECTOR_PATTERNS = [
      '[data-pl]',                                    // Legacy grid items
      '[data-product-id]',                           // Product identifier
      '[data-sku-id]',                               // NEW: SKU identifier
      '.search-item',                                // Search results
      '.search-card-item',                           // Search cards
      '.search-item-card',                           // NEW: 2026 Search item card
      '.item-card---container',                      // NEW: 2026 Item card container
      '.list-item',                                  // Category pages
      '.product-item',                               // NEW: Generic product item
      '.item-fixed',                                 // NEW: Fixed item container
      '.product-card',                               // Product cards
      '[class*="product-card"]',                     // NEW: Generic product-card class
      '[class*="multi--container"]',                 // NEW: Modern AliExpress container
      '[class*="multi--item"]',                      // NEW: Modern grid item
      '[class*="ProductCard"]',                      // Product card classes
      '.grid-item',                                  // Grid items
      '[class*="gallery-item"]',                     // Gallery items
      '[class*="item-card"]',                        // Item cards
      '[class*="product-grid"]',                    // Product grid cells
      'a[href*="/item/"]',                           // Product links fallback
      '.product-list-item',                          // List view items
      '[data-spm*="product"]'                        // SPM tracked products
    ];

    /**
     * Checks if an element matches any product selector pattern.
     * @param {HTMLElement} el - Element to check
     * @returns {boolean}
     */
    function isProductElement(el) {
      if (!el || !el.matches) return false;
      
      return PRODUCT_SELECTOR_PATTERNS.some(pattern => {
        try {
          return el.matches(pattern);
        } catch (e) {
          return false;
        }
      });
    }

    /**
     * Recursively collects valid product elements from a node.
     * @param {HTMLElement} node - Root node to search
     * @returns {Array<HTMLElement>} Valid product elements
     */
    function collectProductElements(node) {
      const products = [];
      
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return products;
      
      // Check if the node itself is a product
      if (isProductElement(node) && isValidProductCard(node)) {
        products.push(node);
      }
      
      // Check for product links as fallback
      if (products.length === 0 && node.querySelector) {
        const links = node.querySelectorAll('a[href*="/item/"]');
        links.forEach(link => {
          const container = link.closest('[class*="item"]') ||
                             link.closest('[class*="card"]') ||
                             link.closest('[class*="product"]') ||
                             link.parentElement?.parentElement;
          if (container && isValidProductCard(container) && !products.includes(container)) {
            products.push(container);
          }
        });
      }
      
      // Also check children that match product patterns
      if (node.querySelectorAll && products.length === 0) {
        PRODUCT_SELECTOR_PATTERNS.forEach(pattern => {
          try {
            const matches = node.querySelectorAll(pattern);
            matches.forEach(el => {
              if (isValidProductCard(el) && !products.includes(el)) {
                products.push(el);
              }
            });
          } catch (e) {
            // Invalid selector, skip
          }
        });
      }
      
      return products;
    }

    // MutationObserver with debounce for infinite scroll
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
      // Debounce: clear existing timer and set new one
      if (debounceTimer) clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(() => {
        let newProductsFound = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type !== 'childList') return;
          
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            
            // Collect all valid product elements from this node
            const products = collectProductElements(node);
            
            products.forEach(product => {
              if (!pendingProductsQueue.includes(product)) {
                pendingProductsQueue.push(product);
                newProductsFound = true;
                
                // DEBUG: Add blue border outline to visualize detected products
                if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
                  product.style.outline = '2px solid blue';
                  product.style.outlineOffset = '-2px';
                }
              }
            });
          });
        });
        
        // Schedule processing if new products were found
        if (newProductsFound) {
          scheduleProductProcessing();
        }
      }, 100); // 100ms debounce for infinite scroll
    });

    // Start observing the document body with childList and subtree
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    log('ProductObserver initialized with', PRODUCT_SELECTOR_PATTERNS.length, 'selectors');
    log('MutationObserver watching document.body with childList: true, subtree: true');
    
    // Return observer instance for potential cleanup
    return observer;
  }

  // ─── Main Initialization ────────────────────────────────────────────
  
  /**
   * Scans the existing DOM for product cards and injects buttons.
   * This runs once on page load to catch products already rendered.
   */
  function scanExistingProducts() {
    log('Scanning existing products on page...');
    
    // UPDATED: Modern AliExpress selectors (2024-2026 DOM structure)
    const PRODUCT_SELECTOR_PATTERNS = [
      '[data-pl]',                                    // Legacy grid items
      '[data-product-id]',                           // Product identifier
      '[data-sku-id]',                               // NEW: SKU identifier
      '.search-item',                                // Search results
      '.search-card-item',                           // Search cards
      '.search-item-card',                           // NEW: 2026 Search item card
      '.item-card---container',                      // NEW: 2026 Item card container
      '.list-item',                                  // Category pages
      '.product-item',                               // NEW: Generic product item
      '.item-fixed',                                 // NEW: Fixed item container
      '.product-card',                               // Product cards
      '[class*="product-card"]',                     // NEW: Generic product-card class
      '[class*="multi--container"]',                 // NEW: Modern AliExpress container
      '[class*="multi--item"]',                      // NEW: Modern grid item
      '[class*="ProductCard"]',                      // Product card classes
      '.grid-item',                                  // Grid items
      '[class*="gallery-item"]',                     // Gallery items
      '[class*="item-card"]',                        // Item cards
      '[class*="product-grid"]',                    // Product grid cells
      'a[href*="/item/"]',                           // Product links fallback
      '.product-list-item',                          // List view items
      '[data-spm*="product"]'                        // SPM tracked products
    ];
    
    let foundCount = 0;
    
    // Try each selector pattern
    PRODUCT_SELECTOR_PATTERNS.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (isValidProductCard(el) && !pendingProductsQueue.includes(el)) {
            pendingProductsQueue.push(el);
            foundCount++;
            
            // DEBUG: Add blue border outline to visualize detected products
            if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
              el.style.outline = '2px solid blue';
              el.style.outlineOffset = '-2px';
            }
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    // Also look for product links as fallback
    if (foundCount === 0) {
      const links = document.querySelectorAll('a[href*="/item/"]');
      links.forEach(link => {
        const container = link.closest('[class*="item"]') ||
                           link.closest('[class*="card"]') ||
                           link.closest('[class*="product"]') ||
                           link.parentElement?.parentElement;
        if (container && isValidProductCard(container) && !pendingProductsQueue.includes(container)) {
          pendingProductsQueue.push(container);
          foundCount++;
          
          // DEBUG: Add blue border outline
          if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
            container.style.outline = '2px solid blue';
            container.style.outlineOffset = '-2px';
          }
        }
      });
    }
    
    // Process the queue if we found products
    if (pendingProductsQueue.length > 0) {
      scheduleProductProcessing();
    }
    
    log(`Scanned and found ${foundCount} existing products, queued for processing`);
    return foundCount;
  }
  
  /**
   * FORCE SCAN: Runs 3 seconds after page load to catch lazily loaded products.
   * This catches products that load after initial page render.
   */
  function forceScan() {
    log('🔍 FORCE SCAN: Running delayed scan to catch lazy-loaded products...');
    
    // Re-run the existing scan function
    const found = scanExistingProducts();
    
    // Additional aggressive scan: look for any element containing /item/ links
    if (found === 0) {
      log('Force scan: No products found with selectors, trying aggressive link detection...');
      
      const allLinks = document.querySelectorAll('a[href*="/item/"]');
      let aggressiveCount = 0;
      
      allLinks.forEach(link => {
        // Walk up the DOM to find a suitable container
        let container = link;
        for (let i = 0; i < 5; i++) { // Walk up max 5 levels
          container = container.parentElement;
          if (!container) break;
          
          // Check if this container looks like a product card
          const rect = container.getBoundingClientRect();
          const hasImage = container.querySelector('img') !== null;
          const isValidSize = rect.width >= 100 && rect.height >= 100 && rect.width <= 600;
          
          if (hasImage && isValidSize && !container.getAttribute('data-alismart-processed')) {
            if (!pendingProductsQueue.includes(container)) {
              pendingProductsQueue.push(container);
              aggressiveCount++;
              
              // DEBUG: Add red border for aggressive scan finds
              if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
                container.style.outline = '2px solid red';
                container.style.outlineOffset = '-2px';
              }
              break;
            }
          }
        }
      });
      
      if (aggressiveCount > 0) {
        log(`Force scan: Found ${aggressiveCount} additional products via aggressive detection`);
        scheduleProductProcessing();
      }
    }
    
    log('🔍 FORCE SCAN complete');
  }
  
  /**
   * Performs critical initialization that must run immediately.
   * This includes setting up observers and scanning for existing products.
   * @private
   */
  function initCritical() {
    log('Initializing critical components...');
    
    // DEBUG MODE: Highlight all elements with 'product' in class name
    // This helps identify what classes AliExpress is currently using
    document.querySelectorAll('*').forEach(el => {
      if (el.className && typeof el.className === 'string' && el.className.includes('product')) {
        el.style.border = '1px dashed red';
      }
    });
    log('Debug mode: Highlighted elements with "product" in class name');
    
    // Create root container early for isolation
    getRootContainer();
    
    // Initialize smart product detection (no setInterval, uses MutationObserver)
    initProductObserver();
    
    // CRITICAL FIX: Scan existing products immediately after observer setup
    // This ensures buttons are injected into products already on the page
    scanExistingProducts();
    
    // FORCE SCAN: Schedule a delayed scan 3 seconds after page load
    // This catches products that are loaded lazily after initial render
    setTimeout(() => {
      forceScan();
    }, 3000);
    
    log('Critical initialization complete');
  }

  /**
   * MANUAL TRIGGER: Global function to force a re-scan of the page.
   * Can be called from console: window.aliSmartScan()
   */
  window.aliSmartScan = function() {
    log('🔧 Manual scan triggered from console');
    const found = scanExistingProducts();
    log(`Manual scan complete: ${found} products found`);
    return { success: true, productsFound: found, timestamp: Date.now() };
  };
  
  /**
   * Performs non-critical initialization that can be deferred.
   * Uses requestIdleCallback to prevent blocking the main thread.
   * @private
   */
  function initNonCritical() {
    log('Initializing non-critical components...');
    
    // Ensure sidebar UI is in document.body (non-blocking)
    ensureSidebarInBody();
    
    // Test communication with background script
    testBackgroundConnection();
    
    log('Non-critical initialization complete');
  }
  
  /**
   * Tests connection to background script with ping/pong
   * @private
   */
  function testBackgroundConnection() {
    log('Testing background script connection...');
    
    try {
      chrome.runtime.sendMessage({ type: 'ping', timestamp: Date.now() }, (response) => {
        if (chrome.runtime.lastError) {
          log('⚠️ Background connection failed:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.pong) {
          log('✅ Background script connection verified:', response);
        } else {
          log('⚠️ Unexpected ping response:', response);
        }
      });
    } catch (error) {
      log('❌ Ping test error:', error.message);
    }
  }
  
  /**
   * Ensures sidebar is injected into Shadow DOM.
   * Called during non-critical initialization.
   * @private
   */
  function ensureSidebarInBody() {
    log('Ensuring sidebar in Shadow DOM...');
    
    // Ensure root container exists
    getRootContainer();
    
    // Inject DEBUG sidebar into Shadow DOM
    injectDebugSidebar();
    
    log('✅ Sidebar check complete in Shadow DOM');
  }
  
  /**
   * Injects polish styles for floating buttons - glassmorphism & clipping fixes.
   */
  function injectPolishStyles() {
    if (document.getElementById('alismart-polish-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'alismart-polish-styles';
    styleEl.textContent = `
      /* Display Mode: OFF - Hide all buttons */
      .alismart-display-off .alismart-action-btn,
      .alismart-display-off [data-alismart-btn] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
      
      /* Display Mode: ON - Always show buttons */
      .alismart-display-on .alismart-action-btn,
      .alismart-display-on [data-alismart-btn] {
        opacity: 1 !important;
        visibility: visible !important;
      }
      
      /* Display Mode: HOVER - Default opacity 0, show on hover */
      .alismart-display-hover .alismart-action-btn,
      .alismart-display-hover [data-alismart-btn] {
        opacity: 0 !important;
        transition: opacity 0.2s ease !important;
      }
      
      .alismart-display-hover .alismart-action-btn:hover,
      .alismart-display-hover [data-alismart-btn]:hover {
        opacity: 1 !important;
      }
      
      /* Simple clean floating button - Premium Gradient */
      .alismart-action-btn,
      [data-alismart-btn] {
        overflow: visible !important;
        border-radius: 50% !important;
        width: 44px !important;
        height: 44px !important;
        background: linear-gradient(135deg, #ff6b6b 0%, #f06595 50%, #cc5de8 100%) !important;
        box-shadow: 0 4px 15px rgba(240, 101, 149, 0.4), 0 0 0 1px rgba(255,255,255,0.2) inset !important;
        border: none !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        backdrop-filter: blur(10px) !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }
      
      .alismart-action-btn:hover,
      [data-alismart-btn]:hover {
        transform: scale(1.1) !important;
        background: linear-gradient(135deg, #ff8585 0%, #f585b0 50%, #d97af0 100%) !important;
        box-shadow: 0 6px 25px rgba(240, 101, 149, 0.5), 0 0 0 2px rgba(255,255,255,0.3) inset !important;
      }
      
      /* Active/pressed state */
      .alismart-action-btn:active,
      [data-alismart-btn]:active {
        transform: scale(0.95) !important;
      }
      
      /* Ensure product cards don't clip buttons */
      [data-pl], [data-product-id], .search-item, .search-card-item, 
      .list-item, .product-item, .product-card, [class*="ProductCard"] {
        overflow: visible !important;
        position: relative !important;
      }
      
      /* RTL support */
      html[dir="rtl"] .alismart-action-btn,
      html[dir="rtl"] [data-alismart-btn],
      html[lang="he"] .alismart-action-btn,
      html[lang="he"] [data-alismart-btn],
      html[lang="ar"] .alismart-action-btn,
      html[lang="ar"] [data-alismart-btn] {
        right: auto !important;
        left: 8px !important;
      }
    `;
    
    document.head.appendChild(styleEl);
    log('Polish styles injected');
  }
  
  /**
   * Sets the display mode for floating buttons.
   * Applies CSS classes to body to control button visibility.
   * Ensures immediate DOM updates for ALWAYS ON mode.
   * @param {string} mode - Display mode: 'on', 'hover', or 'off'
   */
  function setDisplayMode(mode) {
    const body = document.body;
    if (!body) return;
    
    // Remove existing mode classes
    body.classList.remove('alismart-display-on', 'alismart-display-hover', 'alismart-display-off');
    
    // Force reflow to ensure classes are removed before adding new ones
    void body.offsetHeight;
    
    // Add new mode class
    switch (mode) {
      case 'off':
        body.classList.add('alismart-display-off');
        log('Display mode set to: OFF');
        break;
      case 'hover':
        body.classList.add('alismart-display-hover');
        log('Display mode set to: HOVER ONLY');
        break;
      case 'on':
      default:
        body.classList.add('alismart-display-on');
        log('Display mode set to: ALWAYS ON');
        // Ensure all existing buttons are visible immediately
        updateButtonVisibility();
        break;
    }
    
    // Save to storage for persistence
    try {
      chrome.storage.local.set({ alismart_display_mode: mode });
    } catch (e) {
      // Storage may not be available
    }
  }

  /**
   * Updates visibility of all injected buttons based on current display mode
   */
  function updateButtonVisibility() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    
    const buttons = shadow.querySelectorAll('[data-alismart-btn]');
    const isAlwaysOn = document.body?.classList.contains('alismart-display-on');
    
    buttons.forEach(button => {
      if (isAlwaysOn) {
        button.style.opacity = '1';
        button.style.visibility = 'visible';
      } else {
        button.style.opacity = '0';
      }
    });
    
    log('Button visibility updated:', buttons.length, 'buttons');
  }
  
  /**
   * Loads saved display mode from storage and applies it.
   */
  async function loadDisplayMode() {
    try {
      const result = await chrome.storage.local.get(['alismart_display_mode']);
      const mode = result.alismart_display_mode || 'on';
      setDisplayMode(mode);
      log('Display mode loaded:', mode);
    } catch (error) {
      // Default to 'on' if storage access fails
      setDisplayMode('on');
    }
  }
  
  /**
   * Sets up message listener for display mode changes from sidebar.
   */
  function setupDisplayModeListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'DISPLAY_MODE_CHANGE') {
        setDisplayMode(request.mode);
        sendResponse({ success: true, mode: request.mode });
      }
      return true;
    });
    log('Display mode listener set up');
  }
  
  // ─── Checkout Optimizer Bar Functions ──────────────────────────────
  
  /**
   * Checks if current page is cart or checkout
   */
  function isCartOrCheckoutPage() {
    const url = window.location.href;
    const patterns = [
      '/cart',
      '/shoppingcart', 
      '/checkout',
      '/order/confirm',
      '/payment',
      '/buyNow',
      '/placeorder'
    ];
    return patterns.some(p => url.includes(p));
  }
  
  /**
   * Injects checkout optimizer bar at top of page
   */
  async function injectCheckoutBar() {
    // Remove existing bar
    const existing = document.getElementById('alismart-checkout-bar');
    if (existing) existing.remove();
    
    // Request cart analysis from background
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SCAN_CART' });
      if (!response?.success) return;
      
      const bar = createCheckoutBar(response.optimizations, response.dealGrade, response.totalSavings);
      document.body.insertBefore(bar, document.body.firstChild);
      document.body.classList.add('alismart-checkout-bar-visible');
      
    } catch (error) {
      log('Checkout bar injection failed:', error);
    }
  }
  
  /**
   * Creates checkout bar element
   */
  function createCheckoutBar(optimizations, dealGrade, totalSavings) {
    const bar = document.createElement('div');
    bar.id = 'alismart-checkout-bar';
    
    const gradeColors = {
      'A+': '#00d084',
      'A': '#00d084',
      'B': '#ffa500',
      'C': '#ff6a00',
      'D': '#ee0979'
    };
    
    const gradeColor = gradeColors[dealGrade?.grade] || '#888';
    const hasOptimizations = optimizations && optimizations.length > 0;
    
    bar.innerHTML = `
      <div class="alismart-bar-brand">
        <div class="alismart-bar-logo">AS</div>
        <span class="alismart-bar-title">Smart Checkout</span>
      </div>
      
      <div class="alismart-bar-grade">
        <span class="alismart-bar-grade-badge" style="background-color: ${gradeColor}">${dealGrade?.grade || '-'}</span>
        ${totalSavings > 0 ? `<span class="alismart-bar-savings">Save $${totalSavings.toFixed(2)}</span>` : ''}
      </div>
      
      <div class="alismart-bar-summary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        ${hasOptimizations ? `${optimizations.length} ways to save found` : 'Your cart is optimized'}
      </div>
      
      ${hasOptimizations ? `
        <button class="alismart-bar-action" onclick="window.postMessage({type: 'ALISMART_OPEN_CHECKOUT'}, '*')">
          Optimize Now
        </button>
      ` : ''}
      
      <button class="alismart-bar-close" onclick="this.closest('#alismart-checkout-bar').remove(); document.body.classList.remove('alismart-checkout-bar-visible')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    
    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      #alismart-checkout-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2147483647 !important;
        background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: 12px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        animation: slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .alismart-bar-brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
      .alismart-bar-logo {
        width: 28px; height: 28px;
        background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%);
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 700; font-size: 12px;
      }
      .alismart-bar-title { color: #fff; font-size: 14px; font-weight: 600; }
      .alismart-bar-grade { display: flex; align-items: center; gap: 12px; padding: 6px 14px; background: rgba(255,255,255,0.1); border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); }
      .alismart-bar-grade-badge { padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 700; color: white; }
      .alismart-bar-savings { color: #00d084; font-size: 14px; font-weight: 600; }
      .alismart-bar-summary { flex: 1; display: flex; align-items: center; gap: 8px; color: #b8b8d1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .alismart-bar-action { padding: 8px 18px; background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%); border: none; border-radius: 8px; color: white; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0; }
      .alismart-bar-action:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(238, 9, 121, 0.4); }
      .alismart-bar-close { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border: none; border-radius: 6px; color: #888; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0; }
      .alismart-bar-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
      body.alismart-checkout-bar-visible { padding-top: 56px !important; }
    `;
    bar.appendChild(styles);
    
    return bar;
  }
  
  /**
   * Sets up observer for SPA navigation on checkout pages
   */
  function setupCheckoutPageObserver() {
    let lastUrl = location.href;
    
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (isCartOrCheckoutPage()) {
          setTimeout(injectCheckoutBar, 500);
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  /**
   * Checks if current page is an address/shipping page
   */
  function isAddressPage() {
    const url = window.location.href;
    const patterns = [
      '/address',
      '/shipping',
      '/delivery',
      '/account/address',
      '/member/address',
      '/order/address'
    ];
    return patterns.some(p => url.includes(p));
  }

  /**
   * Injects magic fill button for address pages
   */
  function injectMagicFillButton() {
    // Check if button already exists
    if (document.getElementById('alismart-magic-fill')) return;
    
    const rootContainer = getRootContainer();
    if (!rootContainer) return;
    
    const btn = document.createElement('button');
    btn.id = 'alismart-magic-fill';
    btn.textContent = '✨ Auto Fill Address';
    btn.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      padding: 12px 20px !important;
      background: linear-gradient(135deg, #ff6a00, #ee0979) !important;
      color: white !important;
      border: none !important;
      border-radius: 8px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      box-shadow: 0 4px 15px rgba(238,9,121,0.4) !important;
    `;
    
    btn.addEventListener('click', () => {
      // Dispatch custom event for address filling
      window.dispatchEvent(new CustomEvent('ALISMART_FILL_ADDRESS'));
    });
    
    rootContainer.appendChild(btn);
    log('Magic fill button injected');
  }

  /**
   * Injects DEBUG sidebar with singleton pattern.
   * Aborts if sidebar already exists to prevent duplication.
   */
  function injectDebugSidebar() {
    // ANTI-DUPLICATION: Check if sidebar root already exists
    if (document.getElementById('alismart-sidebar-root') || document.getElementById('ali-smart-sidebar')) {
      log('Sidebar already exists, skipping injection');
      return;
    }
    
    // Also check shadow DOM
    const shadow = getShadowRoot();
    if (shadow && shadow.getElementById('ali-smart-sidebar')) {
      log('Sidebar already exists in shadow DOM');
      return;
    }
    
    const sidebarId = 'ali-smart-sidebar';
    
    if (!shadow) {
      log('Cannot inject sidebar: no shadow root');
      return;
    }
    
    const sidebar = document.createElement('div');
    sidebar.id = sidebarId;
    sidebar.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      width: 380px !important;
      height: 100vh !important;
      background: linear-gradient(135deg, rgba(26, 26, 46, 0.85) 0%, rgba(22, 33, 62, 0.9) 100%) !important;
      backdrop-filter: blur(20px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
      color: white !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-shadow: 
        -10px 0 40px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset !important;
      border-left: 2px solid rgba(255, 106, 0, 0.4) !important;
      overflow-y: auto !important;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
      animation: sidebarGlow 4s ease-in-out infinite !important;
    `;
    
    sidebar.innerHTML = `
      <style>
        @keyframes sidebarGlow {
          0%, 100% { box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 30px rgba(255, 106, 0, 0.1); }
          50% { box-shadow: -10px 0 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.15) inset, 0 0 50px rgba(255, 106, 0, 0.2); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      </style>
      <div style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid rgba(255,106,0,0.3); position: relative;">
          <div style="position: absolute; bottom: -2px; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #ff6a00, #ee0979, transparent); background-size: 200% 100%; animation: shimmer 3s linear infinite;"></div>
          <h2 style="margin: 0; font-size: 26px; background: linear-gradient(90deg, #ff6a00, #ee0979, #ff6a00); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 3s linear infinite;">AliSmart ✨</h2>
          <button id="as-close-sidebar" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,106,0,0.3); color: #ff6a00; font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; backdrop-filter: blur(10px);">×</button>
        </div>
        <div id="as-product-list" style="display: flex; flex-direction: column; gap: 15px;"></div>
      </div>
    `;
    
    shadow.appendChild(sidebar);
    
    // Add close button handler - CLEANUP ON CLOSE
    const closeBtn = sidebar.querySelector('#as-close-sidebar');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        sidebar.style.transform = 'translateX(100%)';
        setTimeout(() => {
          // Remove sidebar from shadow DOM
          sidebar.remove();
          // Remove root container from document
          const rootContainer = document.getElementById(ROOT_CONTAINER_ID);
          if (rootContainer) {
            rootContainer.remove();
          }
          // Reset the global lock flag to allow re-injection
          window.aliSmartLoaded = false;
          log('Sidebar removed, global lock reset');
        }, 300);
      });
    }
    
    log('Debug sidebar injected into shadow DOM');
  }

  /**
   * ============================================
   * FEATURE 1: PRICE HISTORY TRACKING
   * ============================================
   */
  const PRICE_HISTORY_KEY = 'alismart_price_history';
  const MAX_HISTORY_DAYS = 90;

  async function savePriceHistory(productId, price, title, imgUrl) {
    try {
      const result = await chrome.storage.local.get(PRICE_HISTORY_KEY);
      const history = result[PRICE_HISTORY_KEY] || {};
      
      if (!history[productId]) {
        history[productId] = {
          title,
          imgUrl,
          prices: []
        };
      }
      
      history[productId].prices.push({
        price: parseFloat(price),
        date: new Date().toISOString(),
        timestamp: Date.now()
      });
      
      // Keep only last 90 days
      const cutoff = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
      history[productId].prices = history[productId].prices.filter(p => p.timestamp > cutoff);
      
      await chrome.storage.local.set({ [PRICE_HISTORY_KEY]: history });
      log('💰 Price history saved for:', title.substring(0, 30));
    } catch (err) {
      log('Error saving price history:', err);
    }
  }

  async function getPriceHistory(productId) {
    try {
      const result = await chrome.storage.local.get(PRICE_HISTORY_KEY);
      const history = result[PRICE_HISTORY_KEY] || {};
      return history[productId] || null;
    } catch (err) {
      log('Error getting price history:', err);
      return null;
    }
  }

  function getPriceTrend(prices) {
    if (!prices || prices.length < 2) return { trend: 'stable', change: 0 };
    
    const sorted = [...prices].sort((a, b) => a.timestamp - b.timestamp);
    const oldPrice = sorted[0].price;
    const newPrice = sorted[sorted.length - 1].price;
    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    
    if (change < -5) return { trend: 'down', change, emoji: '📉' };
    if (change > 5) return { trend: 'up', change, emoji: '📈' };
    return { trend: 'stable', change, emoji: '➡️' };
  }

  /**
   * ============================================
   * FEATURE 2: PRICE DROP ALERTS
   * ============================================
   */
  const ALERTS_KEY = 'alismart_price_alerts';
  const NOTIFICATIONS_ENABLED = 'alismart_notifications_enabled';

  async function setPriceAlert(productId, targetPrice, currentPrice, title) {
    try {
      const result = await chrome.storage.local.get(ALERTS_KEY);
      const alerts = result[ALERTS_KEY] || {};
      
      alerts[productId] = {
        targetPrice: parseFloat(targetPrice),
        currentPrice: parseFloat(currentPrice),
        title,
        createdAt: Date.now(),
        triggered: false
      };
      
      await chrome.storage.local.set({ [ALERTS_KEY]: alerts });
      showNotification(`🔔 התראה נוצרה! נודיע כש-${title.substring(0, 25)} יורד מתחת ל-${targetPrice} ₪`);
    } catch (err) {
      log('Error setting price alert:', err);
    }
  }

  async function checkPriceAlerts(productId, currentPrice) {
    try {
      const result = await chrome.storage.local.get(ALERTS_KEY);
      const alerts = result[ALERTS_KEY] || {};
      const alert = alerts[productId];
      
      if (alert && !alert.triggered && currentPrice <= alert.targetPrice) {
        alert.triggered = true;
        alert.triggeredAt = Date.now();
        await chrome.storage.local.set({ [ALERTS_KEY]: alerts });
        
        showNotification(`🎉 ירידת מחיר! ${alert.title.substring(0, 25)} עכשיו ב-${currentPrice} ₪! (היעד: ${alert.targetPrice} ₪)`);
        return true;
      }
      return false;
    } catch (err) {
      log('Error checking price alerts:', err);
      return false;
    }
  }

  /**
   * ============================================
   * FEATURE 3: WISHLIST WITH PRICE TRACKING
   * ============================================
   */
  const WISHLIST_KEY = 'alismart_wishlist';

  async function addToWishlist(productData) {
    try {
      const result = await chrome.storage.local.get(WISHLIST_KEY);
      const wishlist = result[WISHLIST_KEY] || {};
      
      const id = productData.id || generateProductId(productData);
      wishlist[id] = {
        ...productData,
        id,
        addedAt: Date.now(),
        originalPrice: productData.price,
        lowestPrice: productData.price,
        highestPrice: productData.price
      };
      
      await chrome.storage.local.set({ [WISHLIST_KEY]: wishlist });
      showNotification(`💖 נוסף לרשימת המשאלות: ${productData.title.substring(0, 25)}`);
      updateWishlistUI();
    } catch (err) {
      log('Error adding to wishlist:', err);
    }
  }

  async function removeFromWishlist(productId) {
    try {
      const result = await chrome.storage.local.get(WISHLIST_KEY);
      const wishlist = result[WISHLIST_KEY] || {};
      delete wishlist[productId];
      await chrome.storage.local.set({ [WISHLIST_KEY]: wishlist });
      updateWishlistUI();
    } catch (err) {
      log('Error removing from wishlist:', err);
    }
  }

  async function getWishlist() {
    try {
      const result = await chrome.storage.local.get(WISHLIST_KEY);
      return result[WISHLIST_KEY] || {};
    } catch (err) {
      log('Error getting wishlist:', err);
      return {};
    }
  }

  function generateProductId(product) {
    return btoa(product.title + product.price).substring(0, 20);
  }

  /**
   * ============================================
   * FEATURE 4: CURRENCY CONVERTER
   * ============================================
   */
  const EXCHANGE_RATES = {
    ILS: { USD: 0.27, EUR: 0.25, GBP: 0.21 },
    USD: { ILS: 3.7, EUR: 0.92, GBP: 0.79 },
    EUR: { ILS: 4.0, USD: 1.09, GBP: 0.86 },
    GBP: { ILS: 4.65, USD: 1.27, EUR: 1.16 }
  };

  let currentCurrency = 'ILS';

  async function loadCurrencyPreference() {
    try {
      const result = await chrome.storage.local.get('alismart_currency');
      currentCurrency = result.alismart_currency || 'ILS';
    } catch (err) {
      currentCurrency = 'ILS';
    }
  }

  function convertPrice(price, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return price;
    const rate = EXCHANGE_RATES[fromCurrency]?.[toCurrency] || 1;
    return (price * rate).toFixed(2);
  }

  function formatPrice(price, currency) {
    const symbols = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
    const symbol = symbols[currency] || '₪';
    return `${symbol}${parseFloat(price).toFixed(2)}`;
  }

  /**
   * ============================================
   * FEATURE 5: KEYBOARD SHORTCUTS
   * ============================================
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt + S = Toggle Sidebar
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        toggleSidebar();
      }
      // Alt + F = Focus Search
      if (e.altKey && e.key === 'f') {
        e.preventDefault();
        focusSearchInput();
      }
      // Alt + W = Add to Wishlist (when on product page)
      if (e.altKey && e.key === 'w') {
        e.preventDefault();
        addCurrentProductToWishlist();
      }
      // Alt + C = Toggle Currency
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        cycleCurrency();
      }
      // Escape = Close Sidebar
      if (e.key === 'Escape') {
        closeSidebar();
      }
    });
    log('⌨️ Keyboard shortcuts initialized: Alt+S (sidebar), Alt+F (search), Alt+W (wishlist), Alt+C (currency), Esc (close)');
  }

  function cycleCurrency() {
    const currencies = ['ILS', 'USD', 'EUR', 'GBP'];
    const currentIndex = currencies.indexOf(currentCurrency);
    const nextIndex = (currentIndex + 1) % currencies.length;
    currentCurrency = currencies[nextIndex];
    chrome.storage.local.set({ alismart_currency: currentCurrency });
    showNotification(`💱 מטבע שונה ל-${currentCurrency}`);
    refreshAllPrices();
  }

  /**
   * ============================================
   * FEATURE 6: SHIPPING TIME ESTIMATOR
   * ============================================
   */
  function estimateShippingTime(shippingText, sellerLocation = 'CN') {
    const estimates = {
      'CN': { min: 15, max: 45, text: '15-45 ימים מסין' },
      'US': { min: 7, max: 20, text: '7-20 ימים מארה"ב' },
      'EU': { min: 10, max: 25, text: '10-25 ימים מאירופה' },
      'IL': { min: 3, max: 7, text: '3-7 ימים מישראל' }
    };
    
    // Check for express shipping indicators
    if (shippingText && /express|fast|quick|priority/i.test(shippingText)) {
      return { min: 7, max: 15, text: '7-15 ימים (מהיר)', priority: true };
    }
    
    // Check for free shipping
    if (shippingText && /free/i.test(shippingText)) {
      return estimates['CN']; // Default free shipping from China
    }
    
    return estimates[sellerLocation] || estimates['CN'];
  }

  /**
   * ============================================
   * FEATURE 7: EXPORT PRODUCT DATA
   * ============================================
   */
  async function exportProductData(format = 'csv') {
    try {
      const products = await getWishlist();
      const productArray = Object.values(products);
      
      if (format === 'csv') {
        const csv = convertToCSV(productArray);
        downloadFile(csv, 'alismart_products.csv', 'text/csv');
      } else if (format === 'json') {
        const json = JSON.stringify(productArray, null, 2);
        downloadFile(json, 'alismart_products.json', 'application/json');
      }
      
      showNotification(`📥 יוצאו ${productArray.length} מוצרים בהצלחה!`);
    } catch (err) {
      log('Error exporting:', err);
      showNotification('❌ שגיאה בייצוא');
    }
  }

  function convertToCSV(products) {
    const headers = ['Title', 'Price', 'Currency', 'URL', 'Added Date', 'Lowest Price', 'Highest Price'];
    const rows = products.map(p => [
      `"${p.title}"`,
      p.price,
      currentCurrency,
      p.url || '',
      new Date(p.addedAt).toLocaleDateString(),
      p.lowestPrice,
      p.highestPrice
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * ============================================
   * FEATURE 8: NOTIFICATION SYSTEM
   * ============================================
   */
  function showNotification(message, duration = 4000) {
    const shadow = getShadowRoot();
    if (!shadow) return;
    
    const notif = document.createElement('div');
    notif.className = 'as-notification';
    notif.textContent = message;
    notif.style.cssText = `
      position: fixed !important;
      bottom: 100px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: linear-gradient(135deg, rgba(238, 9, 121, 0.9), rgba(255, 106, 0, 0.9)) !important;
      backdrop-filter: blur(16px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
      color: white !important;
      padding: 16px 32px !important;
      border-radius: 50px !important;
      font-weight: 600 !important;
      z-index: 2147483647 !important;
      box-shadow: 
        0 8px 32px rgba(238, 9, 121, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.2) inset,
        0 0 20px rgba(255, 106, 0, 0.3) !important;
      animation: notifSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      max-width: 90% !important;
      text-align: center !important;
      direction: rtl !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    `;
    
    shadow.appendChild(notif);
    
    setTimeout(() => {
      notif.style.animation = 'notifSlideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards';
      setTimeout(() => notif.remove(), 400);
    }, duration);
  }

  /**
   * ============================================
   * FEATURE 9: REVIEW SENTIMENT ANALYSIS (Basic)
   * ============================================
   */
  function analyzeSentiment(text) {
    const positiveWords = ['great', 'excellent', 'amazing', 'love', 'perfect', 'good', 'best', 'awesome', 'quality', 'recommend', 'מעולה', 'מצוין', 'אהבה', 'מושלם', 'טוב', 'מומלץ'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'broken', 'defective', 'garbage', 'scam', 'גרוע', 'נורא', 'שבור', 'פגום', 'זבל', 'הונאה'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positive = 0, negative = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positive++;
      if (negativeWords.some(nw => word.includes(nw))) negative++;
    });
    
    if (positive > negative) return { sentiment: 'positive', score: positive - negative, emoji: '😊' };
    if (negative > positive) return { sentiment: 'negative', score: negative - positive, emoji: '😞' };
    return { sentiment: 'neutral', score: 0, emoji: '😐' };
  }

  /**
   * ============================================
   * FEATURE 10: DARK/LIGHT MODE TOGGLE
   * ============================================
   */
  let isDarkMode = true;

  async function loadThemePreference() {
    try {
      const result = await chrome.storage.local.get('alismart_theme');
      isDarkMode = result.alismart_theme !== 'light';
      applyTheme();
    } catch (err) {
      isDarkMode = true;
    }
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    chrome.storage.local.set({ alismart_theme: isDarkMode ? 'dark' : 'light' });
    applyTheme();
    showNotification(isDarkMode ? '🌙 מצב כהה' : '☀️ מצב בהיר');
  }

  function applyTheme() {
    const shadow = getShadowRoot();
    if (!shadow) return;
    
    const sidebar = shadow.getElementById('ali-smart-sidebar');
    if (sidebar) {
      if (!isDarkMode) {
        sidebar.style.filter = 'invert(1) hue-rotate(180deg)';
      } else {
        sidebar.style.filter = '';
      }
    }
  }

  /**
   * Injects sidebar if needed - wrapper for injectDebugSidebar
   */
  function injectSidebarIfNeeded() {
    injectDebugSidebar();
  }

  /**
   * Scans existing products on page load and injects buttons
   */
  function scanExistingProducts() {
    log('Scanning existing products on page...');
    
    // Modern AliExpress selectors
    const selectors = [
      '[data-pl]',
      '[data-product-id]',
      '.search-item',
      '.search-card-item',
      '[class*="multi--container"]',
      '[class*="multi--item"]',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      '.product-item',
      '.grid-item'
    ];
    
    let foundCount = 0;
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (isValidProductCard(el) && !el.querySelector('[data-alismart-btn]')) {
            const data = extractProductData(el);
            if (data.title && data.title !== 'Unknown Product') {
              injectButtonIntoProduct(el, data);
              foundCount++;
            }
          }
        });
      } catch (e) {
        // Skip invalid selectors
      }
    });
    
    log(`Scanned and processed ${foundCount} existing products`);
  }

  /**
   * ============================================
   * MAIN ENTRY POINT
   * ============================================
   */
  function init() {
    // Critical: Ensure isolated root container exists early
    getRootContainer();
    
    // Inject polish styles for floating buttons
    injectPolishStyles();
    
    // Inject product sidebar early into Shadow DOM
    injectSidebarIfNeeded();
    
    // Set up display mode listener
    setupDisplayModeListener();
    
    // Load saved display mode
    loadDisplayMode();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Load currency preference
    loadCurrencyPreference();
    
    // Load theme preference
    loadThemePreference();
    
    // Critical: Run immediately
    initCritical();
    
    // Scan existing products on page load
    setTimeout(scanExistingProducts, 500);
    
    // Non-critical: Defer using requestIdleCallback or timeout
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(initNonCritical, { timeout: 2000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(initNonCritical, 100);
    }
    
    // Check if we're on an address page and inject magic fill button
    if (isAddressPage()) {
      setTimeout(injectMagicFillButton, 1500);
    }
    
    // Check if we're on cart/checkout page and inject checkout optimizer bar
    if (isCartOrCheckoutPage()) {
      setTimeout(injectCheckoutBar, 1000);
      // Re-inject on URL changes (SPA navigation)
      setupCheckoutPageObserver();
    }
    
    log('AliSmart initialized successfully with 10 new features! 🚀');
  }

  // ─── Entry Points ────────────────────────────────────────────────────
  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();

