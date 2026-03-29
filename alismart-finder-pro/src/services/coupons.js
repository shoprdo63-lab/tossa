/**
 * Coupon Service
 * שירות קופונים - מסד נתונים של קופוני AliExpress
 * 
 * תכונות:
 * - מסד נתונים מקומי של קופונים פופולריים
 * - סינון לפי קטגוריה וסכום מינימום
 * - בדיקת תוקף אוטומטית
 * - חישוב חיסכון משוער
 */

// מסד נתונים מקומי של קופונים נפוצים של AliExpress
// מתעדכן מדי פעם מהשרת או מה-extension updates
const LOCAL_COUPON_DB = [
  // קופונים כלליים
  {
    id: 'ali-newuser-2024',
    code: 'NEWUSER20',
    description: '20% off for new users',
    descriptionHe: '20% הנחה למשתמשים חדשים',
    discount: 20,
    discountType: 'percentage',
    minOrder: 0,
    maxDiscount: 50,
    category: 'general',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    isNewUser: true,
    popularity: 95,
  },
  {
    id: 'ali-summer-2024',
    code: 'SUMMER15',
    description: '15% off summer sale',
    descriptionHe: '15% הנחה מבצע קיץ',
    discount: 15,
    discountType: 'percentage',
    minOrder: 30,
    maxDiscount: null,
    category: 'general',
    validFrom: '2024-06-01',
    validUntil: '2024-08-31',
    isNewUser: false,
    popularity: 90,
  },
  {
    id: 'ali-electronics-2024',
    code: 'TECH10',
    description: '$10 off electronics over $100',
    descriptionHe: '$10 הנחה באלקטרוניקה מעל $100',
    discount: 10,
    discountType: 'fixed',
    minOrder: 100,
    maxDiscount: 10,
    category: 'electronics',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    isNewUser: false,
    popularity: 88,
  },
  {
    id: 'ali-fashion-2024',
    code: 'FASHION25',
    description: '25% off fashion items',
    descriptionHe: '25% הנחה על פריטי אופנה',
    discount: 25,
    discountType: 'percentage',
    minOrder: 50,
    maxDiscount: 30,
    category: 'fashion',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    isNewUser: false,
    popularity: 85,
  },
  {
    id: 'ali-home-2024',
    code: 'HOME12',
    description: '12% off home & garden',
    descriptionHe: '12% הנחה על בית וגינה',
    discount: 12,
    discountType: 'percentage',
    minOrder: 40,
    maxDiscount: 25,
    category: 'home',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    isNewUser: false,
    popularity: 80,
  },
  {
    id: 'ali-free-shipping',
    code: 'FREESHIP',
    description: 'Free shipping over $25',
    descriptionHe: 'משלוח חינם מעל $25',
    discount: 0,
    discountType: 'shipping',
    minOrder: 25,
    maxDiscount: null,
    category: 'general',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    isNewUser: false,
    popularity: 92,
  },
  {
    id: 'ali-black-friday-2024',
    code: 'BF2024',
    description: '30% off Black Friday',
    descriptionHe: '30% הנחה בלאק פריידיי',
    discount: 30,
    discountType: 'percentage',
    minOrder: 75,
    maxDiscount: 50,
    category: 'general',
    validFrom: '2024-11-20',
    validUntil: '2024-11-30',
    isNewUser: false,
    popularity: 98,
  },
  {
    id: 'ali-cyber-monday-2024',
    code: 'CYBER20',
    description: '20% off Cyber Monday',
    descriptionHe: '20% הנחה סייבר מאנדיי',
    discount: 20,
    discountType: 'percentage',
    minOrder: 60,
    maxDiscount: 40,
    category: 'electronics',
    validFrom: '2024-12-01',
    validUntil: '2024-12-02',
    isNewUser: false,
    popularity: 95,
  },
  {
    id: 'ali-sports-2024',
    code: 'SPORT15',
    description: '15% off sports & outdoors',
    descriptionHe: '15% הנחה על ספורט וחוץ',
    discount: 15,
    discountType: 'percentage',
    minOrder: 35,
    maxDiscount: 20,
    category: 'sports',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    isNewUser: false,
    popularity: 75,
  },
  {
    id: 'ali-beauty-2024',
    code: 'BEAUTY18',
    description: '18% off beauty & health',
    descriptionHe: '18% הנחה על טיפוח ובריאות',
    discount: 18,
    discountType: 'percentage',
    minOrder: 30,
    maxDiscount: 25,
    category: 'beauty',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    isNewUser: false,
    popularity: 82,
  },
  // קופון VIP
  {
    id: 'ali-vip-2024',
    code: 'VIP50',
    description: '$50 off orders over $200',
    descriptionHe: '$50 הנחה בהזמנות מעל $200',
    discount: 50,
    discountType: 'fixed',
    minOrder: 200,
    maxDiscount: 50,
    category: 'general',
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    isNewUser: false,
    popularity: 70,
    isVIP: true,
  },
];

/**
 * מושך קופונים פעילים מסוננים לפי פרמטרים
 * @param {Object} params - פרמטרים לסינון
 * @param {string} params.category - קטגוריית מוצר
 * @param {number} params.orderAmount - סכום ההזמנה הנוכחי
 * @param {boolean} params.isNewUser - האם משתמש חדש
 * @returns {Promise<Array>} רשימת קופונים פעילים
 */
export async function fetchActiveCoupons(params = {}) {
  const { category = 'general', orderAmount = 0, isNewUser = false } = params;
  
  // סינון קופונים לפי פרמטרים
  let filtered = LOCAL_COUPON_DB.filter(coupon => {
    // בדיקת תוקף
    if (!isCouponValid(coupon)) return false;
    
    // בדיקת קטגוריה
    if (coupon.category !== 'general' && coupon.category !== category) return false;
    
    // בדיקת סכום מינימום
    if (orderAmount > 0 && coupon.minOrder > orderAmount) return false;
    
    // בדיקת משתמש חדש
    if (coupon.isNewUser && !isNewUser) return false;
    
    return true;
  });
  
  // מיון לפי פופולריות וחיסכון פוטנציאלי
  filtered = filtered.sort((a, b) => {
    const savingsA = calculateEstimatedSavings(a, orderAmount);
    const savingsB = calculateEstimatedSavings(b, orderAmount);
    return (b.popularity * 0.3 + savingsB * 0.7) - (a.popularity * 0.3 + savingsA * 0.7);
  });
  
  // הוספת חיסכון משוער לכל קופון
  return filtered.map(coupon => ({
    ...coupon,
    estimatedSavings: calculateEstimatedSavings(coupon, orderAmount),
    formattedSavings: formatSavings(calculateEstimatedSavings(coupon, orderAmount)),
    isApplicable: isCouponApplicable(coupon, orderAmount),
  }));
}

/**
 * בודק אם קופון בתוקף
 */
function isCouponValid(coupon) {
  const now = new Date();
  const validFrom = new Date(coupon.validFrom);
  const validUntil = new Date(coupon.validUntil);
  
  // הגדרה לסוף היום של validUntil
  validUntil.setHours(23, 59, 59, 999);
  
  return now >= validFrom && now <= validUntil;
}

/**
 * בודק אם קופון ישים לסכום ההזמנה
 */
function isCouponApplicable(coupon, orderAmount) {
  if (orderAmount === 0) return true; // לא יודעים את הסכום עדיין
  return orderAmount >= coupon.minOrder;
}

/**
 * מחשב חיסכון משוער
 */
function calculateEstimatedSavings(coupon, orderAmount) {
  if (orderAmount === 0) return 0;
  if (!isCouponApplicable(coupon, orderAmount)) return 0;
  
  if (coupon.discountType === 'percentage') {
    const savings = (orderAmount * coupon.discount) / 100;
    return coupon.maxDiscount ? Math.min(savings, coupon.maxDiscount) : savings;
  }
  
  if (coupon.discountType === 'fixed') {
    return Math.min(coupon.discount, orderAmount);
  }
  
  if (coupon.discountType === 'shipping') {
    // משלוח חינם - הערכה של $5-$15
    return 8;
  }
  
  return 0;
}

/**
 * מפרמט את החיסכון לתצוגה
 */
function formatSavings(amount) {
  if (amount === 0) return '';
  return amount >= 1 ? `$${amount.toFixed(2)}` : `${(amount * 100).toFixed(0)}¢`;
}

/**
 * מעתיק קוד קופון ללוח
 * @param {string} code - קוד הקופון
 * @returns {Promise<boolean>} האם ההעתקה הצליחה
 */
export async function copyCouponToClipboard(code) {
  try {
    await navigator.clipboard.writeText(code);
    
    // שמיעת צליל עדין (אופציונלי)
    playSuccessSound();
    
    return true;
  } catch (err) {
    console.error('[Coupons] Failed to copy:', err);
    return false;
  }
}

/**
 * משמיע צליל עדין של הצלחה
 */
function playSuccessSound() {
  try {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
    audio.volume = 0.1;
    audio.play().catch(() => {}); // מתעלם משגיאות אוטופליי
  } catch (e) {
    // צליל לא קריטי
  }
}

/**
 * מזהה קטגוריה מה-URL או שם המוצר
 */
export function detectCategoryFromProduct(productTitle = '', url = '') {
  const title = productTitle.toLowerCase();
  const urlLower = url.toLowerCase();
  
  const categoryMap = [
    { keywords: ['phone', 'laptop', 'computer', 'electronic', 'camera', 'headphone', 'charger', 'cable', 'usb', 'screen', 'monitor', 'keyboard', 'mouse'], category: 'electronics' },
    { keywords: ['shirt', 'dress', 'shoe', 'pant', 'fashion', 'clothing', 'bag', 'jewelry', 'watch', 'accessory', 'hat', 'scarf'], category: 'fashion' },
    { keywords: ['home', 'garden', 'furniture', 'decor', 'kitchen', 'bathroom', 'light', 'lamp', 'chair', 'table', 'bed'], category: 'home' },
    { keywords: ['sport', 'fitness', 'gym', 'bicycle', 'running', 'yoga', 'ball', 'outdoor', 'camping', 'hiking'], category: 'sports' },
    { keywords: ['beauty', 'makeup', 'skincare', 'hair', 'cosmetic', 'perfume', 'cream', 'serum', 'lipstick'], category: 'beauty' },
    { keywords: ['toy', 'baby', 'kid', 'game', 'doll', 'lego', 'puzzle', 'educational'], category: 'toys' },
    { keywords: ['car', 'auto', 'vehicle', 'motorcycle', 'tire', 'tool', 'accessory'], category: 'automotive' },
  ];
  
  for (const { keywords, category } of categoryMap) {
    if (keywords.some(k => title.includes(k) || urlLower.includes(k))) {
      return category;
    }
  }
  
  return 'general';
}

/**
 * מזהה אם המשתמש נמצא בדף עגלת קניות או תשלום
 */
export function isCartOrCheckoutPage(url = window.location.href) {
  const urlLower = url.toLowerCase();
  const cartPatterns = [
    '/cart',
    '/checkout',
    '/shoppingcart',
    '/order',
    '/payment',
    '/buy',
    '/purchase',
  ];
  
  return cartPatterns.some(pattern => urlLower.includes(pattern));
}

/**
 * מחלץ את סכום העגנה מדף האלייאקספרס
 */
export function extractCartAmount() {
  try {
    // ניסיון למצוא את סכום העגנה בדף
    const selectors = [
      '.cart-summary-price',
      '.checkout-order-total',
      '[data-pl="total_price"]',
      '.order-total',
      '.grand-total',
      '.cart-total',
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || '';
        const match = text.match(/[\d,]+\.?\d*/);
        if (match) {
          return parseFloat(match[0].replace(',', ''));
        }
      }
    }
    
    return 0;
  } catch (e) {
    return 0;
  }
}

export { LOCAL_COUPON_DB };
