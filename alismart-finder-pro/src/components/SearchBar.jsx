import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * SearchBar Component
 * שורת חיפוש גלובלית עם autocomplete
 * 
 * תכונות:
 * - עיצוב מינימליסטי עם רקע אפור בהיר ופינות מעוגלות
 * - Autocomplete עם הצעות חיפוש בזמן אמת
 * - היסטוריית חיפושים (5 אחרונים)
 * - Debounce של 300ms
 * - תמיכה ב-RTL
 */

const DEBOUNCE_MS = 300;
const MAX_HISTORY = 5;
const STORAGE_KEY = 'ALISMART_SEARCH_HISTORY';

export default function SearchBar({ 
  onSearch, 
  placeholder,
  initialValue = '',
  showHistory = true,
  compact = false,
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  
  const isRTL = i18n.language === 'he';

  // טעינת היסטוריה בטעינה ראשונה
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // סגירת dropdown בלחיצה מחוץ
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // טעינת היסטוריה
  const loadSearchHistory = async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      setHistory(result[STORAGE_KEY] || []);
    } catch (e) {
      setHistory([]);
    }
  };

  // שמירת היסטוריה
  const saveSearchHistory = async (newHistory) => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: newHistory });
    } catch (e) {
      // Ignore
    }
  };

  // הוספת חיפוש להיסטוריה
  const addToHistory = useCallback((searchTerm) => {
    if (!searchTerm.trim()) return;
    
    const newHistory = [
      { term: searchTerm.trim(), timestamp: Date.now() },
      ...history.filter(h => h.term !== searchTerm.trim()),
    ].slice(0, MAX_HISTORY);
    
    setHistory(newHistory);
    saveSearchHistory(newHistory);
  }, [history]);

  // קבלת הצעות חיפוש
  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    try {
      // קריאה ל-API של עליאקספרס להצעות
      const response = await fetch(
        `https://suggest.aliexpress.com/api/suggest?query=${encodeURIComponent(searchQuery)}&site=glo&lang=${i18n.language === 'he' ? 'he' : 'en'}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      const suggestions = data.suggestions?.map(s => s.keyword) || [];
      
      setSuggestions(suggestions.slice(0, 6));
    } catch (error) {
      // Fallback - הצעות מקומיות
      const localSuggestions = generateLocalSuggestions(searchQuery);
      setSuggestions(localSuggestions);
    } finally {
      setIsLoading(false);
    }
  }, [i18n.language]);

  // יצירת הצעות מקומיות כ-fallback
  const generateLocalSuggestions = (searchQuery) => {
    const commonTerms = [
      'phone case', 'wireless earbuds', 'smart watch', 'bluetooth speaker',
      'led lights', 'usb cable', 'phone charger', 'laptop stand',
      'kitchen gadget', 'home decor', 'fashion accessories', 'sports equipment',
    ];
    
    return commonTerms
      .filter(term => term.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 6);
  };

  // Debounce על הקלדה
  useEffect(() => {
    clearTimeout(debounceRef.current);
    
    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(query);
      }, DEBOUNCE_MS);
    } else {
      setSuggestions([]);
    }
    
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchSuggestions]);

  // ביצוע חיפוש
  const performSearch = useCallback((searchTerm) => {
    const term = searchTerm.trim();
    if (!term) return;
    
    addToHistory(term);
    onSearch?.(term);
    setIsOpen(false);
    setSuggestions([]);
    inputRef.current?.blur();
  }, [onSearch, addToHistory]);

  // טיפול בלחיצת Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        setQuery(suggestions[highlightedIndex]);
        performSearch(suggestions[highlightedIndex]);
      } else {
        performSearch(query);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // מחיקת פריט מהיסטוריה
  const removeFromHistory = (term, e) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h.term !== term);
    setHistory(newHistory);
    saveSearchHistory(newHistory);
  };

  // ניקוי חיפוש
  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  // הצגת dropdown
  const showDropdown = isOpen && (suggestions.length > 0 || (showHistory && history.length > 0 && !query.trim()));

  if (compact) {
    // מצב קומפקטי
    return (
      <div ref={containerRef} style={compactContainerStyles(isRTL)}>
        <div style={compactInputWrapperStyles}>
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#9ca3af" 
            strokeWidth="2"
            style={{ 
              position: 'absolute',
              [isRTL ? 'right' : 'left']: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none'
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('search.placeholder', 'Search products...')}
            style={compactInputStyles}
          />
          
          {query && (
            <button 
              onClick={clearSearch}
              style={clearButtonStyles}
            >
              ×
            </button>
          )}
        </div>

        {showDropdown && (
          <div style={compactDropdownStyles(isRTL)}>
            {suggestions.length > 0 && query.trim() ? (
              // הצעות חיפוש
              suggestions.map((suggestion, index) => (
                <div
                  key={suggestion}
                  onClick={() => {
                    setQuery(suggestion);
                    performSearch(suggestion);
                  }}
                  style={suggestionItemStyles(index === highlightedIndex)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <span style={{ flex: 1 }}>{highlightMatch(suggestion, query)}</span>
                </div>
              ))
            ) : showHistory && history.length > 0 ? (
              // היסטוריה
              <>
                <div style={sectionHeaderStyles}>
                  {t('search.recent', 'Recent searches')}
                </div>
                {history.map((item) => (
                  <div
                    key={item.term}
                    onClick={() => {
                      setQuery(item.term);
                      performSearch(item.term);
                    }}
                    style={historyItemStyles}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                      <path d="M3 3v5h5" />
                      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                    </svg>
                    <span style={{ flex: 1 }}>{item.term}</span>
                    <button 
                      onClick={(e) => removeFromHistory(item.term, e)}
                      style={removeButtonStyles}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // מצב מלא
  return (
    <div ref={containerRef} style={containerStyles(isRTL)}>
      <div style={inputWrapperStyles}>
        {/* אייקון חיפוש */}
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#9ca3af" 
          strokeWidth="2"
          style={searchIconStyles(isRTL)}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        {/* שדה קלט */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('search.placeholder', 'Search products...')}
          style={inputStyles(isRTL)}
        />

        {/* כפתור ניקוי */}
        {query && (
          <button 
            onClick={clearSearch}
            style={clearButtonStyles}
            title={t('search.clear', 'Clear')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* אינדיקטור טעינה */}
        {isLoading && (
          <div style={spinnerStyles} />
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div style={dropdownStyles(isRTL)}>
          {suggestions.length > 0 && query.trim() ? (
            // הצעות חיפוש
            <>
              <div style={sectionHeaderStyles}>
                {t('search.suggestions', 'Suggestions')}
              </div>
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion}
                  onClick={() => {
                    setQuery(suggestion);
                    performSearch(suggestion);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={suggestionItemStyles(index === highlightedIndex)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <span style={{ flex: 1 }}>{highlightMatch(suggestion, query)}</span>
                </div>
              ))}
            </>
          ) : showHistory && history.length > 0 ? (
            // היסטוריית חיפושים
            <>
              <div style={sectionHeaderStyles}>
                {t('search.recent', 'Recent searches')}
              </div>
              {history.map((item) => (
                <div
                  key={item.term}
                  onClick={() => {
                    setQuery(item.term);
                    performSearch(item.term);
                  }}
                  style={historyItemStyles}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M3 3v5h5" />
                    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                  </svg>
                  <span style={{ flex: 1 }}>{item.term}</span>
                  <button 
                    onClick={(e) => removeFromHistory(item.term, e)}
                    style={removeButtonStyles}
                    title={t('search.remove', 'Remove')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// הדגשת התאמה בטקסט
function highlightMatch(text, query) {
  if (!query) return text;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} style={{ fontWeight: 600, color: '#ee0979' }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// Styles
const containerStyles = (isRTL) => ({
  position: 'relative',
  width: '100%',
  direction: isRTL ? 'rtl' : 'ltr',
});

const inputWrapperStyles = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const searchIconStyles = (isRTL) => ({
  position: 'absolute',
  [isRTL ? 'right' : 'left']: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  zIndex: 1,
});

const inputStyles = (isRTL) => ({
  width: '100%',
  padding: '12px 44px',
  paddingLeft: isRTL ? '44px' : '44px',
  paddingRight: isRTL ? '44px' : '44px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#1f2937',
  backgroundColor: '#f3f4f6',
  border: '2px solid transparent',
  borderRadius: '9999px',
  outline: 'none',
  transition: 'all 0.2s ease',
});

const clearButtonStyles = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: '#e5e7eb',
  color: '#6b7280',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  padding: 0,
};

const spinnerStyles = {
  position: 'absolute',
  right: '44px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '16px',
  height: '16px',
  border: '2px solid #f3f4f6',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const dropdownStyles = (isRTL) => ({
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  right: 0,
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
  zIndex: 10000,
  overflow: 'hidden',
  animation: 'fadeIn 0.2s ease',
  direction: isRTL ? 'rtl' : 'ltr',
});

const sectionHeaderStyles = {
  padding: '10px 16px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  backgroundColor: '#f9fafb',
};

const suggestionItemStyles = (isHighlighted) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#374151',
  backgroundColor: isHighlighted ? '#f3f4f6' : 'transparent',
  transition: 'background-color 0.15s ease',
});

const historyItemStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#374151',
  transition: 'background-color 0.15s ease',
  ':hover': {
    backgroundColor: '#f3f4f6',
  },
};

const removeButtonStyles = {
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#9ca3af',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  padding: 0,
  opacity: 0,
  ':hover': {
    opacity: 1,
  },
};

// Compact styles
const compactContainerStyles = (isRTL) => ({
  position: 'relative',
  width: '100%',
  direction: isRTL ? 'rtl' : 'ltr',
});

const compactInputWrapperStyles = {
  position: 'relative',
};

const compactInputStyles = {
  width: '100%',
  padding: '8px 32px',
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  backgroundColor: '#f3f4f6',
  border: 'none',
  borderRadius: '9999px',
  outline: 'none',
};

const compactDropdownStyles = (isRTL) => ({
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  zIndex: 10000,
  overflow: 'hidden',
  direction: isRTL ? 'rtl' : 'ltr',
});
