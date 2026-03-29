import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * CloudSyncIndicator Component
 * אינדיקטור סנכרון ענן - אייקון ענן מהבהב
 * 
 * מציג:
 * - אייקון ענן SVG נקי
 * - אנימציית הבהוב בעדינות בזמן סנכרון
 * - סטטוס סנכרון (synced, syncing, offline, error)
 */

export default function CloudSyncIndicator({ status = 'synced', lastSync = null }) {
  const { t } = useTranslation();

  const getStatusConfig = () => {
    switch (status) {
      case 'syncing':
        return {
          color: '#3b82f6',
          bgColor: '#eff6ff',
          tooltip: t('cloud.syncing', 'Syncing...'),
          animate: true,
        };
      case 'offline':
        return {
          color: '#6b7280',
          bgColor: '#f3f4f6',
          tooltip: t('cloud.offline', 'Offline'),
          animate: false,
        };
      case 'error':
        return {
          color: '#ef4444',
          bgColor: '#fef2f2',
          tooltip: t('cloud.error', 'Sync failed'),
          animate: false,
        };
      case 'synced':
      default:
        return {
          color: '#22c55e',
          bgColor: '#f0fdf4',
          tooltip: t('cloud.synced', 'Synced'),
          animate: false,
        };
    }
  };

  const config = getStatusConfig();

  // פורמט זמן אחרון
  const formatLastSync = () => {
    if (!lastSync) return '';
    const date = new Date(lastSync);
    const now = new Date();
    const diff = now - date;
    
    // פחות מדקה
    if (diff < 60000) {
      return t('cloud.justNow', 'Just now');
    }
    // פחות משעה
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return t('cloud.minutesAgo', { count: minutes });
    }
    // פחות מיום
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return t('cloud.hoursAgo', { count: hours });
    }
    // יום או יותר
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={containerStyles} title={config.tooltip}>
      <div 
        style={{
          ...iconWrapperStyles,
          backgroundColor: config.bgColor,
          animation: config.animate ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke={config.color} 
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: config.animate ? 'float 2s ease-in-out infinite' : 'none',
          }}
        >
          {status === 'synced' && (
            <>
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              <polyline points="20 6 9 17 4 12" strokeWidth="3" />
            </>
          )}
          {status === 'syncing' && (
            <>
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              <path d="M12 13v4" strokeWidth="3" strokeLinecap="round" />
              <path d="M12 17l-2-2" strokeWidth="2" />
              <path d="M12 17l2-2" strokeWidth="2" />
            </>
          )}
          {status === 'offline' && (
            <>
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" />
            </>
          )}
          {status === 'error' && (
            <>
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              <circle cx="12" cy="15" r="1" fill={config.color} stroke="none" />
              <line x1="12" y1="9" x2="12" y2="12" strokeWidth="3" strokeLinecap="round" />
            </>
          )}
        </svg>
      </div>
      
      {lastSync && status === 'synced' && (
        <span style={timeStyles}>{formatLastSync()}</span>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }
      `}</style>
    </div>
  );
}

// Styles
const containerStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const iconWrapperStyles = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.3s ease',
};

const timeStyles = {
  fontSize: '11px',
  color: '#6b7280',
  fontWeight: 500,
};
