import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './VisualSettings.css'

/**
 * VisualSettings Component
 * Display mode configuration for floating buttons
 * Premium Spotify-style UX with brand associations
 */
function VisualSettings() {
  const { t } = useTranslation()
  const [displayMode, setDisplayMode] = useState('on')
  const [buttonPosition, setButtonPosition] = useState('top-right')
  const [savedStatus, setSavedStatus] = useState('')

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get([
        'alismart_display_mode',
        'alismart_button_position'
      ])
      
      if (result.alismart_display_mode) {
        setDisplayMode(result.alismart_display_mode)
      }
      if (result.alismart_button_position) {
        setButtonPosition(result.alismart_button_position)
      }
    } catch (error) {
      console.error('[AliSmart VisualSettings] Failed to load:', error)
    }
  }

  const saveSetting = async (key, value) => {
    try {
      await chrome.storage.local.set({ [key]: value })
      
      // Notify content scripts of the change
      chrome.tabs.query({ url: '*://*.aliexpress.com/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'DISPLAY_MODE_CHANGE',
            mode: key === 'alismart_display_mode' ? value : displayMode
          }).catch(() => {})
        })
      })
      
      setSavedStatus('saved')
      setTimeout(() => setSavedStatus(''), 1500)
    } catch (error) {
      console.error('[AliSmart VisualSettings] Save failed:', error)
    }
  }

  const handleModeChange = (mode) => {
    setDisplayMode(mode)
    saveSetting('alismart_display_mode', mode)
  }

  const handlePositionChange = (position) => {
    setButtonPosition(position)
    saveSetting('alismart_button_position', position)
  }

  const CheckmarkIcon = () => (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3"
      className="mode-checkmark"
      style={{
        background: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
        borderRadius: '50%',
        padding: '2px',
        color: '#ffffff'
      }}
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  )

  return (
    <div className="visual-settings">
      <div className="settings-section-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.07-4.93l-4.24 4.24M6.34 6.34L2.1 2.1"></path>
        </svg>
        <h3>{t('settings.buttonDisplay.title')}</h3>
        {savedStatus === 'saved' && (
          <span className="save-indicator">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {t('settings.saved')}
          </span>
        )}
      </div>

      <p className="settings-desc">
        {t('settings.buttonDisplay.description')}
      </p>

      {/* Display Mode Options */}
      <div className="display-mode-options">
        <button
          className={`mode-option ${displayMode === 'on' ? 'active' : ''}`}
          onClick={() => handleModeChange('on')}
        >
          <div className="mode-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
          <div className="mode-content">
            <span className="mode-label">{t('settings.buttonDisplay.alwaysOn')}</span>
            <span className="mode-desc">{t('settings.buttonDisplay.alwaysOnDesc')}</span>
          </div>
          {displayMode === 'on' && <CheckmarkIcon />}
        </button>

        <button
          className={`mode-option ${displayMode === 'hover' ? 'active' : ''}`}
          onClick={() => handleModeChange('hover')}
        >
          <div className="mode-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
          </div>
          <div className="mode-content">
            <span className="mode-label">{t('settings.buttonDisplay.hoverOnly')}</span>
            <span className="mode-desc">{t('settings.buttonDisplay.hoverOnlyDesc')}</span>
          </div>
          {displayMode === 'hover' && <CheckmarkIcon />}
        </button>

        <button
          className={`mode-option ${displayMode === 'off' ? 'active' : ''}`}
          onClick={() => handleModeChange('off')}
        >
          <div className="mode-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </div>
          <div className="mode-content">
            <span className="mode-label">{t('settings.buttonDisplay.hidden')}</span>
            <span className="mode-desc">{t('settings.buttonDisplay.hiddenDesc')}</span>
          </div>
          {displayMode === 'off' && <CheckmarkIcon />}
        </button>
      </div>

      {/* Button Position */}
      <div className="settings-subsection">
        <h4>{t('settings.buttonPosition.title')}</h4>
        <div className="position-options">
          <button
            className={`position-option ${buttonPosition === 'top-right' ? 'active' : ''}`}
            onClick={() => handlePositionChange('top-right')}
            title={t('settings.buttonPosition.topRight')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <rect x="12" y="4" width="8" height="6" rx="1" fill="currentColor" opacity="0.3"/>
              <rect x="12" y="4" width="4" height="3" rx="1" fill="currentColor"/>
            </svg>
          </button>
          <button
            className={`position-option ${buttonPosition === 'top-left' ? 'active' : ''}`}
            onClick={() => handlePositionChange('top-left')}
            title={t('settings.buttonPosition.topLeft')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <rect x="4" y="4" width="8" height="6" rx="1" fill="currentColor" opacity="0.3"/>
              <rect x="8" y="4" width="4" height="3" rx="1" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Preview Card */}
      <div className="preview-section">
        <h4>{t('settings.preview')}</h4>
        <div className={`preview-card ${displayMode === 'hover' ? 'hover-mode' : ''} ${displayMode === 'off' ? 'off-mode' : ''}`}>
          <div className="preview-image">
            <div className="preview-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <path d="M21 15l-5-5L5 21"></path>
              </svg>
            </div>
            
            {/* Preview Button */}
            <div 
              className="preview-button"
              style={{
                top: buttonPosition === 'top-left' ? '8px' : '8px',
                right: buttonPosition === 'top-right' ? '8px' : 'auto',
                left: buttonPosition === 'top-left' ? '8px' : 'auto'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </div>
          </div>
          <div className="preview-info">
            <span className="preview-title">Product Title</span>
            <span className="preview-price">$29.99</span>
          </div>
        </div>
        
        {displayMode === 'hover' && (
          <p className="preview-hint">{t('settings.previewHint')}</p>
        )}
      </div>

      {/* Info Footer */}
      <div className="settings-footer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>{t('settings.changesApply')}</span>
      </div>
    </div>
  )
}

export default VisualSettings
