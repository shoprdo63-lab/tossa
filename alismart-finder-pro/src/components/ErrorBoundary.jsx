import { Component } from 'react'

/**
 * Global Error Boundary for AliSmart Finder React App
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details to console with AliSmart prefix
    console.error('[AliSmart ErrorBoundary] Caught error:', error)
    console.error('[AliSmart ErrorBoundary] Component stack:', errorInfo.componentStack)
    
    this.setState({
      error,
      errorInfo
    })

    // Log additional context for debugging
    console.error('[AliSmart ErrorBoundary] Error occurred at:', new Date().toISOString())
    console.error('[AliSmart ErrorBoundary] User agent:', navigator.userAgent)
    console.error('[AliSmart ErrorBoundary] URL:', window.location.href)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alismart-error-boundary" style={styles.container}>
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.message}>
            AliSmart Finder encountered an unexpected error.
          </p>
          
          {this.state.error && (
            <details style={styles.details}>
              <summary style={styles.summary}>View error details</summary>
              <pre style={styles.pre}>
                {this.state.error.toString()}
                {'\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          
          <div style={styles.buttonGroup}>
            <button onClick={this.handleReload} style={styles.primaryButton}>
              Reload Page
            </button>
            <button onClick={this.handleReset} style={styles.secondaryButton}>
              Try Again
            </button>
          </div>
          
          <p style={styles.footer}>
            If this error persists, please check the browser console for more details.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textAlign: 'center'
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#ff6a00'
  },
  message: {
    fontSize: '16px',
    color: '#b8b8d1',
    marginBottom: '20px',
    maxWidth: '400px'
  },
  details: {
    margin: '20px 0',
    padding: '12px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    maxWidth: '600px',
    width: '100%'
  },
  summary: {
    cursor: 'pointer',
    color: '#ff6a00',
    fontWeight: '500',
    userSelect: 'none'
  },
  pre: {
    textAlign: 'left',
    fontSize: '12px',
    color: '#ff6a00',
    overflow: 'auto',
    maxHeight: '200px',
    marginTop: '12px',
    padding: '8px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '4px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px'
  },
  primaryButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #ff6a00, #ee0979)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  secondaryButton: {
    padding: '12px 24px',
    background: 'transparent',
    color: '#b8b8d1',
    border: '1px solid #b8b8d1',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  footer: {
    marginTop: '24px',
    fontSize: '12px',
    color: '#666'
  }
}

export default ErrorBoundary
