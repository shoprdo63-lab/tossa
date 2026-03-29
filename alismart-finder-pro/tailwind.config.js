/** @type {import('tailwindcss').Config} */

/**
 * AliSmart Finder Pro - Tailwind Configuration
 * הגדרות Tailwind CSS לתוסף Chrome
 * 
 * עיצוב "Quiet Luxury" עם פלטת צבעים:
 * - ורוד-כתום (gradient): #ff6a00 → #ee0979
 * - רקע כהה: #1a1a2e
 * - טקסט בהיר: #f8f9fa
 */

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  
  theme: {
    extend: {
      // פלטת צבעים מותאמת
      colors: {
        // צבעי מותג
        brand: {
          primary: '#ff6a00',
          secondary: '#ee0979',
          gradient: 'linear-gradient(135deg, #ff6a00, #ee0979)',
        },
        
        // צבעי רקע
        dark: {
          900: '#1a1a2e',
          800: '#16213e',
          700: '#2d2d44',
          600: '#3d3d5c',
        },
        
        // צבעי טקסט
        text: {
          primary: '#f8f9fa',
          secondary: '#adb5bd',
          muted: '#6c757d',
        },
        
        // צבעי מצב
        status: {
          success: '#28a745',
          warning: '#ffc107',
          danger: '#dc3545',
          info: '#17a2b8',
        },
        
        // צבעי רמת אמון
        trust: {
          high: '#28a745',
          medium: '#ffc107',
          low: '#6c757d',
          unknown: '#adb5bd',
        }
      },
      
      // גופנים
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif'
        ],
        hebrew: [
          'Inter',
          '"Segoe UI Hebrew"',
          '"Noto Sans Hebrew"',
          'sans-serif'
        ]
      },
      
      // גדלי spacing
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      // גדלי z-index
      zIndex: {
        'max': '2147483647',
        'overlay': '2147483646',
        'sidebar': '2147483645',
        'tooltip': '2147483644',
      },
      
      // אנימציות
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        }
      },
      
      // צללים
      boxShadow: {
        'brand': '0 2px 8px rgba(238, 9, 121, 0.4)',
        'brand-hover': '0 4px 12px rgba(238, 9, 121, 0.6)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.15)',
        'sidebar': '-2px 0 10px rgba(0, 0, 0, 0.3)',
      },
      
      // border-radius
      borderRadius: {
        'pill': '50px',
      },
      
      // גדלי מקסימום
      maxWidth: {
        'sidebar': '380px',
        'popover': '320px',
      },
      
      // גדלי מינימום
      minWidth: {
        'button': '80px',
      }
    },
  },
  
  plugins: [
    // פלאגין לתוספים נוספים אם יידרש בעתיד
  ],
  
  // הגדרות core
  corePlugins: {
    // ודא שכל utilities זמינים
  },
  
  // מצב dark mode (כהה תמיד לתוסף)
  darkMode: 'class',
  
  // סט safe list ל-classים דינמיים
  safelist: [
    'as-trust-high',
    'as-trust-medium', 
    'as-trust-low',
    'as-trust-unknown',
    'as-best-deal',
    'as-best-value-badge',
    'bg-gradient-to-r',
    'from-brand-primary',
    'to-brand-secondary',
  ]
}
