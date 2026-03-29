import { useState, useEffect, useMemo } from 'react'
import { analyzeSellerIntegrity, validateTrackingNumber, detectFakeReviews } from '../utils/risk-engine.js'
import './SellerRadar.css'

/**
 * SellerRadar Component
 * Elite seller risk assessment with reliability meter
 * Displays fraud detection, price manipulation, and trust indicators
 */
function SellerRadar({ sellerData, historicalData, onRiskDetected }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')

  // Run analysis when data changes
  useEffect(() => {
    if (sellerData) {
      analyzeSeller()
    }
  }, [sellerData, historicalData])

  const analyzeSeller = async () => {
    setIsAnalyzing(true)
    
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const result = analyzeSellerIntegrity(sellerData, historicalData)
    setAnalysis(result)
    
    if (result.riskScore > 40 && onRiskDetected) {
      onRiskDetected(result)
    }
    
    setIsAnalyzing(false)
  }

  // Get gauge color based on trust score
  const getGaugeColor = (score) => {
    if (score >= 80) return '#00d084' // Green
    if (score >= 60) return '#f59e0b' // Yellow
    if (score >= 40) return '#ff8c42' // Orange
    return '#ff4757' // Red
  }

  // Get gauge gradient
  const getGaugeGradient = (score) => {
    const color = getGaugeColor(score)
    return `conic-gradient(from 180deg, ${color} ${score * 1.8}deg, rgba(255,255,255,0.1) 0)`
  }

  // Loading state
  if (isAnalyzing) {
    return (
      <div className="seller-radar loading">
        <div className="radar-scanning">
          <div className="radar-screen">
            <div className="radar-grid"></div>
            <div className="radar-sweep-line"></div>
            <div className="radar-blip"></div>
          </div>
          <p className="scanning-text">Scanning Seller Profile...</p>
          <p className="scanning-sub">Analyzing 3 years of transaction data</p>
        </div>
      </div>
    )
  }

  // No data state
  if (!analysis) {
    return (
      <div className="seller-radar empty">
        <div className="radar-empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <h3>Elite Seller Radar</h3>
          <p>View an AliExpress product to analyze seller integrity and detect risks</p>
        </div>
      </div>
    )
  }

  const { trustScore, riskScore, statusBadge, riskFactors, warnings, positives, metrics, categoryComparison, recommendation } = analysis
  const gaugeColor = getGaugeColor(trustScore)

  return (
    <div className={`seller-radar ${statusBadge.type}`}>
      {/* Header */}
      <div className="radar-header">
        <h3 className="radar-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Elite Seller Radar
          <span 
            className="status-badge"
            style={{ backgroundColor: `${statusBadge.color}20`, color: statusBadge.color, borderColor: statusBadge.color }}
          >
            {statusBadge.label}
          </span>
        </h3>
      </div>

      {/* Trust Score Gauge */}
      <div className="trust-gauge-section">
        <div className="gauge-container">
          <div 
            className="gauge-arc"
            style={{ background: getGaugeGradient(trustScore) }}
          >
            <div className="gauge-inner">
              <span className="gauge-score" style={{ color: gaugeColor }}>
                {trustScore}
              </span>
              <span className="gauge-label">Trust Score</span>
            </div>
          </div>
        </div>
        
        <div className="gauge-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#00d084' }}></span>
            <span>80-100 Elite</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }}></span>
            <span>60-79 Good</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#ff8c42' }}></span>
            <span>40-59 Caution</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#ff4757' }}></span>
            <span>0-39 Risk</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="seller-quick-stats">
        <div className="stat-item">
          <span className="stat-value">{metrics.storeAgeWeeks}</span>
          <span className="stat-label">Weeks Active</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{metrics.totalSales.toLocaleString()}</span>
          <span className="stat-label">Total Sales</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{metrics.feedbackPercent}%</span>
          <span className="stat-label">Positive</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{metrics.rating.toFixed(1)}</span>
          <span className="stat-label">Rating</span>
        </div>
      </div>

      {/* Risk Alerts */}
      {riskFactors.length > 0 && (
        <div className="risk-alerts">
          <h4 className="alerts-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Risk Alerts ({riskFactors.length})
          </h4>
          
          {riskFactors.map((risk, idx) => (
            <div 
              key={idx} 
              className={`risk-alert ${risk.severity}`}
              style={{ 
                borderLeftColor: risk.severity === 'high' ? '#ff4757' : '#f59e0b',
                backgroundColor: risk.severity === 'high' ? 'rgba(255, 71, 87, 0.1)' : 'rgba(245, 158, 11, 0.1)'
              }}
            >
              <div className="alert-header">
                <span className="alert-title">{risk.title}</span>
                <span className="alert-score">+{risk.score} risk</span>
              </div>
              <p className="alert-description">{risk.description}</p>
              {risk.details && (
                <div className="alert-details">
                  {risk.details.percentChange && (
                    <span>Price change: {risk.details.percentChange.toFixed(0)}%</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Category Comparison */}
      {categoryComparison.length > 0 && (
        <div className="category-comparison">
          <h4 className="comparison-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6"></path>
            </svg>
            vs. Category Average
          </h4>
          
          {categoryComparison.map((comp, idx) => (
            <div key={idx} className={`comparison-item ${comp.status}`}>
              <div className="comparison-label">{comp.label}</div>
              <div className="comparison-bar">
                <div 
                  className="comparison-fill"
                  style={{ 
                    width: `${Math.min(100, (comp.sellerValue / (comp.avgValue * 1.5)) * 100)}%`,
                    backgroundColor: comp.status === 'faster' || comp.status === 'lower' ? '#00d084' : '#ff4757'
                  }}
                ></div>
              </div>
              <div className="comparison-text">{comp.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Positive Indicators */}
      {positives.length > 0 && (
        <div className="positive-indicators">
          <h4 className="positives-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Trust Indicators
          </h4>
          
          <div className="positives-list">
            {positives.map((pos, idx) => (
              <div key={idx} className="positive-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d084" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <div className="positive-content">
                  <span className="positive-title">{pos.title}</span>
                  <span className="positive-desc">{pos.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="warnings-section">
          <h4 className="warnings-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Notes
          </h4>
          
          {warnings.map((warn, idx) => (
            <div key={idx} className="warning-item">
              <span className="warning-title">{warn.title}:</span>
              <span className="warning-desc">{warn.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation */}
      <div 
        className="recommendation-box"
        style={{ 
          borderColor: gaugeColor,
          backgroundColor: `${gaugeColor}10`
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={gaugeColor} strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <p style={{ color: gaugeColor }}>{recommendation}</p>
      </div>

      {/* Footer */}
      <div className="radar-footer">
        <p>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Analysis based on {metrics.totalSales.toLocaleString()} transactions
        </p>
      </div>
    </div>
  )
}

export default SellerRadar
