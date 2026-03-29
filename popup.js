// AliSmart Finder v4.0 — Popup Settings & Search Logic

document.addEventListener('DOMContentLoaded', () => {
  const sortBySelect = document.getElementById('sortBy');
  const resultsPerPageSelect = document.getElementById('resultsPerPage');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const resultsContainer = document.getElementById('results');
  const quickEntryBtn = document.getElementById('quickEntryBtn');

  // --- Quick Entry Button ---
  if (quickEntryBtn) {
    quickEntryBtn.addEventListener('click', async () => {
      const AFFILIATE_API_URL = 'https://alismart-proxy.vercel.app/api/generate-affiliate';
      
      try {
        quickEntryBtn.disabled = true;
        quickEntryBtn.textContent = '🛍️ loading...';
        
        // 404 Error Handler: Log complete URL before fetching
        console.log('[AliSmart Popup] Fetching URL:', AFFILIATE_API_URL);
        
        const response = await fetch(AFFILIATE_API_URL, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        // 404 Error Handler: Specific handling for 404 errors
        if (response.status === 404) {
          console.error('[AliSmart Popup] 404 Error: Server endpoint not found');
          showStatus('error', 'Server endpoint not found. Please check API configuration.');
          window.open('https://www.aliexpress.com', '_blank');
          return;
        }
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        const promotionLink = data?.promotion_link;
        
        if (promotionLink) {
          window.open(promotionLink, '_blank');
        } else {
          throw new Error('No promotion_link in response');
        }
      } catch (error) {
        // Handle error gracefully - show message and open AliExpress directly
        console.log('[AliSmart] Quick entry: Affiliate API unavailable, opening AliExpress directly');
        showStatus('info', 'Opening AliExpress directly...');
        window.open('https://www.aliexpress.com', '_blank');
      } finally {
        quickEntryBtn.disabled = false;
        quickEntryBtn.textContent = '🛍️ Quick Entry to AliExpress';
      }
    });
  }

  // --- Load saved preferences ---
  chrome.storage.sync.get(
    ['SORT_BY', 'RESULTS_PER_PAGE'],
    (result) => {
      if (result.SORT_BY) sortBySelect.value = result.SORT_BY;
      if (result.RESULTS_PER_PAGE) resultsPerPageSelect.value = result.RESULTS_PER_PAGE.toString();
    }
  );

  // --- Save preferences ---
  saveBtn.addEventListener('click', () => {
    const config = {
      CURRENCY: 'USD',
      SORT_BY: sortBySelect.value,
      RESULTS_PER_PAGE: parseInt(resultsPerPageSelect.value),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    chrome.storage.sync.set(config, () => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
      if (chrome.runtime.lastError) {
        showStatus('error', 'Could not save. Please try again.');
      } else {
        showStatus('success', 'Settings saved!');
      }
    });
  });

  // --- Search Logic ---
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      // CRITICAL: Always get fresh value from input field using getElementById
      const query = document.getElementById('searchInput').value.trim();
      console.log('[AliSmart Popup] Search button clicked, query:', query);
      if (query) {
        performSearch(query);
      } else {
        showStatus('error', 'Please enter a search term');
      }
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        // CRITICAL: Always get fresh value from input field using getElementById
        const query = document.getElementById('searchInput').value.trim();
        console.log('[AliSmart Popup] Enter key pressed, query:', query);
        if (query) {
          performSearch(query);
        } else {
          showStatus('error', 'Please enter a search term');
        }
      }
    });
  }

  function performSearch(userQuery) {
    // Context Check: Verify extension context is valid before proceeding
    if (chrome.runtime.lastError) {
      console.error('[AliSmart Popup] Context invalidated:', chrome.runtime.lastError);
      showContextInvalidatedError();
      return;
    }
    
    // SECURE RENDERING: Clear previous results safely using textContent
    if (resultsContainer) {
      resultsContainer.textContent = '';
    }
    
    // Show loading state - SECURE RENDERING using createElement
    let searchFeedbackTimer = null;
    if (resultsContainer) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'status loading';
      loadingDiv.textContent = 'Searching...';
      resultsContainer.appendChild(loadingDiv);
      
      // After 2 seconds, update to show the keyword being searched
      searchFeedbackTimer = setTimeout(() => {
        if (resultsContainer) {
          resultsContainer.textContent = '';
          const searchingDiv = document.createElement('div');
          searchingDiv.className = 'status loading';
          const truncatedQuery = userQuery.length > 40 ? userQuery.substring(0, 40) + '...' : userQuery;
          searchingDiv.textContent = 'Searching for: ' + truncatedQuery + '...';
          resultsContainer.appendChild(searchingDiv);
        }
      }, 2000);
    }
    
    // Disable search button during search
    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.textContent = 'Searching...';
    }

    // Add timestamp to prevent caching and ensure fresh results
    const timestamp = Date.now();
    
    // CRITICAL: Properly encode the query using encodeURIComponent (handles Hebrew and special characters)
    const encodedQuery = encodeURIComponent(userQuery);
    
    console.log('[AliSmart Popup] Searching for:', userQuery);
    console.log('[AliSmart Popup] Encoded query:', encodedQuery);
    console.log('[AliSmart Popup] Timestamp:', timestamp);

    // Context Check: Verify context before sending message
    if (chrome.runtime.lastError) {
      console.error('[AliSmart Popup] Cannot send message - context invalidated');
      showContextInvalidatedError();
      return;
    }

    chrome.runtime.sendMessage({
      type: 'SEARCH_REQUEST',
      query: userQuery,  // Send original query, encoding happens in background.js
      encodedQuery: encodedQuery,  // Also send encoded version for reference
      timestamp: timestamp  // Force fresh request
    }, (response) => {
      // Clear the feedback timer
      if (searchFeedbackTimer) {
        clearTimeout(searchFeedbackTimer);
        searchFeedbackTimer = null;
      }
      
      // Re-enable search button
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search';
      }
      
      // Context Check: Handle context invalidated error
      if (chrome.runtime.lastError) {
        console.error('[AliSmart Popup] Search error:', chrome.runtime.lastError);
        showContextInvalidatedError();
        return;
      }

      if (response && response.success && response.products && response.products.length > 0) {
        console.log('[AliSmart Popup] Found', response.products.length, 'products');
        displayResults(response.products, userQuery);
      } else if (response && response.success && (!response.products || response.products.length === 0)) {
        // Server returned success but empty list (possibly due to filtering)
        console.log('[AliSmart Popup] No suitable results found for query:', userQuery);
        if (resultsContainer) {
          resultsContainer.textContent = '';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'status error';
          errorDiv.textContent = 'No items found matching your criteria.';
          
          const retryBtn = document.createElement('button');
          retryBtn.className = 'btn-secondary';
          retryBtn.id = 'retryBtn';
          retryBtn.style.marginTop = '8px';
          retryBtn.textContent = 'Retry Now';
          retryBtn.addEventListener('click', () => {
            performSearch(userQuery);
          });
          
          errorDiv.appendChild(retryBtn);
          resultsContainer.appendChild(errorDiv);
        }
      } else {
        console.log('[AliSmart Popup] Search failed for query:', userQuery);
        // SECURE RENDERING: Clear results and show retry button using createElement
        if (resultsContainer) {
          resultsContainer.textContent = '';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'status error';
          errorDiv.textContent = 'Searching for the best alternatives...';
          
          const retryBtn = document.createElement('button');
          retryBtn.className = 'btn-secondary';
          retryBtn.id = 'retryBtn';
          retryBtn.style.marginTop = '8px';
          retryBtn.textContent = 'Retry Now';
          retryBtn.addEventListener('click', () => {
            performSearch(userQuery);
          });
          
          errorDiv.appendChild(retryBtn);
          resultsContainer.appendChild(errorDiv);
        }
      }
    });
  }
  
  // Context Check: Helper function to show context invalidated error
  function showContextInvalidatedError() {
    showStatus('error', 'Extension context invalidated. Please refresh the page.');
    if (resultsContainer) {
      resultsContainer.textContent = '';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'status error';
      errorDiv.textContent = 'Extension context invalidated.';
      
      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'btn-secondary';
      refreshBtn.style.marginTop = '8px';
      refreshBtn.textContent = 'Refresh AliExpress Page';
      refreshBtn.addEventListener('click', () => {
        // Send message to refresh the current tab
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
      
      errorDiv.appendChild(refreshBtn);
      resultsContainer.appendChild(errorDiv);
    }
  }

  // --- Display Results ---
  function displayResults(products, userQuery) {
    if (!resultsContainer) return;
    
    // SECURE RENDERING: Clear all previous results using textContent
    resultsContainer.textContent = '';
    
    console.log('[AliSmart Popup] Displaying', products.length, 'products for query:', userQuery || 'unknown');
    
    // Log if any results were filtered out
    if (products.length === 0) {
      console.log('[AliSmart Popup] ⚠️ No safe results to display (all filtered)');
    }

    products.forEach((p) => {
      // SAFE RENDERING: Clean title and image by removing dangerous characters
      const rawTitle = p.product_title || p.title || 'Untitled';
      const rawImage = p.product_main_image_url || '';
      const rawPrice = p.target_sale_price || p.target_original_price || '';
      
      // Fix The ">" Bug: Remove characters that could break HTML: " > \ /
      const title = rawTitle.replace(/[">\\\/]/g, '');
      const price = rawPrice.replace(/[">\\\/]/g, '');
      
      // VISUAL CLEANUP: Apply url.replace(/[">]/g, '') to imgUrl
      let cleanImg = rawImage.replace(/[">]/g, '');
      
      // Protocol Check: Ensure image URL starts with https:
      if (cleanImg.startsWith('//')) {
        cleanImg = 'https:' + cleanImg;
      } else if (cleanImg.startsWith('http://')) {
        cleanImg = cleanImg.replace('http://', 'https://');
      } else if (cleanImg && !cleanImg.startsWith('https://') && !cleanImg.startsWith('http://')) {
        cleanImg = 'https://' + cleanImg;
      }
      
      const link = p.promotion_link || p.product_detail_url || '#';

      // SAFE RENDERING: Use createElement and textContent/setAttribute instead of innerHTML
      const card = document.createElement('a');
      card.className = 'product-card';
      card.href = link;
      card.target = '_blank';
      card.rel = 'noopener';
      
      // Add click tracking for analytics
      card.addEventListener('click', async () => {
        try {
          const result = await chrome.storage.local.get('alismart_search_stats');
          const stats = result.alismart_search_stats || { totalSearches: 0, productClicks: {} };
          
          const productId = p.product_id || p.id || btoa(title).substring(0, 20);
          if (!stats.productClicks[productId]) {
            stats.productClicks[productId] = { 
              title: title, 
              clicks: 0, 
              lastClicked: Date.now(),
              image: cleanImg
            };
          }
          stats.productClicks[productId].clicks++;
          stats.productClicks[productId].lastClicked = Date.now();
          
          await chrome.storage.local.set({ alismart_search_stats: stats });
          console.log('[AliSmart Analytics] Product clicked:', title);
        } catch (e) {
          // Ignore tracking errors
        }
      });
      
      // Create image element safely
      const img = document.createElement('img');
      img.setAttribute('src', cleanImg);
      img.setAttribute('alt', '');
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.onerror = function() {
        this.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'width:64px;height:64px;border-radius:8px;background:#f8f8f8;display:flex;align-items:center;justify-content:center;color:#999;font-size:24px;flex-shrink:0;';
        placeholder.textContent = '📷';
        this.parentElement.replaceChild(placeholder, this);
      };
      
      // Create product info container safely
      const productInfo = document.createElement('div');
      productInfo.className = 'product-info';
      
      const productTitle = document.createElement('div');
      productTitle.className = 'product-title';
      productTitle.textContent = title; // SAFE: Use textContent
      
      const productPrice = document.createElement('div');
      productPrice.className = 'product-price';
      productPrice.textContent = price; // SAFE: Use textContent
      
      productInfo.appendChild(productTitle);
      productInfo.appendChild(productPrice);
      
      card.appendChild(img);
      card.appendChild(productInfo);
      resultsContainer.appendChild(card);
    });
  }

  // --- Helpers ---
  // SECURE RENDERING: escapeHtml now uses textContent for security
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showStatus(type, message) {
    statusEl.className = 'status ' + type;
    statusEl.textContent = message; // SECURE RENDERING: Use textContent instead of innerHTML
    statusEl.style.display = 'block';
    setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
  }

  // --- Analytics Dashboard Functions ---
  
  /**
   * Gets search history and analyzes most frequent products
   * @returns {Promise<Object>} Analytics data with most frequent searches
   */
  async function getAnalyticsData() {
    try {
      const result = await chrome.storage.local.get(['ALISMART_SEARCH_HISTORY', 'alismart_search_stats']);
      const history = result.ALISMART_SEARCH_HISTORY || [];
      const stats = result.alismart_search_stats || { totalSearches: 0, productClicks: {} };
      
      // Count frequency of each search term
      const frequencyMap = {};
      history.forEach(item => {
        const term = item.term.toLowerCase().trim();
        frequencyMap[term] = (frequencyMap[term] || 0) + 1;
      });
      
      // Convert to array and sort by frequency
      const sortedSearches = Object.entries(frequencyMap)
        .map(([term, count]) => ({ term, count, lastSearched: history.find(h => h.term.toLowerCase() === term)?.timestamp }))
        .sort((a, b) => b.count - a.count);
      
      // Get most clicked products from search results
      const productClicks = Object.entries(stats.productClicks || {})
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);
      
      return {
        totalSearches: history.length,
        uniqueSearches: sortedSearches.length,
        topSearches: sortedSearches.slice(0, 5),
        mostFrequent: sortedSearches[0] || null,
        recentSearches: history.slice(0, 5),
        topProducts: productClicks,
        lastActivity: history.length > 0 ? history[0].timestamp : null
      };
    } catch (e) {
      console.error('[AliSmart Analytics] Error:', e);
      return null;
    }
  }
  
  /**
   * Displays analytics dashboard in the popup
   */
  async function showAnalyticsDashboard() {
    const analytics = await getAnalyticsData();
    if (!analytics) {
      showStatus('error', 'Could not load analytics');
      return;
    }
    
    // Create or get analytics container
    let analyticsContainer = document.getElementById('analytics-dashboard');
    if (!analyticsContainer) {
      analyticsContainer = document.createElement('div');
      analyticsContainer.id = 'analytics-dashboard';
      analyticsContainer.className = 'analytics-section';
      analyticsContainer.style.cssText = `
        background: rgba(13, 17, 23, 0.8);
        border: 1px solid rgba(139, 148, 158, 0.2);
        border-radius: 14px;
        padding: 16px;
        margin-top: 16px;
        backdrop-filter: blur(10px);
      `;
      
      // Insert after results
      const content = document.querySelector('.content');
      if (content) {
        content.insertBefore(analyticsContainer, content.querySelector('.info-box'));
      }
    }
    
    // Build analytics HTML
    const mostFrequentHtml = analytics.mostFrequent 
      ? `<div style="background: linear-gradient(135deg, rgba(255,107,107,0.15), rgba(204,93,232,0.15)); border-radius: 12px; padding: 12px; margin-bottom: 12px; border: 1px solid rgba(255,107,107,0.3);">
          <div style="font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">🔥 Most Searched</div>
          <div style="font-size: 16px; font-weight: 700; color: #f0f6fc; background: linear-gradient(135deg, #ff6b6b, #cc5de8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${escapeHtml(analytics.mostFrequent.term)}</div>
          <div style="font-size: 12px; color: #f06595; margin-top: 2px;">${analytics.mostFrequent.count} searches</div>
        </div>`
      : '<div style="color: #8b949e; text-align: center; padding: 12px;">No search data yet</div>';
    
    const topSearchesHtml = analytics.topSearches.length > 0
      ? `<div style="margin-bottom: 12px;">
          <div style="font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">📊 Top 5 Searches</div>
          ${analytics.topSearches.map((item, index) => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(139, 148, 158, 0.1); border-radius: 8px; margin-bottom: 6px;">
              <span style="font-size: 14px; font-weight: 700; color: #f06595; width: 20px;">${index + 1}</span>
              <span style="flex: 1; font-size: 13px; color: #f0f6fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.term)}</span>
              <span style="font-size: 11px; color: #8b949e; background: rgba(139, 148, 158, 0.2); padding: 2px 8px; border-radius: 10px;">${item.count}</span>
            </div>
          `).join('')}
        </div>`
      : '';
    
    const statsHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div style="background: rgba(13, 17, 23, 0.6); border-radius: 10px; padding: 10px; text-align: center; border: 1px solid rgba(139, 148, 158, 0.1);">
          <div style="font-size: 20px; font-weight: 700; color: #ff6b6b;">${analytics.totalSearches}</div>
          <div style="font-size: 10px; color: #8b949e; text-transform: uppercase;">Total Searches</div>
        </div>
        <div style="background: rgba(13, 17, 23, 0.6); border-radius: 10px; padding: 10px; text-align: center; border: 1px solid rgba(139, 148, 158, 0.1);">
          <div style="font-size: 20px; font-weight: 700; color: #cc5de8;">${analytics.uniqueSearches}</div>
          <div style="font-size: 10px; color: #8b949e; text-transform: uppercase;">Unique Terms</div>
        </div>
      </div>
    `;
    
    analyticsContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(139, 148, 158, 0.2);">
        <h3 style="margin: 0; font-size: 14px; color: #f0f6fc; font-weight: 600; display: flex; align-items: center; gap: 6px;">
          📈 Search Analytics
        </h3>
        <button id="refresh-analytics" style="background: rgba(139, 148, 158, 0.1); border: none; color: #8b949e; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; transition: all 0.2s;">Refresh</button>
      </div>
      ${statsHtml}
      ${mostFrequentHtml}
      ${topSearchesHtml}
    `;
    
    // Add refresh handler
    const refreshBtn = document.getElementById('refresh-analytics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.textContent = 'Loading...';
        setTimeout(() => showAnalyticsDashboard(), 500);
      });
    }
  }
  
  // Initialize analytics on load
  setTimeout(() => {
    showAnalyticsDashboard();
  }, 1000);
});