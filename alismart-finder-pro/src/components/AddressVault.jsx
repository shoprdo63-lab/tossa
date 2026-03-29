import { useState, useEffect, useCallback } from 'react'
import { secureStorage } from '../utils/crypto.js'
import './AddressVault.css'

/**
 * AddressVault Component
 * Securely stores and manages user address information
 * Data is encrypted and stored locally only - no external servers
 */
function AddressVault() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  
  const [addressData, setAddressData] = useState({
    fullName: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Israel',
    taxId: '', // Israeli ID number for customs
    notes: ''
  })

  // Load saved address on mount
  useEffect(() => {
    loadSavedAddress()
  }, [])

  const loadSavedAddress = async () => {
    try {
      const saved = await secureStorage.get('alismart_address_vault')
      if (saved) {
        setAddressData(prev => ({ ...prev, ...saved }))
      }
    } catch (error) {
      console.error('[AliSmart AddressVault] Failed to load:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = useCallback((field, value) => {
    setAddressData(prev => ({ ...prev, [field]: value }))
    setSaveStatus(null) // Reset save status on change
  }, [])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Validate required fields
      if (!addressData.fullName || !addressData.phone || !addressData.addressLine1 || !addressData.city) {
        setSaveStatus({ type: 'error', message: 'Please fill in all required fields' })
        return
      }

      // Validate Israeli zip code format (7 digits)
      if (addressData.zipCode && !/^\d{7}$/.test(addressData.zipCode.replace(/\D/g, ''))) {
        setSaveStatus({ type: 'error', message: 'Zip code should be 7 digits for Israel' })
        return
      }

      // Validate Israeli ID number (9 digits)
      if (addressData.taxId && !/^\d{9}$/.test(addressData.taxId.replace(/\D/g, ''))) {
        setSaveStatus({ type: 'warning', message: 'Tax ID should be 9 digits for Israeli customs' })
      }

      await secureStorage.set('alismart_address_vault', addressData)
      setSaveStatus({ type: 'success', message: 'Address saved securely 🔒' })
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (error) {
      console.error('[AliSmart AddressVault] Save failed:', error)
      setSaveStatus({ type: 'error', message: 'Failed to save address' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear all address data?')) {
      await secureStorage.remove('alismart_address_vault')
      setAddressData({
        fullName: '',
        phone: '',
        email: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'Israel',
        taxId: '',
        notes: ''
      })
      setSaveStatus({ type: 'info', message: 'Address data cleared' })
    }
  }

  const formatPhoneNumber = (value) => {
    // Remove non-numeric characters
    const cleaned = value.replace(/\D/g, '')
    // Format as Israeli phone number
    if (cleaned.length <= 3) return cleaned
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
  }

  const formatZipCode = (value) => {
    return value.replace(/\D/g, '').slice(0, 7)
  }

  const formatTaxId = (value) => {
    return value.replace(/\D/g, '').slice(0, 9)
  }

  if (isLoading && !addressData.fullName) {
    return (
      <div className="address-vault-loading">
        <div className="vault-spinner"></div>
        <span>Loading secure vault...</span>
      </div>
    )
  }

  return (
    <div className="address-vault">
      {/* Header with lock icon */}
      <div 
        className="vault-header"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
      >
        <div className="vault-title">
          <svg className="vault-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Address Vault</span>
          {addressData.fullName && <span className="vault-saved-badge">●</span>}
        </div>
        <svg 
          className={`vault-chevron ${isExpanded ? 'expanded' : ''}`} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {/* Expandable Form */}
      {isExpanded && (
        <div className="vault-content">
          {/* Privacy Notice */}
          <div className="vault-privacy-notice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Your data is encrypted and stored locally only</span>
          </div>

          {/* Form Fields */}
          <div className="vault-form">
            {/* Full Name */}
            <div className="vault-field">
              <label>
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                value={addressData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="e.g., John Doe"
                className="vault-input"
              />
            </div>

            {/* Phone */}
            <div className="vault-field">
              <label>
                Phone <span className="required">*</span>
              </label>
              <input
                type="tel"
                value={addressData.phone}
                onChange={(e) => handleInputChange('phone', formatPhoneNumber(e.target.value))}
                placeholder="e.g., 050-123-4567"
                className="vault-input"
              />
            </div>

            {/* Email */}
            <div className="vault-field">
              <label>Email</label>
              <input
                type="email"
                value={addressData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="e.g., john@example.com"
                className="vault-input"
              />
            </div>

            {/* Address Line 1 */}
            <div className="vault-field">
              <label>
                Street Address <span className="required">*</span>
              </label>
              <input
                type="text"
                value={addressData.addressLine1}
                onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                placeholder="e.g., 123 Dizengoff Street"
                className="vault-input"
              />
            </div>

            {/* Address Line 2 */}
            <div className="vault-field">
              <label>Apartment, Suite, Building (Optional)</label>
              <input
                type="text"
                value={addressData.addressLine2}
                onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                placeholder="e.g., Apt 4B, Building 2"
                className="vault-input"
              />
            </div>

            {/* City & Zip Code */}
            <div className="vault-row">
              <div className="vault-field">
                <label>
                  City <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={addressData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="e.g., Tel Aviv"
                  className="vault-input"
                />
              </div>

              <div className="vault-field">
                <label>Zip Code</label>
                <input
                  type="text"
                  value={addressData.zipCode}
                  onChange={(e) => handleInputChange('zipCode', formatZipCode(e.target.value))}
                  placeholder="7 digits"
                  className="vault-input"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Country */}
            <div className="vault-field">
              <label>Country</label>
              <input
                type="text"
                value={addressData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className="vault-input"
                readOnly
              />
            </div>

            {/* Tax ID / Israeli ID */}
            <div className="vault-field">
              <label className="tax-id-label">
                Israeli ID Number (for customs)
                <button 
                  className="help-btn"
                  onClick={() => setShowHelp(!showHelp)}
                  type="button"
                >
                  ?
                </button>
              </label>
              {showHelp && (
                <div className="help-tooltip">
                  Required by Israeli Customs to release packages. 
                  Enter your 9-digit Israeli ID number (Teudat Zehut).
                </div>
              )}
              <input
                type="text"
                value={addressData.taxId}
                onChange={(e) => handleInputChange('taxId', formatTaxId(e.target.value))}
                placeholder="9 digits"
                className="vault-input"
                maxLength={9}
              />
            </div>

            {/* Delivery Notes */}
            <div className="vault-field">
              <label>Delivery Notes (Optional)</label>
              <textarea
                value={addressData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="e.g., Leave at front door, Ring bell"
                className="vault-textarea"
                rows={2}
              />
            </div>

            {/* Status Message */}
            {saveStatus && (
              <div className={`vault-status ${saveStatus.type}`}>
                {saveStatus.message}
              </div>
            )}

            {/* Action Buttons */}
            <div className="vault-actions">
              <button 
                className="vault-save-btn"
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="btn-spinner"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Save Securely
                  </>
                )}
              </button>

              {addressData.fullName && (
                <button 
                  className="vault-clear-btn"
                  onClick={handleClear}
                  type="button"
                >
                  Clear Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AddressVault
