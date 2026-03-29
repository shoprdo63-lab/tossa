/**
 * AliSmart Finder Pro - Content Script Entry Point
 * נקודת כניסה לסקריפט התוכן - מזהה מוצרים ומזריק כפתור AliSmart
 * 
 * משתמש ב-MutationObserver כדי לזהות טעינה דינמית של מוצרים
 * מייצר Shadow DOM לבידוד CSS מהדף המארח
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import AliButton from './components/AliButton';
import PricePopup from './components/PricePopup';
import { useProductDetection } from './hooks/useProductDetection';
import { createShadowContainer, isValidProductCard } from './utils/domUtils';
import './styles/content.css';

// מעקב אחרי אלמנטים שכבר עובדו
const processedElements = new WeakSet();

// מעקב אחרי בחירות וריאציה נוכחיות
let currentVariantSelections = {
  color: null,
  size: null,
  model: null,
  other: {}
};

// מזהה מוצר נוכחי (לדף מוצר בודד)
let currentProductId = null;

// מצב חלונית השוואת מחירים
const comparisonPopupState = {
  host: null,
  shadowRoot: null,
  reactRoot: null,
  anchorButton: null,
  bestDeal: null,
};

let comparisonUpdateTimer = null;

const POPUP_COPY = {
  en: {
    saveNow: 'Save Now',
    viewDeal: 'View Deal',
    bestPrice: 'Best price found!',
    foundInSearch: 'found in our search.',
    savePrefix: 'Save',
    currentBestMessage: 'is currently the best available price.'
  },
  he: {
    saveNow: 'חסכו עכשיו',
    viewDeal: 'צפה בדיל',
    bestPrice: 'נמצא המחיר הטוב ביותר!',
    foundInSearch: 'נמצא בחיפוש שלנו.',
    savePrefix: 'חיסכון של',
    currentBestMessage: 'הוא כרגע המחיר הטוב ביותר.'
  }
};

function getPopupLanguage() {
  const pageLang = (document.documentElement.lang || '').toLowerCase();
  return pageLang.startsWith('he') ? 'he' : 'en';
}

function getPopupCopy() {
  return POPUP_COPY[getPopupLanguage()] || POPUP_COPY.en;
}

function isRTLLanguage() {
  return getPopupLanguage() === 'he' || document.dir === 'rtl';
}

function extractNumericPrice(rawPrice) {
  if (rawPrice == null) return 0;
  if (typeof rawPrice === 'number') return rawPrice;
  
  const normalized = String(rawPrice).replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function getCurrentProductPrice() {
  const selectors = [
    '[class*="price--current"]',
    '[class*="price-current"]',
    '[class*="price-sale"]',
    '[class*="uniform-banner-box-price"]',
    '[data-pl="product-price"]',
    '.price',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const value = extractNumericPrice(el.textContent || '');
    if (value > 0) return value;
  }

  return 0;
}

function extractCurrentProductForComparison() {
  const pageProduct = extractProductData(document.body);
  const currentPrice = getCurrentProductPrice();

  const idFromUrl = window.location.href.match(/\/item\/(\d+)\.html/)?.[1] ||
    window.location.pathname.match(/\/item\/(\d+)/)?.[1] ||
    '';

  return {
    title: pageProduct.title || document.title || '',
    imgUrl: pageProduct.imgUrl || '',
    productId: pageProduct.productId || idFromUrl,
    price: currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : pageProduct.price,
    currentPrice,
  };
}

function getBuyButtons() {
  const selectors = [
    'button[class*="buy-now"]',
    'button[class*="add-to-cart"]',
    'button[class*="buy"]',
    '[data-pl="buy-now"]',
    '[data-pl="add-to-cart"]',
    'button[aria-label*="Buy"]',
    'button[aria-label*="Cart"]',
    'button[aria-label*="קנייה"]',
    'button[aria-label*="עגלה"]',
  ];

  const buttons = [];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((btn) => {
      const text = (btn.textContent || '').toLowerCase();
      if (
        text.includes('buy') ||
        text.includes('cart') ||
        text.includes('קנה') ||
        text.includes('קנייה') ||
        text.includes('עגלה')
      ) {
        buttons.push(btn);
      }
    });
  });

  return [...new Set(buttons)].filter((btn) => btn.offsetParent !== null);
}

function getPrimaryBuyButton() {
  const buttons = getBuyButtons();
  if (!buttons.length) return null;

  const buyNow = buttons.find((btn) => {
    const text = (btn.textContent || '').toLowerCase();
    return text.includes('buy') || text.includes('קנה');
  });

  return buyNow || buttons[0];
}

function removeComparisonPopup() {
  if (comparisonPopupState.reactRoot) {
    comparisonPopupState.reactRoot.unmount();
  }
  if (comparisonPopupState.host?.parentNode) {
    comparisonPopupState.host.parentNode.removeChild(comparisonPopupState.host);
  }

  comparisonPopupState.host = null;
  comparisonPopupState.shadowRoot = null;
  comparisonPopupState.reactRoot = null;
  comparisonPopupState.anchorButton = null;
  comparisonPopupState.bestDeal = null;
}

function updateComparisonPopupPosition() {
  if (!comparisonPopupState.host || !comparisonPopupState.anchorButton) return;

  const rect = comparisonPopupState.anchorButton.getBoundingClientRect();
  const isRTL = isRTLLanguage();
  const popupWidth = 260;
  const popupHeight = 132;
  const gap = 10;

  let left = isRTL ? rect.right + gap : rect.left - popupWidth - gap;
  let top = rect.top + (rect.height / 2) - (popupHeight / 2);

  if (left < 8) left = rect.right + gap;
  if (left + popupWidth > window.innerWidth - 8) {
    left = Math.max(8, rect.left - popupWidth - gap);
  }
  if (top < 8) top = 8;
  if (top + popupHeight > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - popupHeight - 8);
  }

  comparisonPopupState.host.style.left = `${left}px`;
  comparisonPopupState.host.style.top = `${top}px`;
}

function ensureComparisonPopupHost(anchorButton) {
  if (comparisonPopupState.host && comparisonPopupState.anchorButton === anchorButton) {
    return;
  }

  removeComparisonPopup();

  const host = document.createElement('div');
  host.id = 'alismart-price-popup-host';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'auto';
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  shadowRoot.appendChild(mountPoint);

  comparisonPopupState.host = host;
  comparisonPopupState.shadowRoot = shadowRoot;
  comparisonPopupState.reactRoot = createRoot(mountPoint);
  comparisonPopupState.anchorButton = anchorButton;

  updateComparisonPopupPosition();
}

function getProductPriceValue(product) {
  return extractNumericPrice(
    product?.target_sale_price ||
    product?.sale_price ||
    product?.price ||
    product?.app_sale_price ||
    product?.min_price
  );
}

function getBestDealFromResults(results, currentProductId) {
  if (!Array.isArray(results) || !results.length) return null;

  const filtered = results
    .filter((item) => {
      const price = getProductPriceValue(item);
      const id = String(item.product_id || item.productId || '');
      return price > 0 && (!currentProductId || id !== String(currentProductId));
    })
    .sort((a, b) => getProductPriceValue(a) - getProductPriceValue(b));

  return filtered[0] || null;
}

function handleViewDealClick(productData, bestDeal) {
  window.__AliSmart_CurrentProduct = productData;
  window.__AliSmart_BestDealFromPopup = bestDeal;

  chrome.runtime.sendMessage({
    type: 'OPEN_SIDEBAR_AND_SEARCH',
    productData,
    focusDealProductId: bestDeal?.product_id || bestDeal?.productId || null,
  }).catch(() => {});

  document.dispatchEvent(new CustomEvent('AliSmart:OpenSidebar', { detail: productData }));
  document.dispatchEvent(new CustomEvent('AliSmart:FocusDeal', { detail: bestDeal }));
}

async function evaluatePriceComparisonPopup() {
  const anchorButton = getPrimaryBuyButton();
  if (!anchorButton) {
    removeComparisonPopup();
    return;
  }

  const productData = extractCurrentProductForComparison();
  const currentPrice = productData.currentPrice;

  if (!productData.title || currentPrice <= 0) {
    removeComparisonPopup();
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_REQUEST',
      query: productData.title,
      imgUrl: productData.imgUrl,
      title: productData.title,
      currentId: productData.productId,
      timestamp: Date.now(),
    });

    if (!response?.success || !Array.isArray(response.products)) {
      removeComparisonPopup();
      return;
    }

    const bestDeal = getBestDealFromResults(response.products, productData.productId);
    if (!bestDeal) {
      removeComparisonPopup();
      return;
    }

    const bestPrice = getProductPriceValue(bestDeal);
    if (bestPrice <= 0) {
      removeComparisonPopup();
      return;
    }

    const savingsAmount = Math.max(0, currentPrice - bestPrice);
    const savingsPercent = currentPrice > 0
      ? Math.round((savingsAmount / currentPrice) * 100)
      : 0;

    const canShowSave = savingsPercent >= 5;
    const isCurrentBest = currentPrice <= bestPrice;

    if (!canShowSave && !isCurrentBest) {
      removeComparisonPopup();
      return;
    }

    const mode = canShowSave ? 'save' : 'best';

    ensureComparisonPopupHost(anchorButton);
    comparisonPopupState.bestDeal = bestDeal;
    comparisonPopupState.reactRoot.render(
      <React.StrictMode>
        <PricePopup
          mode={mode}
          currentPrice={currentPrice}
          bestPrice={bestPrice}
          savingsAmount={savingsAmount}
          savingsPercent={savingsPercent}
          isRTL={isRTLLanguage()}
          copy={getPopupCopy()}
          onViewDeal={() => handleViewDealClick(productData, bestDeal)}
        />
      </React.StrictMode>
    );
    updateComparisonPopupPosition();
  } catch (error) {
    console.log('[AliSmart] Price comparison popup skipped:', error?.message || error);
    removeComparisonPopup();
  }
}

function schedulePriceComparisonPopup(delay = 300) {
  clearTimeout(comparisonUpdateTimer);
  comparisonUpdateTimer = setTimeout(() => {
    evaluatePriceComparisonPopup();
  }, delay);
}

/**
 * Content Script Entry Point - Unified Architecture
 * This file now only handles data extraction and communication with sidebar.
 * All UI injection is handled by the main content.js with Shadow DOM isolation.
 */

// Product data extraction for sidebar communication
function extractProductDataForSidebar() {
  // Extract current product data from the page
  const titleEl = document.querySelector('h1[data-pl="product-title"], h1[class*="title"], [class*="product-title"]');
  const priceEl = document.querySelector('[class*="price"][class*="current"], [class*="price-sale"], .multi--price-sale--');
  const imgEl = document.querySelector('img[class*="main"], img[class*="product"], img[class*="primary"]');
  
  return {
    title: titleEl?.textContent?.trim() || '',
    price: priceEl?.textContent?.trim() || '',
    imageUrl: imgEl?.src || '',
    url: window.location.href,
    timestamp: Date.now()
  };
}

// Initialize data extraction
function init() {
  console.log('[AliSmart] Content script initialized (Unified Mode)');
  
  // Send initial product data to sidebar
  const productData = extractProductDataForSidebar();
  if (productData.title) {
    chrome.runtime.sendMessage({
      type: 'PRODUCT_DATA_UPDATED',
      productData: productData
    }).catch(() => {});
  }
  
  // Setup variant change listeners
  setupVariantListeners();
}

// Handle variant changes
function setupVariantListeners() {
  const skuContainers = document.querySelectorAll('[class*="skuProperty"], [class*="sku-property"]');
  
  skuContainers.forEach(container => {
    const observer = new MutationObserver(() => {
      const productData = extractProductDataForSidebar();
      chrome.runtime.sendMessage({
        type: 'PRODUCT_DATA_UPDATED',
        productData: productData
      }).catch(() => {});
    });
    
    observer.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * מחלץ נתוני מוצר מאלמנט
 * @param {HTMLElement} productElement - אלמנט מוצר
 * @returns {Object} נתוני המוצר
 */
function extractProductData(productElement) {
  let title = '';
  let imgUrl = '';
  let price = '';
  let productId = '';
  
  // חילוץ כותרת - ניסיון מספר סלקטורים
  const titleSelectors = [
    'h1[class*="title"]', 'h2[class*="title"]', 'h3[class*="title"]',
    '[class*="product-title"]', '[class*="ProductTitle"]',
    '[class*="item-title"]', '[class*="ItemTitle"]',
    '.product-name', '.productTitle',
    'a[title]'
  ];
  
  for (const selector of titleSelectors) {
    const el = productElement.querySelector(selector);
    if (el) {
      title = el.getAttribute('title') || el.textContent.trim();
      if (title && title.length > 3) break;
    }
  }
  
  // Fallback: ניסיון לקחת מה-link הקרוב
  if (!title) {
    const link = productElement.closest('a') || 
                 productElement.querySelector('a[href*="/item/"]');
    if (link) {
      title = link.getAttribute('title') || link.textContent.trim();
    }
  }
  
  // חילוץ תמונה
  const imgSelectors = [
    'img[class*="main"]', 'img[class*="Main"]',
    'img[class*="product"]', 'img[class*="Product"]',
    'img[class*="primary"]', 'img[class*="Primary"]',
    'img[class*="image"]', 'img[class*="Image"]',
    'img[class*="pic"]', 'img[class*="Pic"]',
    '.main-image img', '.product-image img',
    'img:first-of-type'
  ];
  
  for (const selector of imgSelectors) {
    const img = productElement.querySelector(selector);
    if (img) {
      imgUrl = img.getAttribute('src') || 
               img.getAttribute('data-src') || 
               img.getAttribute('data-original') ||
               img.getAttribute('data-lazy-src');
      if (imgUrl && !imgUrl.includes('data:image') && !imgUrl.startsWith('blob:')) {
        break;
      }
    }
  }
  
  // ניקוי URL תמונה
  if (imgUrl) {
    // הסרת suffixes של גדלים AliExpress
    imgUrl = imgUrl.replace(/_[0-9]+x[0-9]+\.[a-zA-Z]+$/, '');
    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    } else if (!imgUrl.startsWith('http')) {
      imgUrl = 'https://' + imgUrl;
    }
  }
  
  // חילוץ מחיר
  const priceSelectors = [
    '[class*="price-sale"]', '[class*="price-current"]',
    '[class*="price--"]',
    '.multi--price-sale--', '.multi--price--',
    '[class*="product-price"]', '[class*="ProductPrice"]',
    '[class*="price-wrap"]',
    '.price'
  ];
  
  for (const selector of priceSelectors) {
    const el = productElement.querySelector(selector);
    if (el) {
      price = el.textContent.trim();
      if (price && /[\d$€£₪]/.test(price)) break;
    }
  }
  
  // חילוץ מזהה מוצר מ-URL
  const link = productElement.querySelector('a[href*="/item/"]');
  if (link) {
    const href = link.getAttribute('href');
    const match = href?.match(/\/item\/(\d+)\.html/);
    productId = match ? match[1] : '';
  }
  
  return { title, imgUrl, price, productId };
}

/**
 * טיפול בלחיצה על כפתור AliSmart
 * @param {Object} productData - נתוני המוצר
 */
function handleButtonClick(productData) {
  console.log('[AliSmart] Button clicked for:', productData);
  
  // שליחת הודעה לפתיחת Sidebar והתחלת חיפוש
  chrome.runtime.sendMessage({
    type: 'OPEN_SIDEBAR_AND_SEARCH',
    productData: productData
  });
  
  // שמירת המוצר הנוכחי בחלון לשימוש ה-Sidebar
  window.__AliSmart_CurrentProduct = productData;
  
  // שמירת בחירות הווריאציה עם המוצר
  productData.variantSelections = { ...currentVariantSelections };
  
  // פתיחת Sidebar דרך אירוע מקומי (fallback)
  const event = new CustomEvent('AliSmart:OpenSidebar', {
    detail: productData
  });
  document.dispatchEvent(event);
}

/**
 * מחלץ נתוני וריאציה (צבע, מידה, דגם) מדף מוצר
 * @returns {Object} נתוני הווריאציות שנבחרו
 */
function extractVariantData() {
  const variants = {
    color: null,
    size: null,
    model: null,
    other: {}
  };

  // סלקטורים לבחירות צבע ב-AliExpress
  const colorSelectors = [
    '[class*="skuProperty"] [class*="title"]:contains("Color") + div [class*="selected"]',
    '[class*="sku-item-selected"][data-sku-color]',
    '[class*="color-item--selected"]',
    '[class*="sku-selector"] [class*="active"] [class*="color"]',
    '[data-sku-color-name]',
    '.sku-property-color .sku-item.selected',
    '[class*="skuPropertyColor"] [class*="active"]',
    '.sku-property-item.selected[data-sku-color]'
  ];

  // סלקטורים לבחירות מידה
  const sizeSelectors = [
    '[class*="skuProperty"] [class*="title"]:contains("Size") + div [class*="selected"]',
    '[class*="sku-item-selected"][data-sku-size]',
    '[class*="size-item--selected"]',
    '[data-sku-size-name]',
    '.sku-property-size .sku-item.selected',
    '[class*="skuPropertySize"] [class*="active"]'
  ];

  // סלקטורים לדגם/מודל
  const modelSelectors = [
    '[class*="skuProperty"] [class*="title"]:contains("Model") + div [class*="selected"]',
    '[class*="skuProperty"] [class*="title"]:contains("Style") + div [class*="selected"]',
    '[data-sku-model-name]',
    '[data-sku-style-name]'
  ];

  // חילוץ צבע
  for (const selector of colorSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        variants.color = el.getAttribute('data-sku-color-name') || 
                        el.getAttribute('title') || 
                        el.textContent.trim() ||
                        el.getAttribute('data-color');
        if (variants.color) break;
      }
    } catch (e) {}
  }

  // חילוץ מידה
  for (const selector of sizeSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        variants.size = el.getAttribute('data-sku-size-name') || 
                       el.getAttribute('title') || 
                       el.textContent.trim();
        if (variants.size) break;
      }
    } catch (e) {}
  }

  // חילוץ דגם
  for (const selector of modelSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        variants.model = el.getAttribute('data-sku-model-name') || 
                        el.getAttribute('data-sku-style-name') || 
                        el.textContent.trim();
        if (variants.model) break;
      }
    } catch (e) {}
  }

  // חילוץ וריאציות נוספות (כל מה שמתחיל ב-skuProperty)
  const skuProperties = document.querySelectorAll('[class*="skuProperty"], [class*="sku-property"]');
  skuProperties.forEach(prop => {
    const titleEl = prop.querySelector('[class*="title"], [class*="property-title"], h3, h4, h5');
    const selectedEl = prop.querySelector('[class*="selected"], [class*="active"], .selected');
    
    if (titleEl && selectedEl) {
      const title = titleEl.textContent.trim().toLowerCase();
      const value = selectedEl.textContent.trim() || 
                   selectedEl.getAttribute('title') ||
                   selectedEl.getAttribute('data-value');
      
      if (value && !title.includes('color') && !title.includes('size') && !title.includes('model') && !title.includes('style')) {
        variants.other[title] = value;
      }
    }
  });

  return variants;
}

/**
 * שולח עדכון בחירות ל-Sidebar
 */
function sendVariantUpdateToSidebar() {
  const variantData = extractVariantData();
  
  // בדיקה אם השתנו בחירות
  const hasChanges = 
    variantData.color !== currentVariantSelections.color ||
    variantData.size !== currentVariantSelections.size ||
    variantData.model !== currentVariantSelections.model ||
    JSON.stringify(variantData.other) !== JSON.stringify(currentVariantSelections.other);

  if (hasChanges) {
    currentVariantSelections = variantData;
    
    // שליחת עדכון ל-Sidebar
    chrome.runtime.sendMessage({
      type: 'VARIANT_SELECTION_CHANGED',
      productId: currentProductId,
      variants: variantData,
      timestamp: Date.now()
    }).catch(err => {
      // Sidebar might not be open - that's ok
      console.log('[AliSmart] Sidebar not available for variant update');
    });

    // עדכון המוצר הנוכחי בחלון
    if (window.__AliSmart_CurrentProduct) {
      window.__AliSmart_CurrentProduct.variantSelections = { ...variantData };
    }

    schedulePriceComparisonPopup(220);

    console.log('[AliSmart] Variants updated:', variantData);
  }
}

/**
 * מגדיר מאזינים לבחירות וריאציה בדף
 */
function setupVariantListeners() {
  // זיהוי מזהה מוצר מה-URL
  const match = window.location.href.match(/\/item\/(\d+)\.html/);
  if (match) {
    currentProductId = match[1];
  }

  // מאזינים ללחיצות על אפשרויות SKU
  const skuSelectors = [
    '[class*="skuProperty"] [class*="sku-item"]',
    '[class*="sku-property"] [class*="sku-item"]',
    '[class*="sku-selector"] [class*="option"]',
    '[data-sku-color]',
    '[data-sku-size]',
    '[class*="color-item"]',
    '[class*="size-item"]',
    '.sku-item:not([class*="disabled"])'
  ];

  // שימוש ב-event delegation לביצועים
  document.addEventListener('click', (e) => {
    const target = e.target;
    
    // בדיקה אם הלחיצה הייתה על אפשרות SKU
    const isSkuOption = skuSelectors.some(selector => {
      try {
        return target.matches(selector) || target.closest(selector);
      } catch (err) {
        return false;
      }
    });

    if (isSkuOption) {
      // המתנה קצרה לעדכון ה-DOM אחרי הלחיצה
      setTimeout(() => {
        sendVariantUpdateToSidebar();
      }, 100);
    }
  });

  // מאזין לשינויים ב-DOM (לכפתורים שמתעדכנים דינמית)
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target.classList.contains('selected') || 
            target.classList.contains('active') ||
            target.getAttribute('class')?.includes('selected')) {
          shouldCheck = true;
        }
      }
    });

    if (shouldCheck) {
      // Debounce
      clearTimeout(window.__AliSmart_VariantTimer);
      window.__AliSmart_VariantTimer = setTimeout(() => {
        sendVariantUpdateToSidebar();
      }, 50);
    }
  });

  // התחלת התצפית על אזורי ה-SKU
  const skuContainers = document.querySelectorAll(
    '[class*="skuProperty"], [class*="sku-property"], [class*="sku-selector"]'
  );
  
  skuContainers.forEach(container => {
    observer.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });
  });

  console.log('[AliSmart] Variant listeners setup complete');
}

/**
* סלקטורים לזיהוי כרטיסי מוצר
*/
const PRODUCT_SELECTORS = [
  '[data-pl]', // מוצרים מודרניים
  '[data-product-id]',
  '.search-item',
  '.search-card-item',
  '.list-item',
  '.product-item',
  '.product-card',
  '[class*="ProductCard"]',
  '.grid-item',
  '[class*="gallery-item"]',
  '.item[role="listitem"]',
  'a[href*="/item/"]',
  '[class*="ProductContainer"]',
  '[class*="SearchProductContent"]',
  '[class*="ProductTitle"]'
];


/**
 * מחלץ נתוני מוכר מדף מוצר
 * @returns {Object|null} נתוני המוכר או null אם לא נמצא
 */
function extractSellerData() {
  const sellerData = {
    storeName: null,
    positiveFeedbackRate: null,
    storeOpenDate: null,
    followersCount: null,
    responseRate: null,
    sellerRating: null,
    isTopBrand: false,
    hasNonFilteredContent: false,
  };

  // חילוץ שם החנות
  const storeNameSelectors = [
    '[class*="storeName"]',
    '[class*="sellerName"]',
    '[class*="shopName"]',
    '[class*="store-title"]',
    '[class*="seller-title"]',
    'a[href*="/store/"]',
    '.shop-name',
    '.store-name',
  ];

  for (const selector of storeNameSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      sellerData.storeName = el.textContent.trim();
      if (sellerData.storeName) break;
    }
  }

  // חילוץ אחוז פידבק חיובי
  const feedbackSelectors = [
    '[class*="feedback-rate"]',
    '[class*="positive-rate"]',
    '[class*="feedbackRate"]',
    '[data-pl="feedback-rate"]',
    '[class*="rating-percentage"]',
  ];

  for (const selector of feedbackSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent.trim();
      const match = text.match(/(\d+(?:\.\d+)?)%/);
      if (match) {
        sellerData.positiveFeedbackRate = parseFloat(match[1]) / 100;
        break;
      }
    }
  }

  // חילוץ תאריך פתיחת חנות
  const openDateSelectors = [
    '[class*="store-open-date"]',
    '[class*="store-since"]',
    '[class*="openTime"]',
    '[data-pl="store-since"]',
    '[class*="years-on-ali"]',
  ];

  for (const selector of openDateSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent.trim();
      // תבניות נפוצות: "Since 2021", "3 years", "2021"
      const yearMatch = text.match(/(\d{4})/);
      if (yearMatch) {
        sellerData.storeOpenDate = `${yearMatch[1]}-01-01`;
        break;
      }
    }
  }

  // חילוץ מספר עוקבים
  const followersSelectors = [
    '[class*="followers"]',
    '[class*="follower-count"]',
    '[class*="store-followers"]',
    '[data-pl="followers"]',
  ];

  for (const selector of followersSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent.trim().replace(/,/g, '');
      const match = text.match(/(\d+)/);
      if (match) {
        sellerData.followersCount = parseInt(match[1]);
        break;
      }
    }
  }

  // חילוץ שיעור תגובה
  const responseSelectors = [
    '[class*="response-rate"]',
    '[class*="responseTime"]',
    '[data-pl="response-rate"]',
  ];

  for (const selector of responseSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent.trim();
      const match = text.match(/(\d+)%/);
      if (match) {
        sellerData.responseRate = parseInt(match[1]) / 100;
        break;
      }
    }
  }

  // חילוץ דירוג מוכר
  const ratingSelectors = [
    '[class*="seller-rating"]',
    '[class*="store-rating"]',
    '[class*="shop-score"]',
    '[data-pl="seller-rating"]',
  ];

  for (const selector of ratingSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent.trim();
      const match = text.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const rating = parseFloat(match[1]);
        if (rating <= 5) {
          sellerData.sellerRating = rating;
          break;
        }
      }
    }
  }

  // בדיקה אם Top Brand
  const topBrandSelectors = [
    '[class*="top-brand"]',
    '[class*="TopBrand"]',
    '[class*="gold-supplier"]',
    '[data-pl="top-brand"]',
  ];

  for (const selector of topBrandSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      sellerData.isTopBrand = true;
      break;
    }
  }

  // בדיקת Non-filtered Content (תמונות מוצרים ללא סינון)
  const productImages = document.querySelectorAll('img[class*="product"], img[class*="item"]');
  let unfilteredCount = 0;
  productImages.forEach(img => {
    const alt = img.getAttribute('alt') || '';
    const src = img.getAttribute('src') || '';
    // בדיקה ראשונית לתמונות שעלולות להכיל דמויות
    if (alt.match(/model|person|people|woman|man|girl|boy|wear/i) ||
        src.match(/model|person|people|wear|fashion/i)) {
      unfilteredCount++;
    }
  });
  
  if (unfilteredCount > 3) {
    sellerData.hasNonFilteredContent = true;
  }

  // בדיקה אם יש נתונים תקפים
  if (sellerData.storeName || sellerData.positiveFeedbackRate || sellerData.sellerRating) {
    return sellerData;
  }

  return null;
}

/**
 * שולח נתוני מוכר ל-Sidebar
 */
function sendSellerDataToSidebar() {
  const sellerData = extractSellerData();
  if (sellerData) {
    chrome.runtime.sendMessage({
      type: 'SELLER_DATA_UPDATED',
      sellerData: sellerData,
      url: window.location.href,
      timestamp: Date.now()
    }).catch(err => {
      // Sidebar might not be open
      console.log('[AliSmart] Could not send seller data to sidebar');
    });

    // שמירה בחלון לשימוש מקומי
    window.__AliSmart_SellerData = sellerData;
    console.log('[AliSmart] Seller data extracted:', sellerData);
  }
}

/**
 * זיהוי דף עגלה או תשלום
 */
function isCartOrCheckoutPage() {
  const url = window.location.href.toLowerCase();
  const cartPatterns = [
    '/cart',
    '/checkout',
    '/shoppingcart',
    '/order',
    '/payment',
    '/buy',
    '/purchase',
    '/confirm',
  ];
  
  return cartPatterns.some(pattern => url.includes(pattern));
}

/**
 * חילוץ סכום העגלה
 */
function extractCartTotal() {
  try {
    const selectors = [
      '.cart-summary-price',
      '.checkout-order-total',
      '[data-pl="total_price"]',
      '.order-total',
      '.grand-total',
      '.cart-total',
      '.total-price',
      '.summary-total',
      '[class*="total"] [class*="price"]',
      '[class*="checkout"] [class*="total"]',
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || '';
        // חיפוש מספרים בפורמטים שונים
        const matches = text.match(/[\d,]+\.?\d*/g);
        if (matches && matches.length > 0) {
          // לוקח את המספר האחרון (usually the total)
          const lastMatch = matches[matches.length - 1];
          const amount = parseFloat(lastMatch.replace(/,/g, ''));
          if (amount > 0) return amount;
        }
      }
    }
    
    return 0;
  } catch (e) {
    return 0;
  }
}

/**
 * חילוץ פריטי העגלה
 */
function extractCartItems() {
  try {
    const items = [];
    
    // Selectors שונים לפריטי עגלה באליאקספרס
    const itemSelectors = [
      '.cart-product-item',
      '.cart-item',
      '[class*="cart-item"]',
      '.order-item',
      '[data-spm*="cart"]',
    ];
    
    for (const selector of itemSelectors) {
      const elements = document.querySelectorAll(selector);
      
      elements.forEach((el, index) => {
        try {
          // חיפוש תמונה
          const imgEl = el.querySelector('img');
          const imageUrl = imgEl?.src || imgEl?.dataset?.src || '';
          
          // חיפוש כותרת
          const titleSelectors = [
            '.cart-product-name',
            '.item-title',
            '.product-name',
            'a[title]',
            'h3',
            'h4',
          ];
          let title = '';
          for (const ts of titleSelectors) {
            const te = el.querySelector(ts);
            if (te) {
              title = te.textContent?.trim() || te.title || '';
              if (title) break;
            }
          }
          
          // חיפוש מחיר
          const priceSelectors = [
            '.cart-product-price',
            '.item-price',
            '.price-current',
            '[class*="price"]',
          ];
          let price = 0;
          for (const ps of priceSelectors) {
            const pe = el.querySelector(ps);
            if (pe) {
              const text = pe.textContent || '';
              const match = text.match(/[\d,]+\.?\d*/);
              if (match) {
                price = parseFloat(match[0].replace(/,/g, ''));
                if (price > 0) break;
              }
            }
          }
          
          // חיפוש כמות
          const qtySelectors = [
            '.cart-product-qty input',
            '.quantity-input',
            '[class*="qty"]',
            '[class*="quantity"]',
          ];
          let quantity = 1;
          for (const qs of qtySelectors) {
            const qe = el.querySelector(qs);
            if (qe) {
              const val = parseInt(qe.value || qe.textContent);
              if (val > 0) {
                quantity = val;
                break;
              }
            }
          }
          
          // חיפוש product ID
          let productId = '';
          const linkEl = el.querySelector('a[href*="/item/"]');
          if (linkEl) {
            const match = linkEl.href.match(/\/item\/(\d+)/);
            if (match) productId = match[1];
          }
          
          if (title || imageUrl) {
            items.push({
              productId: productId || `cart-item-${index}`,
              title,
              price,
              quantity,
              imageUrl,
              productUrl: linkEl?.href || '',
            });
          }
        } catch (itemError) {
          // Ignore individual item errors
        }
      });
      
      if (items.length > 0) break; // מצאנו פריטים עם selector זה
    }
    
    return items;
  } catch (e) {
    console.error('[AliSmart] Failed to extract cart items:', e);
    return [];
  }
}

/**
 * שולח נתוני עגלה ל-Sidebar
 */
function sendCartDataToSidebar() {
  const isCart = isCartOrCheckoutPage();
  const cartTotal = isCart ? extractCartTotal() : 0;
  const cartItems = isCart ? extractCartItems() : [];
  
  chrome.runtime.sendMessage({
    type: 'CART_DATA_UPDATED',
    isCartPage: isCart,
    orderAmount: cartTotal,
    cartItems: cartItems,
    itemCount: cartItems.length,
    url: window.location.href,
    timestamp: Date.now()
  }).catch(err => {
    console.log('[AliSmart] Could not send cart data to sidebar');
  });
  
  window.__AliSmart_CartData = { 
    isCartPage: isCart, 
    orderAmount: cartTotal,
    cartItems: cartItems,
    itemCount: cartItems.length,
  };
  
  if (isCart) {
    console.log('[AliSmart] Cart detected. Items:', cartItems.length, 'Total:', cartTotal);
  }
}

/**
 * חילוץ ביקורות מהדף
 */
function extractReviews() {
  try {
    const reviews = [];
    
    // Selectors שונים לביקורות באליאקספרס
    const reviewSelectors = [
      '.feedback-item',
      '.review-item',
      '[class*="feedback"]',
      '[class*="review"]',
      '.evaluation-item',
      '.comment-item',
    ];
    
    for (const selector of reviewSelectors) {
      const elements = document.querySelectorAll(selector);
      
      elements.forEach(el => {
        try {
          // חילוץ דירוג (כוכבים)
          let rating = 0;
          const starSelectors = [
            '.star-rating',
            '.rating-stars',
            '[class*="rating"]',
            '.stars',
            '[class*="star"]',
          ];
          for (const rs of starSelectors) {
            const re = el.querySelector(rs);
            if (re) {
              const classMatch = re.className.match(/(\d)/);
              const textMatch = re.textContent?.match(/(\d)/);
              rating = parseInt(classMatch?.[1] || textMatch?.[1] || 0);
              if (rating > 0) break;
            }
          }
          
          // חילוץ תוכן
          let content = '';
          const contentSelectors = [
            '.feedback-content',
            '.review-content',
            '.feedback-text',
            '.review-text',
            '.buyer-feedback',
            'p[class*="content"]',
            '.comment-text',
          ];
          for (const cs of contentSelectors) {
            const ce = el.querySelector(cs);
            if (ce) {
              content = ce.textContent?.trim() || '';
              if (content) break;
            }
          }
          
          // חילוץ תאריך
          let date = '';
          const dateSelectors = [
            '.feedback-time',
            '.review-date',
            '.date',
            'time',
            '.feedback-date',
            '.timestamp',
          ];
          for (const ds of dateSelectors) {
            const de = el.querySelector(ds);
            if (de) {
              date = de.textContent?.trim() || de.dateTime || '';
              if (date) break;
            }
          }
          
          // חילוץ שם משתמש
          let username = '';
          const userSelectors = [
            '.user-name',
            '.buyer-name',
            '.reviewer-name',
            '.author',
            '.username',
          ];
          for (const us of userSelectors) {
            const ue = el.querySelector(us);
            if (ue) {
              username = ue.textContent?.trim() || '';
              if (username) break;
            }
          }
          
          if (content && content.length > 10) {
            reviews.push({
              rating: rating || 3,
              content,
              date,
              username: username || 'Anonymous',
            });
          }
        } catch (itemError) {
          // Ignore individual item errors
        }
      });
      
      if (reviews.length > 0) break;
    }
    
    return reviews.slice(0, 50); // מקסימום 50 ביקורות
  } catch (e) {
    console.error('[AliSmart] Failed to extract reviews:', e);
    return [];
  }
}

/**
 * חילוץ נתוני משלוח מדף מוצר
 * מחלץ מחירי משלוח, זמני הגעה, ומשקל
 */
function extractShippingData() {
  const shippingData = {
    methods: [],
    estimatedDelivery: '',
    weight: null,
    weightUnit: '',
    isFreeShipping: false,
    countryCode: 'IL', // ברירת מחדל לישראל
    shippingFrom: '',
    processingTime: ''
  };
  
  try {
    // חילוץ אפשרויות משלוח
    const shippingSelectors = [
      '[class*="shipping"]',
      '[class*="logistics"]',
      '[class*="delivery"]',
      '[data-spm*="shipping"]',
      '.product-shipping',
    ];
    
    shippingSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim() || '';
        
        // בדיקת משלוח חינם
        if (/free\s+shipping|free|משלוח\s+חינם|免邮/i.test(text)) {
          shippingData.isFreeShipping = true;
          
          // חילוץ זמן הגעה למשלוח חינם
          const deliveryMatch = text.match(/(\d+)[-\s]?(\d+)\s*(days|business\s+days|ימים|day)/i);
          if (deliveryMatch) {
            shippingData.methods.push({
              name: 'Free Shipping',
              nameHe: 'משלוח חינם',
              price: 0,
              priceValue: 0,
              deliveryTime: `${deliveryMatch[1]}-${deliveryMatch[2]} days`,
              isFree: true,
              hasTracking: true
            });
          }
        }
        
        // חילוץ מחיר משלוח
        const priceMatch = text.match(/shipping[:\s]*[\$€£]?\s*(\d+\.?\d*)/i);
        if (priceMatch && !shippingData.isFreeShipping) {
          const price = parseFloat(priceMatch[1]);
          shippingData.methods.push({
            name: 'Standard Shipping',
            nameHe: 'משלוח רגיל',
            price: `$${price}`,
            priceValue: price,
            deliveryTime: text.match(/(\d+)[-\s]?(\d+)\s*days?/i)?.[0] || '15-30 days',
            isFree: false,
            hasTracking: text.toLowerCase().includes('tracking')
          });
        }
        
        // חילוץ זמן הגעה כללי
        if (!shippingData.estimatedDelivery) {
          const deliveryMatch = text.match(/(\d+)[-\s]?(\d+)\s*(days|business\s+days|ימים)/i);
          if (deliveryMatch) {
            shippingData.estimatedDelivery = `${deliveryMatch[1]}-${deliveryMatch[2]} days`;
          }
        }
      });
    });
    
    // חילוץ משקל מפרטי המוצר
    const specSelectors = [
      '[class*="specification"]',
      '[class*="product-info"]',
      '[class*="attribute"]',
      '.product-details',
    ];
    
    for (const selector of specSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent || '';
        
        // חיפוש משקל
        const weightMatch = text.match(/(\d+\.?\d*)\s*(kg|g|grams|ק"ג|גרם|gr)/i);
        if (weightMatch && !shippingData.weight) {
          const value = parseFloat(weightMatch[1]);
          const unit = weightMatch[2].toLowerCase();
          shippingData.weight = unit.includes('kg') || unit.includes('ק"ג') ? value : value / 1000;
          shippingData.weightUnit = 'kg';
          break;
        }
      }
    }
    
    // חילוץ מדינת משלוח
    const fromSelectors = [
      '[class*="ships-from"]',
      '[class*="ship-from"]',
      '[data-pl*="ship"]',
    ];
    
    for (const selector of fromSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        const countryMatch = text.match(/from[:\s]+([\w\s]+)/i);
        if (countryMatch) {
          shippingData.shippingFrom = countryMatch[1].trim();
        }
        break;
      }
    }
    
    // חילוץ זמן עיבוד הזמנה
    const processingSelectors = [
      '[class*="processing"]',
      '[class*="handling"]',
      '[class*="dispatch"]',
    ];
    
    for (const selector of processingSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        const processingMatch = text.match(/(\d+)[-\s]?(\d+)\s*(days?|hours?)/i);
        if (processingMatch) {
          shippingData.processingTime = `${processingMatch[1]}-${processingMatch[2]} ${processingMatch[3]}`;
        }
        break;
      }
    }
    
    // אם לא נמצאו שיטות משלוח, הוסף ברירת מחדל
    if (shippingData.methods.length === 0) {
      shippingData.methods.push({
        name: 'Standard Shipping',
        nameHe: 'משלוח רגיל',
        price: shippingData.isFreeShipping ? '$0' : '$5.00',
        priceValue: shippingData.isFreeShipping ? 0 : 5,
        deliveryTime: shippingData.estimatedDelivery || '15-30 days',
        isFree: shippingData.isFreeShipping,
        hasTracking: true
      });
    }
    
  } catch (error) {
    console.log('[AliSmart] Failed to extract shipping data:', error);
  }
  
  return shippingData;
}

/**
 * שולח נתוני משלוח ל-Sidebar
 */
function sendShippingDataToSidebar() {
  const shippingData = extractShippingData();
  
  if (shippingData.methods.length > 0) {
    chrome.runtime.sendMessage({
      type: 'SHIPPING_DATA_UPDATED',
      shippingData: shippingData,
      url: window.location.href,
      timestamp: Date.now()
    }).catch(err => {
      console.log('[AliSmart] Could not send shipping data to sidebar');
    });
    
    window.__AliSmart_ShippingData = shippingData;
    console.log('[AliSmart] Shipping data extracted:', shippingData);
  }
}

/**
 * שולח ביקורות ל-Sidebar
 */
function sendReviewsToSidebar() {
  const reviews = extractReviews();
  
  if (reviews.length > 0) {
    chrome.runtime.sendMessage({
      type: 'REVIEWS_EXTRACTED',
      reviews: reviews,
      count: reviews.length,
      url: window.location.href,
      timestamp: Date.now()
    }).catch(err => {
      console.log('[AliSmart] Could not send reviews to sidebar');
    });
    
    window.__AliSmart_Reviews = reviews;
    console.log('[AliSmart] Reviews extracted:', reviews.length);
  }
}

/**
 * אתחול הסקריפט
 */
function init() {
  console.log('[AliSmart] Content Script initialized v' + (window.__AliSmart_Version || '2.0.0'));
  
  // סריקה ראשונית
  scanForProducts();
  
  // חילוץ ושליחת נתוני מוכר
  sendSellerDataToSidebar();
  
  // זיהוי עגלה/תשלום
  sendCartDataToSidebar();
  
  // חילוץ ביקורות
  sendReviewsToSidebar();
  
  // חילוץ נתוני משלוח
  sendShippingDataToSidebar();
  
  // חילוץ נתוני מלאי
  sendInventoryDataToSidebar();

  // חלונית השוואת מחיר ליד כפתורי קנייה
  schedulePriceComparisonPopup(600);
  
  // הגדרת מאזינים לבחירות וריאציה (SKU)
  setupVariantListeners();
  
  // הגדרת MutationObserver לטעינה דינמית
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    let shouldUpdateCart = false;
    let shouldUpdateShipping = false;
    let shouldUpdateComparisonPopup = false;
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // בדיקה אם ה-node שנוסף מכיל מוצרים
          const hasProducts = PRODUCT_SELECTORS.some(selector => {
            try {
              return node.matches?.(selector) || 
                     node.querySelector?.(selector);
            } catch (e) {
              return false;
            }
          });
          
          if (hasProducts) {
            shouldScan = true;
          }
          
          // בדיקה אם נוספו אלמנטים של עגלה או תשלום
          const cartSelectors = [
            '[class*="cart"]',
            '[class*="checkout"]',
            '[class*="order"]',
            '[class*="payment"]',
          ];
          
          const isCartElement = cartSelectors.some(selector => {
            try {
              return node.matches?.(selector) || 
                     node.querySelector?.(selector);
            } catch (e) {
              return false;
            }
          });
          
          if (isCartElement) {
            shouldUpdateCart = true;
          }
          
          // בדיקה אם נוספו אלמנטי משלוח
          const shippingSelectors = [
            '[class*="shipping"]',
            '[class*="logistics"]',
            '[class*="delivery"]',
          ];
          
          const isShippingElement = shippingSelectors.some(selector => {
            try {
              return node.matches?.(selector) || 
                     node.querySelector?.(selector);
            } catch (e) {
              return false;
            }
          });
          
          if (isShippingElement) {
            shouldUpdateShipping = true;
          }

          const comparisonSelectors = [
            '[class*="price"]',
            '[class*="buy"]',
            '[class*="cart"]',
            '[class*="sku"]',
          ];

          const affectsComparison = comparisonSelectors.some((selector) => {
            try {
              return node.matches?.(selector) || node.querySelector?.(selector);
            } catch (e) {
              return false;
            }
          });

          if (affectsComparison) {
            shouldUpdateComparisonPopup = true;
          }
        }
      });
    });
    
    if (shouldScan) {
      // Debounce - removed scanForProducts, handled by main content.js
      clearTimeout(window.__AliSmart_ScanTimer);
      // UI injection is now handled by main content.js with Shadow DOM
    }
    
    if (shouldUpdateCart) {
      // Debounce על עדכון עגלה
      clearTimeout(window.__AliSmart_CartTimer);
      window.__AliSmart_CartTimer = setTimeout(sendCartDataToSidebar, 200);
    }
    
    if (shouldUpdateShipping) {
      // Debounce על עדכון משלוח
      clearTimeout(window.__AliSmart_ShippingTimer);
      window.__AliSmart_ShippingTimer = setTimeout(sendShippingDataToSidebar, 200);
    }

    if (shouldUpdateComparisonPopup) {
      schedulePriceComparisonPopup(350);
    }
  });
  
  // התחלת התצפית
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('[AliSmart] MutationObserver started');

  window.addEventListener('resize', () => {
    updateComparisonPopupPosition();
    schedulePriceComparisonPopup(120);
  });

  window.addEventListener('scroll', () => {
    updateComparisonPopupPosition();
  }, true);
}

// אתחול כשה-DOM מוכן
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// האזנה להודעות מה-Sidebar/Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'alive' });
    return true;
  }
  
  if (request.type === 'RESCAN_PRODUCTS') {
    // scanForProducts removed - UI injection handled by main content.js
    sendResponse({ scanned: true, note: 'Unified architecture - injection handled by content.js' });
    return true;
  }
  
  if (request.type === 'GET_INVENTORY_DATA') {
    const inventoryData = extractInventoryData();
    sendResponse({ inventoryData });
    return true;
  }
  
  return false;
});

/**
 * חילוץ נתוני מלאי (Inventory) מדף מוצר
 * חודר לאובייקט ה-skuModule של עליאקספרס
 */
function extractInventoryData() {
  const inventoryData = {
    productId: null,
    totalStock: 0,
    variants: [],
    isLimitedStock: false,
    stockStatus: 'unknown',
    lastUpdated: Date.now(),
    marketingTactics: [],
    recommendation: ''
  };
  
  try {
    // ניסיון לגשת לאובייקט הגלובלי של עליאקספרס
    const globalData = window.runParams?.data || window._data_door_ || {};
    
    // חילוץ מזהה מוצר
    inventoryData.productId = globalData.productId || 
                               document.querySelector('[data-product-id]')?.dataset?.productId ||
                               window.location.pathname.match(/\/item\/(\d+)/)?.[1];
    
    // חילוץ נתוני SKU/וריאציות
    const skuData = globalData.skuModule || globalData.skuComponent || {};
    
    if (skuData.productSKUPropertyList) {
      // מיפוי כל הוריאציות עם המלאי שלהן
      skuData.productSKUPropertyList.forEach((prop, index) => {
        const variant = {
          id: prop.skuId || index,
          name: prop.skuPropertyName || 'Default',
          value: prop.skuPropertyValueName || '',
          stock: 0,
          price: null,
          available: false
        };
        
        // חילוץ מלאי ספציפי לווריאציה
        if (skuData.skuPriceList) {
          const skuPrice = skuData.skuPriceList.find(p => p.skuId === prop.skuId);
          if (skuPrice) {
            variant.price = skuPrice.skuVal?.actSkuCalPrice || skuPrice.skuVal?.skuCalPrice;
            variant.stock = skuPrice.skuVal?.availQuantity || 0;
            variant.available = variant.stock > 0;
          }
        }
        
        // אם יש רשימת מלאי נפרדת
        if (skuData.inventoryList) {
          const inv = skuData.inventoryList.find(i => i.skuId === prop.skuId);
          if (inv) {
            variant.stock = inv.totalQuantity || inv.availQuantity || 0;
            variant.available = variant.stock > 0;
          }
        }
        
        inventoryData.variants.push(variant);
        inventoryData.totalStock += variant.stock;
      });
    }
    
    // אם אין וריאציות, נסה למשוך מלאי כללי
    if (inventoryData.variants.length === 0) {
      const generalStock = skuData.totalAvailQuantity || 
                           globalData.quantityModule?.totalAvailQuantity ||
                           skuData.availQuantity || 0;
      
      inventoryData.totalStock = generalStock;
      inventoryData.variants.push({
        id: 'default',
        name: 'Default',
        stock: generalStock,
        available: generalStock > 0
      });
    }
    
    // ניתוח דחיפות מזויפת
    analyzeFakeUrgency(inventoryData, globalData);
    
    // קביעת סטטוס מלאי
    determineStockStatus(inventoryData);
    
    // יצירת המלצה
    generateInventoryRecommendation(inventoryData);
    
    console.log('[AliSmart] Inventory data extracted:', inventoryData);
    
  } catch (error) {
    console.error('[AliSmart] Failed to extract inventory data:', error);
    inventoryData.stockStatus = 'unavailable';
  }
  
  return inventoryData;
}

/**
 * ניתוח דחיפות מזויפת
 */
function analyzeFakeUrgency(inventoryData, globalData) {
  const tactics = [];
  
  // בדיקת "רק X נשאר במלאי"
  const limitedStockText = document.body.innerText.match(/(only\s+)?(\d+)\s+(left|remaining|in stock|available|נשאר|נותר|במלאי)/i);
  if (limitedStockText) {
    const claimedStock = parseInt(limitedStockText[2]);
    
    // אם יש יותר מ-100 במלאי אבל מציגים "רק 5 נשאר"
    if (inventoryData.totalStock > 100 && claimedStock < 10) {
      tactics.push({
        type: 'fake_scarcity',
        description: 'Shows "only X left" but has plenty in stock',
        descriptionHe: 'מציג "רק X נשאר" אבל יש מלאי גדול',
        severity: 'high'
      });
    }
  }
  
  // בדיקת "99% sold"
  const soldPercentText = document.body.innerText.match(/(\d+)%\s+(sold|נמכר)/i);
  if (soldPercentText) {
    const soldPercent = parseInt(soldPercentText[1]);
    
    if (soldPercent >= 95 && inventoryData.totalStock > 100) {
      tactics.push({
        type: 'fake_popularity',
        description: `Shows ${soldPercent}% sold but has ${inventoryData.totalStock}+ units in stock`,
        descriptionHe: `מציג ${soldPercent}% נמכר אבל יש ${inventoryData.totalStock}+ יחידות במלאי`,
        severity: 'medium'
      });
    }
  }
  
  // בדיקת countdown או טיימר
  const hasCountdown = document.querySelector('[class*="countdown"], [class*="timer"], [class*="flash"], [data-spm*="countdown"]');
  if (hasCountdown && inventoryData.totalStock > 50) {
    tactics.push({
      type: 'fake_urgency',
      description: 'Uses urgency countdown with sufficient stock',
      descriptionHe: 'משתמש בטיימר דחיפות למרות מלאי מספיק',
      severity: 'low'
    });
  }
  
  inventoryData.marketingTactics = tactics;
  inventoryData.hasFakeUrgency = tactics.length > 0;
}

/**
 * קביעת סטטוס מלאי
 */
function determineStockStatus(inventoryData) {
  const stock = inventoryData.totalStock;
  
  if (stock === 0) {
    inventoryData.stockStatus = 'out_of_stock';
  } else if (stock < 10) {
    inventoryData.stockStatus = 'low_stock';
    inventoryData.isLimitedStock = true;
  } else if (stock < 50) {
    inventoryData.stockStatus = 'limited';
    inventoryData.isLimitedStock = true;
  } else if (stock < 100) {
    inventoryData.stockStatus = 'moderate';
  } else {
    inventoryData.stockStatus = 'plenty';
  }
}

/**
 * יצירת המלצה למשתמש
 */
function generateInventoryRecommendation(inventoryData) {
  if (inventoryData.hasFakeUrgency) {
    inventoryData.recommendation = 'no_rush_fake_urgency';
    inventoryData.recommendationHe = 'אין צורך למהר - הדחיפות מדומה';
  } else if (inventoryData.stockStatus === 'plenty') {
    inventoryData.recommendation = 'no_rush';
    inventoryData.recommendationHe = 'אין צורך למהר, מלאי שפוף';
  } else if (inventoryData.stockStatus === 'low_stock') {
    inventoryData.recommendation = 'buy_now';
    inventoryData.recommendationHe = 'מומלץ לרכוש עכשיו, המלאי אוזל';
  } else if (inventoryData.stockStatus === 'out_of_stock') {
    inventoryData.recommendation = 'unavailable';
    inventoryData.recommendationHe = 'המוצר אזל מהמלאי';
  } else {
    inventoryData.recommendation = 'moderate';
    inventoryData.recommendationHe = 'מלאי מתון, אפשר לחכות';
  }
}

/**
 * שליחת נתוני מלאי ל-Sidebar
 */
function sendInventoryDataToSidebar() {
  const inventoryData = extractInventoryData();
  
  if (inventoryData.productId) {
    chrome.runtime.sendMessage({
      type: 'INVENTORY_DATA_UPDATED',
      inventoryData: inventoryData,
      url: window.location.href,
      timestamp: Date.now()
    }).catch(err => {
      console.log('[AliSmart] Could not send inventory data to sidebar');
    });
    
    window.__AliSmart_InventoryData = inventoryData;
  }
}

document.addEventListener('AliSmart:OpenSidebar', () => {
  schedulePriceComparisonPopup(800);
});

