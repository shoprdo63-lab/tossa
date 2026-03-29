import React, { useState } from 'react';

/**
 * AliSmart Button Component
 * כפתור AliSmart המעוצב ב-Tailwind CSS
 * 
 * עיצוב "Quiet Luxury" - ורוד-כתום gradient, עגול, מופיע ב-hover
 * מוצג רק בעת hover על התמונה לניקיון ויזואלי
 * 
 * @param {Object} props
 * @param {Object} props.productData - נתוני המוצר (title, imgUrl, price)
 * @param {Function} props.onClick - פונקציה לטיפול בלחיצה
 */

export default function AliButton({ productData, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.();
  };

  return (
    <div 
      className="alismart-button-wrapper"
      onMouseEnter={() => {
        setIsHovered(true);
        setShowTooltip(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowTooltip(false);
      }}
      style={wrapperStyles}
    >
      {/* הכפתור הראשי */}
      <button
        onClick={handleClick}
        className="alismart-trigger-btn"
        style={{
          ...buttonStyles,
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          boxShadow: isHovered 
            ? '0 4px 12px rgba(238, 9, 121, 0.6)' 
            : '0 2px 8px rgba(238, 9, 121, 0.4)',
        }}
        aria-label="מצא מחיר זול יותר"
        title="מצא מחיר זול יותר"
      >
        {/* אייקון זכוכית מגדלת */}
        <svg 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        
        <span style={{ fontSize: '11px', fontWeight: 600 }}>AliSmart</span>
      </button>

      {/* Tooltip בעברית */}
      {showTooltip && (
        <div 
          className="alismart-tooltip"
          style={tooltipStyles}
        >
          מצא מחיר זול יותר
        </div>
      )}
    </div>
  );
}

// סגנונות inline לבידוד מוחלט מהדף המארח
const wrapperStyles = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  zIndex: 2147483646,
  pointerEvents: 'auto',
};

const buttonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
  color: 'white',
  border: 'none',
  borderRadius: '50px',
  cursor: 'pointer',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '11px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  opacity: 0.95,
  transition: 'all 0.2s ease',
  lineHeight: 1,
};

const tooltipStyles = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  backgroundColor: '#1a1a2e',
  color: 'white',
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  whiteSpace: 'nowrap',
  zIndex: 2147483647,
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  animation: 'fadeIn 0.2s ease',
  direction: 'rtl',
};
