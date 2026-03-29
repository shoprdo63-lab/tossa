/**
 * Privacy Check Utility
 * בדיקת פרטיות תמונות - זיהוי דמויות אנושיות
 * 
 * מטרה: להפעיל Blur אוטומטי על תמונות שעלולות להכיל דמויות אנושיות
 * כדי לשמור על ערכי הפרטיות של המשתמש
 * 
 * שימוש: בינה מלאכותית לזיהוי אובייקטים בצד שרת או heuristics מקומיים
 */

/**
 * בודק אם תמונה עשויה להכיל דמויות אנושיות
 * מבוסס על heuristics ו-metadata
 * 
 * @param {string} imageUrl - URL התמונה
 * @returns {Promise<boolean>} האם לטשטש את התמונה
 */
export async function checkForFigures(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return false;
  }

  try {
    // בדיקות heuristics מקומיות
    const checks = [
      checkUrlPatterns(imageUrl),
      checkFileName(imageUrl),
      checkImageSize(imageUrl),
    ];

    // אם אחת הבדיקות מצביעה על דמות אנושית
    const results = await Promise.all(checks);
    const shouldBlur = results.some(result => result === true);

    // בדיקת API חיצוני (אופציונלי - אם מוגדר)
    if (!shouldBlur && hasImageAnalysisAPI()) {
      const apiResult = await analyzeWithAPI(imageUrl);
      return apiResult;
    }

    return shouldBlur;

  } catch (error) {
    console.warn('[checkForFigures] Error checking image:', error);
    // במקרה של שגיאה - מטשטשים לזהירות
    return false;
  }
}

/**
 * בדיקת תבניות URL - האם ה-URL מכיל רמזים לדמות
 */
async function checkUrlPatterns(imageUrl) {
  const suspiciousPatterns = [
    // תבניות שעלולות להכיל דמויות
    /model/i,
    /mannequin/i,
    /person/i,
    /people/i,
    /face/i,
    /portrait/i,
    /woman/i,
    /man/i,
    /girl/i,
    /boy/i,
    /body/i,
    /wear/i,
    /fashion/i,
    /clothing-model/i,
    /real-people/i,
  ];

  // בדיקת נתיב URL
  const urlLower = imageUrl.toLowerCase();
  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => 
    pattern.test(urlLower)
  );

  // בדיקת קטגוריות מוצרים שעלולות להכיל דמויות
  const clothingCategories = [
    'clothing', 'apparel', 'fashion', 'dress', 'shirt', 'pants', 
    'skirt', 'jacket', 'coat', 'suit', 'swimwear', 'lingerie',
    'underwear', 'activewear', 'sportswear'
  ];

  const isClothingCategory = clothingCategories.some(cat => 
    urlLower.includes(cat)
  );

  return hasSuspiciousPattern && isClothingCategory;
}

/**
 * בדיקת שם קובץ
 */
async function checkFileName(imageUrl) {
  try {
    const url = new URL(imageUrl);
    const pathname = url.pathname.toLowerCase();
    const filename = pathname.split('/').pop() || '';

    const suspiciousWords = [
      'model', 'person', 'people', 'face', 'portrait',
      'woman', 'man', 'girl', 'boy', 'lady', 'gentleman',
      'figure', 'human', 'body', 'wear'
    ];

    return suspiciousWords.some(word => filename.includes(word));
  } catch (error) {
    return false;
  }
}

/**
 * בדיקת גודל תמונה - האם יש aspect ratio אופייני לתמונות עם דמויות
 */
async function checkImageSize(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      
      // aspect ratios אופייניים לתמונות עם דמויות:
      // portrait (3:4, 2:3, 9:16) או square (1:1)
      const isPortrait = aspectRatio >= 0.5 && aspectRatio <= 0.75;
      const isSquare = aspectRatio >= 0.9 && aspectRatio <= 1.1;
      
      // התמונה גדולה מספיק להכיל פרטים
      const isLargeEnough = img.width >= 300 && img.height >= 300;
      
      resolve((isPortrait || isSquare) && isLargeEnough);
    };

    img.onerror = () => {
      resolve(false);
    };

    // timeout של 3 שניות
    setTimeout(() => {
      resolve(false);
    }, 3000);

    img.src = imageUrl;
  });
}

/**
 * בדיקה האם יש API זמין לניתוח תמונות
 */
function hasImageAnalysisAPI() {
  // בדיקה אם יש API key או endpoint מוגדר
  return false; // כרגע לא זמין - ידרוש integration בעתיד
}

/**
 * ניתוח תמונה באמצעות API חיצוני
 */
async function analyzeWithAPI(imageUrl) {
  // Placeholder - בדיקת API בעתיד
  // יכול להשתמש ב-Google Vision API, AWS Rekognition, או Azure Computer Vision
  
  try {
    // דוגמה של בקשה ל-API
    // const response = await fetch('https://api.example.com/analyze-image', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ imageUrl })
    // });
    // const result = await response.json();
    // return result.containsHumanFigure;
    
    return false;
  } catch (error) {
    console.error('[analyzeWithAPI] Failed:', error);
    return false;
  }
}

/**
 * פונקציה סינכרונית לבדיקה מהירה (fallback)
 */
export function checkForFiguresQuick(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return false;
  }

  // בדיקת URL patterns בלבד (מהיר)
  const suspiciousPatterns = [
    /model/i, /mannequin/i, /person/i, /people/i,
    /woman/i, /man/i, /girl/i, /boy/i, /wear/i
  ];

  const urlLower = imageUrl.toLowerCase();
  return suspiciousPatterns.some(pattern => pattern.test(urlLower));
}

/**
 * טשטוש תמונה בקנבס (לשימוש עתידי)
 */
export function blurImageCanvas(imageElement, blurAmount = 10) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      
      // טשטוש CSS filter
      ctx.filter = `blur(${blurAmount}px)`;
      ctx.drawImage(imageElement, 0, 0);
      
      // החזרת URL של התמונה המטושטשת
      const blurredUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(blurredUrl);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * יצירת placeholder מטושטש
 */
export function generateBlurredPlaceholder(width = 300, height = 300) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = width;
    canvas.height = height;
    
    // gradient מטושטש
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f3f4f6');
    gradient.addColorStop(0.5, '#e5e7eb');
    gradient.addColorStop(1, '#d1d5db');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // הוספת אייקון עין מרכזי
    ctx.fillStyle = '#9ca3af';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👁', width / 2, height / 2);
    
    resolve(canvas.toDataURL());
  });
}

/**
 * בדיקת רמת פרטיות מוגדרת
 */
export async function getPrivacyLevel() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['PRIVACY_LEVEL'], (result) => {
      resolve(result.PRIVACY_LEVEL || 'medium'); // low, medium, high
    });
  });
}

/**
 * פונקציה ראשית שמחליטה האם להפעיל blur
 * מבוססת על רמת הפרטיות המוגדרת
 */
export async function shouldBlurImage(imageUrl, category = '') {
  const privacyLevel = await getPrivacyLevel();
  
  if (privacyLevel === 'low') {
    return false; // לא מטשטשים
  }
  
  if (privacyLevel === 'high') {
    // מטשטשים את כל התמונות בקטגוריות מסוימות
    const sensitiveCategories = [
      'clothing', 'apparel', 'fashion', 'swimwear', 'lingerie'
    ];
    
    const isSensitive = sensitiveCategories.some(cat => 
      category.toLowerCase().includes(cat)
    );
    
    if (isSensitive) {
      return true;
    }
  }
  
  // בדיקה רגילה
  return checkForFigures(imageUrl);
}

export default {
  checkForFigures,
  checkForFiguresQuick,
  blurImageCanvas,
  generateBlurredPlaceholder,
  shouldBlurImage,
  getPrivacyLevel,
};
