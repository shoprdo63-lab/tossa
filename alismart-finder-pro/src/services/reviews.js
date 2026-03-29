/**
 * Reviews Service
 * שירות ביקורות - סריקה וסיכום
 * 
 * תכונות:
 * - חילוץ ביקורות מה-DOM של AliExpress
 * - סיכום AI של ביקורות
 * - ניתוח סנטימנט מקומי כ-guardrail
 */

/**
 * חולץ ביקורות מדף AliExpress
 * @returns {Array} מערך של ביקורות
 */
export function extractReviewsFromPage() {
  try {
    const reviews = [];
    
    // Selectors לביקורות באליאקספרס
    const reviewSelectors = [
      '.feedback-item',
      '.review-item',
      '[class*="feedback"]',
      '[class*="review"]',
      '.evaluation-item',
    ];
    
    for (const selector of reviewSelectors) {
      const elements = document.querySelectorAll(selector);
      
      elements.forEach(el => {
        try {
          // חילוץ דירוג
          const ratingSelectors = [
            '.star-rating',
            '.rating-stars',
            '[class*="rating"]',
            '.stars',
          ];
          let rating = 0;
          for (const rs of ratingSelectors) {
            const re = el.querySelector(rs);
            if (re) {
              // ניסיון לחלץ ממחלקה או מטקסט
              const classMatch = re.className.match(/(\d)/);
              const textMatch = re.textContent?.match(/(\d)/);
              rating = parseInt(classMatch?.[1] || textMatch?.[1] || 0);
              if (rating > 0) break;
            }
          }
          
          // חילוץ תוכן הביקורת
          const contentSelectors = [
            '.feedback-content',
            '.review-content',
            '.feedback-text',
            '.review-text',
            '.buyer-feedback',
            'p[class*="content"]',
          ];
          let content = '';
          for (const cs of contentSelectors) {
            const ce = el.querySelector(cs);
            if (ce) {
              content = ce.textContent?.trim() || '';
              if (content) break;
            }
          }
          
          // חילוץ תאריך
          const dateSelectors = [
            '.feedback-time',
            '.review-date',
            '.date',
            'time',
            '.feedback-date',
          ];
          let date = '';
          for (const ds of dateSelectors) {
            const de = el.querySelector(ds);
            if (de) {
              date = de.textContent?.trim() || de.dateTime || '';
              if (date) break;
            }
          }
          
          // חילוץ שם משתמש
          const userSelectors = [
            '.user-name',
            '.buyer-name',
            '.reviewer-name',
            '.author',
          ];
          let username = '';
          for (const us of userSelectors) {
            const ue = el.querySelector(us);
            if (ue) {
              username = ue.textContent?.trim() || '';
              if (username) break;
            }
          }
          
          // חילוץ תמונות (אם יש)
          const images = [];
          const imgSelectors = el.querySelectorAll('img[src*="feedback"], img[class*="review"]');
          imgSelectors.forEach(img => {
            if (img.src) images.push(img.src);
          });
          
          if (content) {
            reviews.push({
              rating,
              content,
              date,
              username,
              images,
            });
          }
        } catch (itemError) {
          // Ignore individual item errors
        }
      });
      
      if (reviews.length > 0) break;
    }
    
    return reviews;
  } catch (error) {
    console.error('[Reviews] Failed to extract reviews:', error);
    return [];
  }
}

/**
 * סיכום AI של ביקורות באמצעות API
 * @param {Array} reviews - מערך ביקורות
 * @param {string} language - שפת הסיכום
 * @returns {Promise<Object>} סיכום מבנה Pros/Cons/Verdict
 */
export async function summarizeReviewsWithAI(reviews, language = 'en') {
  if (!reviews || reviews.length === 0) {
    throw new Error('No reviews to summarize');
  }

  try {
    // הכנת הטקסט לסיכום
    const reviewTexts = reviews
      .map(r => `Rating: ${r.rating}/5 - ${r.content}`)
      .join('\n---\n');
    
    const response = await fetch('https://alismart-proxy.vercel.app/api/summarize-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviews: reviewTexts,
        language,
        count: reviews.length,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      pros: data.pros || [],
      cons: data.cons || [],
      verdict: data.verdict || '',
      satisfactionRate: data.satisfactionRate || calculateSatisfactionRate(reviews),
      totalReviews: reviews.length,
    };
  } catch (error) {
    console.error('[Reviews] AI summarization failed:', error);
    throw error;
  }
}

/**
 * חישוב שיעור שביעות רצון מקומי
 * @param {Array} reviews - מערך ביקורות
 * @returns {number} אחוז שביעות רצון
 */
export function calculateSatisfactionRate(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  
  const positive = reviews.filter(r => r.rating >= 4).length;
  return Math.round((positive / reviews.length) * 100);
}

/**
 * ניתוח סנטימנט מקומי - Guardrail
 * @param {Array} reviews - מערך ביקורות
 * @returns {Object} תוצאות ניתוח בסיסי
 */
export function analyzeSentimentLocal(reviews) {
  if (!reviews || reviews.length === 0) {
    return {
      satisfactionRate: 0,
      pros: [],
      cons: [],
      verdict: '',
    };
  }

  const allText = reviews.map(r => r.content?.toLowerCase() || '').join(' ');
  
  // מילות מפתח חיוביות
  const positiveKeywords = {
    en: ['good', 'great', 'excellent', 'perfect', 'amazing', 'quality', 'fast', 'recommend', 'love', 'nice', 'best', 'happy', 'satisfied'],
    he: ['טוב', 'מעולה', 'איכותי', 'מהיר', 'מומלץ', 'אהבתי', 'נחמד', 'הכי טוב', 'מאושר', 'מרוצה'],
  };
  
  // מילות מפתח שליליות
  const negativeKeywords = {
    en: ['bad', 'poor', 'terrible', 'slow', 'broken', 'defective', 'waste', 'disappointing', 'small', 'different', 'wrong', 'useless'],
    he: ['רע', 'גרוע', 'נורא', 'איטי', 'שבור', 'פגום', 'בזבוז', 'מאכזב', 'קטן', 'שונה', 'לא נכון', 'חסר תועלת'],
  };
  
  // זיהוי Pros
  const detectedPros = [];
  const posWords = positiveKeywords['en'].concat(positiveKeywords['he']);
  posWords.forEach(word => {
    if (allText.includes(word) && detectedPros.length < 3) {
      detectedPros.push(word);
    }
  });
  
  // זיהוי Cons
  const detectedCons = [];
  const negWords = negativeKeywords['en'].concat(negativeKeywords['he']);
  negWords.forEach(word => {
    if (allText.includes(word) && detectedCons.length < 3) {
      detectedCons.push(word);
    }
  });

  // חישוב שיעור שביעות רצון
  const positiveCount = reviews.filter(r => r.rating >= 4).length;
  const negativeCount = reviews.filter(r => r.rating <= 2).length;
  const total = reviews.length;
  
  const satisfactionRate = Math.round((positiveCount / total) * 100);
  
  // קביעת ורדיקט
  let verdict = '';
  if (satisfactionRate >= 80) {
    verdict = 'Highly recommended based on positive reviews';
  } else if (satisfactionRate >= 60) {
    verdict = 'Mixed reviews - consider your priorities';
  } else {
    verdict = 'Proceed with caution - many negative reviews';
  }

  return {
    satisfactionRate,
    pros: detectedPros.length ? detectedPros : ['Generally positive feedback'],
    cons: detectedCons.length ? detectedCons : ['No major issues mentioned'],
    verdict,
    breakdown: {
      positive: positiveCount,
      neutral: total - positiveCount - negativeCount,
      negative: negativeCount,
    },
  };
}

/**
 * פילטר ביקורות לפי דירוג
 * @param {Array} reviews - מערך ביקורות
 * @param {number} minRating - דירוג מינימלי
 * @param {number} maxRating - דירוג מקסימלי
 * @returns {Array} ביקורות מפולטרות
 */
export function filterReviewsByRating(reviews, minRating = 1, maxRating = 5) {
  return reviews.filter(r => r.rating >= minRating && r.rating <= maxRating);
}

/**
 * מיון ביקורות לפי רלוונטיות
 * @param {Array} reviews - מערך ביקורות
 * @returns {Array} ביקורות ממויינות
 */
export function sortReviewsByRelevance(reviews) {
  return [...reviews].sort((a, b) => {
    // עדיפות לביקורות עם תוכן ארוך ודירוג ברור
    const aScore = (a.content?.length || 0) + (a.rating === 5 ? 10 : a.rating === 1 ? 10 : 0);
    const bScore = (b.content?.length || 0) + (b.rating === 5 ? 10 : b.rating === 1 ? 10 : 0);
    return bScore - aScore;
  });
}
