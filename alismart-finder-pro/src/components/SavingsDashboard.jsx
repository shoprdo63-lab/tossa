import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { getSavingsStats, generateSavingsShareImage, trackSavings } from '../services/utils.js';

/**
 * SavingsDashboard Component
 * דאשבורד חיסכון וסטטיסטיקה
 * 
 * תכונות:
 * - Total Saved: סכום מצטבר
 * - Smart Choices: מספר בחירות חכמות
 * - Coupons Used: קופונים שנוצלו
 * - Products Tracked: מוצרים במעקב
 * - גרף פעילות שבועית
 * - הישגים (Achievements)
 * - Share My Savings - שיתוף סטטיסטיקה
 * - עיצוב Quiet Luxury
 */

export default function SavingsDashboard() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shareImage, setShareImage] = useState(null);
  const [showAchievements, setShowAchievements] = useState(false);

  const isRTL = i18n.language === 'he';

  useEffect(() => {
    loadStats();
    
    // האזנה לעדכונים
    const listener = (message) => {
      if (message.type === 'SAVINGS_UPDATED') {
        loadStats();
      }
    };
    chrome.runtime.onMessage?.addListener(listener);
    
    return () => {
      chrome.runtime.onMessage?.removeListener(listener);
    };
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await getSavingsStats();
      setStats(data);
    } catch (error) {
      console.error('[SavingsDashboard] Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = () => {
    if (!stats) return;
    const image = generateSavingsShareImage(stats);
    setShareImage(image);
    
    // העתקה או שיתוף
    if (navigator.share) {
      fetch(image)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'alismart-savings.png', { type: 'image/png' });
          navigator.share({
            title: t('savings.shareTitle', 'My AliSmart Savings'),
            text: t('savings.shareText', 'I saved ') + stats.formattedTotal + t('savings.shareText2', ' with AliSmart!'),
            files: [file]
          }).catch(() => {});
        });
    }
  };

  const handleDemoData = async () => {
    // יצירת נתוני דמו לבדיקה
    await trackSavings({ type: 'coupon_used', amount: 12.50 });
    await trackSavings({ type: 'cheaper_choice', amount: 8.30 });
    await trackSavings({ type: 'coupon_used', amount: 5.00 });
    await trackSavings({ type: 'product_tracked', amount: 0 });
    loadStats();
  };

  if (isLoading) {
    return (
      <div style={loadingContainerStyles}>
        <div style={spinnerStyles} />
        <span style={loadingTextStyles}>{t('savings.loading', 'Loading your savings...')}</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={emptyContainerStyles}>
        <p style={emptyTextStyles}>{t('savings.noData', 'No savings data yet')}</p>
        <button onClick={handleDemoData} style={demoButtonStyles}>
          {t('savings.addDemo', 'Add Demo Data')}
        </button>
      </div>
    );
  }

  // Custom Tooltip for BarChart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={tooltipStyles}>
          <p style={tooltipLabelStyles}>{label}</p>
          <p style={tooltipValueStyles}>
            {t('savings.saved', 'Saved')}: ${payload[0].value?.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={containerStyles(isRTL)}>
      {/* Header */}
      <div style={headerStyles}>
        <div>
          <h2 style={titleStyles}>{t('savings.title', 'Your Savings')}</h2>
          <p style={subtitleStyles}>{t('savings.subtitle', 'Smart shopping stats')}</p>
        </div>
        <button onClick={handleShare} style={shareButtonStyles}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {t('savings.share', 'Share')}
        </button>
      </div>

      {/* Total Saved - Hero Card */}
      <div style={heroCardStyles}>
        <div style={heroContentStyles}>
          <span style={heroLabelStyles}>{t('savings.totalSaved', 'Total Saved')}</span>
          <span style={heroAmountStyles}>{stats.formattedTotal}</span>
          <span style={heroSubtitleStyles}>
            {t('savings.lifetime', 'Lifetime savings with AliSmart')}
          </span>
        </div>
        <div style={heroIconStyles}>💰</div>
      </div>

      {/* Stats Grid */}
      <div style={statsGridStyles}>
        <div style={statCardStyles}>
          <div style={statIconStyles}>💡</div>
          <div style={statValueStyles}>{stats.smartChoices}</div>
          <div style={statLabelStyles}>{t('savings.smartChoices', 'Smart Choices')}</div>
        </div>
        <div style={statCardStyles}>
          <div style={statIconStyles}>🎫</div>
          <div style={statValueStyles}>{stats.couponsUsed}</div>
          <div style={statLabelStyles}>{t('savings.couponsUsed', 'Coupons Used')}</div>
        </div>
        <div style={statCardStyles}>
          <div style={statIconStyles}>📦</div>
          <div style={statValueStyles}>{stats.productsTracked}</div>
          <div style={statLabelStyles}>{t('savings.tracked', 'Products Tracked')}</div>
        </div>
        <div style={statCardStyles}>
          <div style={statIconStyles}>🏷️</div>
          <div style={statValueStyles}>{stats.couponsFound}</div>
          <div style={statLabelStyles}>{t('savings.couponsFound', 'Coupons Found')}</div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div style={chartCardStyles}>
        <h3 style={chartTitleStyles}>{t('savings.weeklyActivity', 'Weekly Activity')}</h3>
        <div style={chartContainerStyles}>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={stats.weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8' }} 
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="savings" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {stats.weeklyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.savings > 0 ? '#ee0979' : '#f1f5f9'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Achievements Toggle */}
      <button 
        onClick={() => setShowAchievements(!showAchievements)}
        style={toggleButtonStyles}
      >
        <span style={toggleLabelStyles}>
          {t('savings.achievements', 'Achievements')} 
          {stats.achievements?.length > 0 && ` (${stats.achievements.length})`}
        </span>
        <span style={{ 
          transform: showAchievements ? 'rotate(180deg)' : 'none', 
          transition: 'transform 0.2s',
          fontSize: '12px'
        }}>▼</span>
      </button>

      {/* Achievements Grid */}
      {showAchievements && (
        <div style={achievementsContainerStyles}>
          {stats.achievements?.length > 0 ? (
            stats.achievements.map((achievement) => (
              <div key={achievement.id} style={achievementCardStyles}>
                <div style={achievementIconStyles}>{achievement.icon}</div>
                <div style={achievementContentStyles}>
                  <div style={achievementTitleStyles}>
                    {isRTL ? achievement.titleHe : achievement.title}
                  </div>
                  <div style={achievementDescStyles}>
                    {isRTL ? achievement.descriptionHe : achievement.description}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p style={noAchievementsStyles}>
              {t('savings.noAchievements', 'Keep shopping to unlock achievements!')}
            </p>
          )}
        </div>
      )}

      {/* Demo Button (for testing) */}
      <button onClick={handleDemoData} style={demoButtonSmallStyles}>
        {t('savings.addDemo', '+ Add Demo Data')}
      </button>

      {/* Share Image Modal */}
      {shareImage && (
        <div style={modalOverlayStyles} onClick={() => setShareImage(null)}>
          <div style={modalContentStyles} onClick={(e) => e.stopPropagation()}>
            <h3 style={modalTitleStyles}>{t('savings.shareTitle', 'Share Your Savings')}</h3>
            <img src={shareImage} alt="Savings Stats" style={shareImageStyles} />
            <div style={modalActionsStyles}>
              <a 
                href={shareImage} 
                download="alismart-savings.png" 
                style={downloadButtonStyles}
              >
                {t('savings.download', 'Download Image')}
              </a>
              <button 
                onClick={() => setShareImage(null)} 
                style={closeModalButtonStyles}
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const containerStyles = (isRTL) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px',
  backgroundColor: '#f8fafc',
  borderRadius: '20px',
  direction: isRTL ? 'rtl' : 'ltr',
});

const loadingContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  gap: '12px',
};

const spinnerStyles = {
  width: '40px',
  height: '40px',
  border: '4px solid #f3f4f6',
  borderTopColor: '#ee0979',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const loadingTextStyles = {
  fontSize: '14px',
  color: '#6b7280',
};

const emptyContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '40px 20px',
  gap: '16px',
};

const emptyTextStyles = {
  fontSize: '14px',
  color: '#9ca3af',
};

const headerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const titleStyles = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#1f2937',
  margin: 0,
};

const subtitleStyles = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '4px 0 0 0',
};

const shareButtonStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '10px 16px',
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '20px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
  transition: 'all 0.2s',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
};

const heroCardStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '24px',
  background: 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
  borderRadius: '20px',
  color: 'white',
  boxShadow: '0 10px 30px rgba(238, 9, 121, 0.3)',
};

const heroContentStyles = {
  display: 'flex',
  flexDirection: 'column',
};

const heroLabelStyles = {
  fontSize: '14px',
  fontWeight: 500,
  opacity: 0.9,
};

const heroAmountStyles = {
  fontSize: '42px',
  fontWeight: 800,
  letterSpacing: '-1px',
  margin: '8px 0',
};

const heroSubtitleStyles = {
  fontSize: '12px',
  opacity: 0.8,
};

const heroIconStyles = {
  fontSize: '48px',
};

const statsGridStyles = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '12px',
};

const statCardStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '16px',
  backgroundColor: 'white',
  borderRadius: '16px',
  border: '1px solid #f1f5f9',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const statIconStyles = {
  fontSize: '24px',
  marginBottom: '8px',
};

const statValueStyles = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#1f2937',
};

const statLabelStyles = {
  fontSize: '12px',
  color: '#6b7280',
  textAlign: 'center',
  marginTop: '4px',
};

const chartCardStyles = {
  padding: '16px',
  backgroundColor: 'white',
  borderRadius: '16px',
  border: '1px solid #f1f5f9',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const chartTitleStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
  margin: '0 0 12px 0',
};

const chartContainerStyles = {
  height: '150px',
};

const tooltipStyles = {
  backgroundColor: 'white',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
};

const tooltipLabelStyles = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '4px',
};

const tooltipValueStyles = {
  fontSize: '13px',
  color: '#22c55e',
  fontWeight: 600,
};

const toggleButtonStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const toggleLabelStyles = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
};

const achievementsContainerStyles = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: '10px',
};

const achievementCardStyles = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '14px',
  backgroundColor: '#fefce8',
  borderRadius: '12px',
  border: '1px solid #fef9c3',
  textAlign: 'center',
};

const achievementIconStyles = {
  fontSize: '28px',
  marginBottom: '8px',
};

const achievementContentStyles = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const achievementTitleStyles = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#854d0e',
};

const achievementDescStyles = {
  fontSize: '10px',
  color: '#a16207',
};

const noAchievementsStyles = {
  fontSize: '13px',
  color: '#9ca3af',
  textAlign: 'center',
  padding: '20px',
  gridColumn: '1 / -1',
};

const demoButtonStyles = {
  padding: '10px 20px',
  backgroundColor: '#f3f4f6',
  border: '1px dashed #d1d5db',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#6b7280',
  cursor: 'pointer',
};

const demoButtonSmallStyles = {
  padding: '8px 12px',
  backgroundColor: 'transparent',
  border: '1px dashed #d1d5db',
  borderRadius: '8px',
  fontSize: '11px',
  color: '#9ca3af',
  cursor: 'pointer',
  alignSelf: 'center',
};

const modalOverlayStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalContentStyles = {
  backgroundColor: 'white',
  borderRadius: '20px',
  padding: '20px',
  maxWidth: '90%',
  maxHeight: '90%',
  overflow: 'auto',
};

const modalTitleStyles = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#1f2937',
  margin: '0 0 16px 0',
  textAlign: 'center',
};

const shareImageStyles = {
  width: '100%',
  maxWidth: '400px',
  borderRadius: '12px',
};

const modalActionsStyles = {
  display: 'flex',
  gap: '10px',
  marginTop: '16px',
  justifyContent: 'center',
};

const downloadButtonStyles = {
  padding: '12px 20px',
  background: 'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
};

const closeModalButtonStyles = {
  padding: '12px 20px',
  backgroundColor: '#f3f4f6',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
};
