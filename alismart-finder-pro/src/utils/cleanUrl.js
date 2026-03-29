/**
 * URL Cleaning Utility
 * ניקוי URL מפרמטרי מעקב ו-tracking
 * 
 * מסיר פרמטרים לא נחוצים מלינקים של AliExpress
 * ומייצר URL נקי לניווט
 */

// רשימת פרמטרי tracking שיש להסיר
const TRACKING_PARAMS = [
  // פרמטרי AliExpress
  'aff_fcid',
  'aff_fsk',
  'aff_platform',
  'aff_trace_key',
  'bizType',
  'businessType',
  'scm',
  'scm_id',
  'scm-url',
  'pvid',
  'algo_pvid',
  'algo_expid',
  'tpp_route',
  'tpp_backup',
  'gatewayAdapt',
  '_',
  'spm',
  'spm_id',
  'spm_from',
  'spider_touch',
  'tt',
  'terminal_id',
  'aff_short_key',
  'sourceType',
  'sourceName',
  'sk',
  'scm1003',
  'scm1004',
  'scm1005',
  'scm1006',
  'scm1007',
  'scm1008',
  'scm1009',
  'scm1010',
  'srcSns',
  'spreadType',
  'social_params',
  'aff_match_key',
  'aff_ctrld',
  'aff_ctrld_bad',
  'terminal_id',
  'initiative_id',
  'mall_affr',
  'dp',
  'af',
  'cv',
  'cn',
  'dp',
  'afref',
  'afss',
  // פרמטרים גנריים של מעקב
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ttclid',
  'wbraid',
  'gbraid',
  'dclid',
  'zanpid',
  'kenshoo',
  'cid',
  'pid',
  'irgwc',
  'irclickid',
  'clickid',
  'ref',
  'referrer',
  'referral',
  'trackId',
  'track',
  'tracking',
  'affiliate',
  'aff_id',
  'aff_sub',
  'aff_sub2',
  'aff_sub3',
  'sub_id',
  'subid',
  'click_id',
  'session_id',
  'visitor_id',
  'user_id',
  'campaign_id',
  'ad_id',
  'adgroup_id',
  'creative_id',
  'placement_id',
  'device_id',
  'browser_id',
  // פרמטרים נוספים
  'sourcingGuid',
  'strategyId',
  'storeId',
  'pageId',
  'secrekey',
  'fromRankId',
  'gps-id',
  'scm10001',
  'scm10002',
  'scm10003',
];

/**
 * מנקה URL מפרמטרי מעקב
 * 
 * @param {string} url - URL מקורי
 * @returns {string} URL מנוקה
 */
export function cleanProductUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  try {
    const urlObj = new URL(url);
    
    // הסרת פרמטרי מעקב
    TRACKING_PARAMS.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // הסרת פרמטרים ריקים
    const keys = Array.from(urlObj.searchParams.keys());
    keys.forEach(key => {
      const value = urlObj.searchParams.get(key);
      if (!value || value === 'null' || value === 'undefined' || value === '') {
        urlObj.searchParams.delete(key);
      }
    });
    
    // החזרת URL מנוקה
    return urlObj.toString();
  } catch (error) {
    console.warn('[cleanProductUrl] Failed to clean URL:', error);
    return url; // במקרה של שגיאה, מחזירים את המקורי
  }
}

/**
 * מנקה URL באופן אגרסיבי - מסיר את כל ה-query parameters
 * 
 * @param {string} url - URL מקורי
 * @returns {string} URL ללא query parameters
 */
export function cleanUrlAggressive(url) {
  if (!url || typeof url !== 'string') return '';
  
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch (error) {
    return url;
  }
}

/**
 * בודק אם URL מכיל פרמטרי מעקב
 * 
 * @param {string} url - URL לבדיקה
 * @returns {boolean} true אם יש פרמטרי מעקב
 */
export function hasTrackingParams(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    const params = Array.from(urlObj.searchParams.keys());
    
    return params.some(param => 
      TRACKING_PARAMS.some(trackParam => 
        param.toLowerCase() === trackParam.toLowerCase()
      )
    );
  } catch (error) {
    return false;
  }
}

/**
 * מקבל את מזהה המוצר מ-URL
 * 
 * @param {string} url - URL של AliExpress
 * @returns {string|null} מזהה מוצר או null
 */
export function extractProductId(url) {
  if (!url || typeof url !== 'string') return null;
  
  try {
    // תבנית 1: /item/1234567890.html
    const match1 = url.match(/\/item\/(\d+)\.html/);
    if (match1) return match1[1];
    
    // תבנית 2: ?item_id=1234567890
    const urlObj = new URL(url);
    const itemId = urlObj.searchParams.get('item_id');
    if (itemId) return itemId;
    
    // תבנית 3: /product/1234567890
    const match2 = url.match(/\/product\/(\d+)/);
    if (match2) return match2[1];
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * יוצר URL נקי למוצר AliExpress
 * 
 * @param {string} productId - מזהה מוצר
 * @returns {string} URL נקי
 */
export function buildCleanProductUrl(productId) {
  if (!productId) return '';
  return `https://www.aliexpress.com/item/${productId}.html`;
}

/**
 * מנקה URL של תמונה מסיומת גדלים
 * 
 * @param {string} imageUrl - URL תמונה
 * @returns {string} URL מנוקה
 */
export function cleanImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  
  // הסרת suffixes של גדלים AliExpress
  let cleaned = imageUrl
    .replace(/_\d+x\d+\.[a-zA-Z]+$/, '')  // _80x80.jpg
    .replace(/\.jpg_\d+x\d+$/, '.jpg')   // .jpg_50x50
    .replace(/_\d+x\d+$/, '');            // _300x300 (ללא סיומת)
  
  // הוספת https אם חסר
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  }
  
  return cleaned;
}

/**
 * מנקה כתובת מוצר AliExpress לקיצור
 * שומר רק על הדומיין ומזהה המוצר
 * 
 * @param {string} url - URL מקורי
 * @returns {string} URL מקוצר
 */
export function simplifyAliExpressUrl(url) {
  const productId = extractProductId(url);
  if (productId) {
    return buildCleanProductUrl(productId);
  }
  return cleanProductUrl(url);
}

/**
 * מוודא ש-URL הוא תקין לחלוטין
 * 
 * @param {string} url - URL לבדיקה
 * @returns {string} URL תקין
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  let validated = url.trim();
  
  // הוספת פרוטוקול אם חסר
  if (!validated.startsWith('http://') && !validated.startsWith('https://')) {
    validated = 'https://' + validated;
  }
  
  try {
    new URL(validated);
    return validated;
  } catch (error) {
    return '';
  }
}

/**
 * מחלץ דומיין מ-URL
 * 
 * @param {string} url - URL
 * @returns {string} דומיין
 */
export function extractDomain(url) {
  if (!url || typeof url !== 'string') return '';
  
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

/**
 * בודק אם URL הוא של AliExpress
 * 
 * @param {string} url - URL לבדיקה
 * @returns {boolean} true אם זה AliExpress
 */
export function isAliExpressUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const domain = extractDomain(url).toLowerCase();
  return domain.includes('aliexpress');
}

export default {
  cleanProductUrl,
  cleanUrlAggressive,
  hasTrackingParams,
  extractProductId,
  buildCleanProductUrl,
  cleanImageUrl,
  simplifyAliExpressUrl,
  validateUrl,
  extractDomain,
  isAliExpressUrl,
  TRACKING_PARAMS,
};
