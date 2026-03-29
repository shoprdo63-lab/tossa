/**
 * DOM Utilities
 * פונקציות עזר לעבודה עם ה-DOM ו-Shadow DOM
 * 
 * מספק בידוד CSS מוחלט מהדף המארח באמצעות Shadow DOM
 */

/**
 * בדיקת תקינות אלמנט ככרטיס מוצר
 * @param {HTMLElement} element - האלמנט לבדיקה
 * @returns {boolean} האם האלמנט תקין
 */
export function isValidProductCard(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  
  // בדיקת מימדים
  const rect = element.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 100) return false;
  if (rect.width > 600 || rect.height > 600) return false;
  
  // חייב להכיל תמונה או לינק למוצר
  const hasImage = element.querySelector('img') !== null;
  const hasProductLink = element.querySelector('a[href*="/item/"]') !== null;
  
  return hasImage || hasProductLink;
}

/**
 * יוצר container עם Shadow DOM לבידוד CSS
 * @param {HTMLElement} parentElement - האלמנט האב
 * @returns {HTMLElement} ה-root של ה-Shadow DOM
 */
export function createShadowContainer(parentElement) {
  // בדיקה אם כבר קיים container
  const existing = parentElement.querySelector('.alismart-shadow-host');
  if (existing) {
    return existing.shadowRoot?.getElementById('alismart-root');
  }
  
  // יצירת host element
  const host = document.createElement('div');
  host.className = 'alismart-shadow-host';
  host.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    pointer-events: none !important;
    z-index: 2147483646 !important;
  `;
  
  // יצירת Shadow DOM
  const shadowRoot = host.attachShadow({ mode: 'open' });
  
  // יצירת root container בתוך ה-shadow
  const root = document.createElement('div');
  root.id = 'alismart-root';
  root.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
  `;
  
  // הוספת base styles ל-shadow
  const style = document.createElement('style');
  style.textContent = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .alismart-tooltip {
      animation: fadeIn 0.2s ease;
    }
  `;
  
  shadowRoot.appendChild(style);
  shadowRoot.appendChild(root);
  
  // הוספת ה-host לאלמנט האב
  parentElement.appendChild(host);
  
  // וידוא שאלמנט האב מקבל position אם צריך
  const computedStyle = window.getComputedStyle(parentElement);
  if (computedStyle.position === 'static') {
    parentElement.style.position = 'relative';
  }
  
  return root;
}

/**
 * מחלץ נתוני מוצר מאלמנט
 * @param {HTMLElement} productElement - אלמנט מוצר
 * @returns {Object} נתוני המוצר
 */
export function extractProductData(productElement) {
  let title = '';
  let imgUrl = '';
  let price = '';
  let productId = '';
  
  // חילוץ כותרת
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
  
  // ניקוי URL
  if (imgUrl) {
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
    '.price'
  ];
  
  for (const selector of priceSelectors) {
    const el = productElement.querySelector(selector);
    if (el) {
      price = el.textContent.trim();
      if (price && /[\d$€£₪]/.test(price)) break;
    }
  }
  
  // חילוץ מזהה מוצר
  const link = productElement.querySelector('a[href*="/item/"]');
  if (link) {
    const href = link.getAttribute('href');
    const match = href?.match(/\/item\/(\d+)\.html/);
    productId = match ? match[1] : '';
  }
  
  return { title, imgUrl, price, productId };
}

/**
 * מבצע debounce על פונקציה
 * @param {Function} func - הפונקציה
 * @param {number} wait - זמן המתנה במילישניות
 * @returns {Function} פונקציה עם debounce
 */
export function debounce(func, wait = 100) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * מבצע throttle על פונקציה
 * @param {Function} func - הפונקציה
 * @param {number} limit - מגבלת זמן
 * @returns {Function} פונקציה עם throttle
 */
export function throttle(func, limit = 200) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * מקצר טקסט
 * @param {string} text - הטקסט
 * @param {number} maxLength - אורך מקסימלי
 * @returns {string} טקסט מקוצר
 */
export function truncateText(text, maxLength = 60) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * מנקה HTML למניעת XSS
 * @param {string} text - טקסט
 * @returns {string} טקסט מנוקה
 */
export function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
