import { useState, useEffect } from 'react'
import AddressVault from './components/AddressVault.jsx'
import AIDealAdvisor from './components/AIDealAdvisor.jsx'
import ComparisonMatrix from './components/ComparisonMatrix.jsx'
import VoucherSniper from './components/VoucherSniper.jsx'
import SellerRadar from './components/SellerRadar.jsx'
import SmartWishlist from './components/SmartWishlist.jsx'
import { secureStorage } from './utils/crypto.js'
import './App.css'

/**
 * AliSmart Finder Pro - Main App
 * Sidebar interface for AliExpress shopping assistant
 */
function App() {
  const [activeTab, setActiveTab] = useState('search')
  const [addressData, setAddressData] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [priceHistory, setPriceHistory] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [matrixLoading, setMatrixLoading] = useState(false)

  // Load saved address on mount
  useEffect(() => {
    loadAddressData()
    loadMockData() // For demo purposes
  }, [])

  const loadAddressData = async () => {
    try {
      const saved = await secureStorage.get('alismart_address_vault')
      if (saved) {
        setAddressData(saved)
      }
    } catch (error) {
      console.error('[AliSmart App] Failed to load address:', error)
    }
  }

  // Mock data for demo
  const loadMockData = () => {
    const mockProduct = {
      productId: 'demo-123',
      title: 'Wireless Bluetooth Earbuds',
      price: '$29.99',
      priceValue: 29.99,
      rating: 4.5,
      orders: 1250,
      imageUrl: 'https://ae01.alicdn.com/kf/Sample.jpg',
      shipping: 'AliExpress Standard Shipping',
      storeId: '12345'
    }
    
    // Generate mock price history
    const history = []
    const basePrice = 35
    for (let i = 30; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const fluctuation = (Math.random() - 0.5) * 10
      const isSale = i % 7 === 0
      const price = isSale ? basePrice * 0.7 : basePrice + fluctuation
      history.push({
        date: date.toISOString(),
        price: Math.max(20, price)
      })
    }
    
    // Mock competitors for comparison matrix
    const mockCompetitors = [
      {
        productId: 'comp-1',
        title: 'Premium Wireless Earbuds Pro',
        price: '$24.99',
        priceValue: 24.99,
        rating: 4.7,
        orders: 3420,
        sellerRating: 4.9,
        feedbackPercent: 97,
        storeAge: 4,
        imageUrl: 'https://ae01.alicdn.com/kf/Comp1.jpg',
        shipping: 'Free shipping',
        shippingCost: 0,
        isChoice: true,
        productUrl: 'https://aliexpress.com/item/1.html'
      },
      {
        productId: 'comp-2',
        title: 'Bluetooth 5.0 Earphones',
        price: '$19.99',
        priceValue: 19.99,
        rating: 4.4,
        orders: 890,
        sellerRating: 4.6,
        feedbackPercent: 94,
        storeAge: 2,
        imageUrl: 'https://ae01.alicdn.com/kf/Comp2.jpg',
        shipping: 'AliExpress Standard',
        shippingCost: 2.99,
        isChoice: false,
        productUrl: 'https://aliexpress.com/item/2.html'
      },
      {
        productId: 'comp-3',
        title: 'Sport Wireless Earbuds',
        price: '$27.50',
        priceValue: 27.50,
        rating: 4.8,
        orders: 2150,
        sellerRating: 4.8,
        feedbackPercent: 96,
        storeAge: 3,
        imageUrl: 'https://ae01.alicdn.com/kf/Comp3.jpg',
        shipping: 'Free shipping',
        shippingCost: 0,
        isChoice: true,
        productUrl: 'https://aliexpress.com/item/3.html'
      },
      {
        productId: 'comp-4',
        title: 'TWS Bluetooth Headphones',
        price: '$32.00',
        priceValue: 32.00,
        rating: 4.3,
        orders: 560,
        sellerRating: 4.5,
        feedbackPercent: 92,
        storeAge: 1,
        imageUrl: 'https://ae01.alicdn.com/kf/Comp4.jpg',
        shipping: 'Standard shipping',
        shippingCost: 3.50,
        isChoice: false,
        productUrl: 'https://aliexpress.com/item/4.html'
      },
      {
        productId: 'comp-5',
        title: 'Mini Wireless Earbuds V5',
        price: '$22.00',
        priceValue: 22.00,
        rating: 4.6,
        orders: 1280,
        sellerRating: 4.7,
        feedbackPercent: 95,
        storeAge: 2,
        imageUrl: 'https://ae01.alicdn.com/kf/Comp5.jpg',
        shipping: 'Free shipping',
        shippingCost: 0,
        isChoice: true,
        productUrl: 'https://aliexpress.com/item/5.html'
      }
    ]
    
    setSelectedProduct(mockProduct)
    setPriceHistory(history)
    setCompetitors(mockCompetitors)
  }

  return (
    <div className="alismart-app">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <span>AliSmart</span>
        </div>
        <div className="app-tabs">
          <button
            className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search
          </button>
          <button
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            Favorites
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {activeTab === 'search' && (
          <div className="search-section">
            <h2>Product Search</h2>
            <p className="section-desc">Search for products or click the AliSmart button on any product card</p>
            
            {/* AI Deal Advisor */}
            <AIDealAdvisor
              productData={selectedProduct}
              priceHistory={priceHistory}
              sellerData={{ rating: 4.8, yearsActive: 3 }}
              shippingCost={5.99}
            />
            
            {/* Voucher Sniper */}
            <VoucherSniper
              storeId={selectedProduct?.storeId}
              productId={selectedProduct?.productId}
              cartTotal={29.99}
            />
            
            {/* Seller Radar */}
            <SellerRadar
              sellerData={{
                storeId: '12345',
                storeAge: 3,
                yearsActive: 3,
                orders: 12500,
                sales: 12500,
                rating: 4.8,
                storeRating: 4.8,
                feedbackPercent: 97,
                positiveFeedback: 97,
                responseRate: 0.92
              }}
              historicalData={{
                priceHistory: priceHistory,
                reviews: [
                  { date: new Date(Date.now() - 86400000 * 2).toISOString(), rating: 5, content: 'Great product' },
                  { date: new Date(Date.now() - 86400000 * 5).toISOString(), rating: 5, content: 'Fast shipping' },
                  { date: new Date(Date.now() - 86400000 * 10).toISOString(), rating: 4, content: 'Good quality' }
                ],
                categoryAvg: {
                  shippingDays: 15,
                  responseRate: 0.85,
                  avgPrice: 25
                }
              }}
            />
            
            {/* Competitive Matrix */}
            <ComparisonMatrix
              sourceProduct={selectedProduct}
              competitors={competitors}
              isLoading={matrixLoading}
            />
            
            <div className="search-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <p>Browse AliExpress and click the AliSmart button on products</p>
            </div>
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="favorites-section">
            <h2>My Wishlist</h2>
            <p className="section-desc">Your saved items with price tracking</p>
            <SmartWishlist />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-section">
            <h2>Settings</h2>
            <AddressVault />
            <div className="settings-group">
              <h3>Preferences</h3>
              <div className="setting-item">
                <label>
                  <span>Dark Mode</span>
                  <span className="setting-desc">Enable dark theme</span>
                </label>
                <input type="checkbox" checked readOnly />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span>AliSmart Finder Pro v2.0</span>
        {addressData && (
          <span className="address-indicator" title="Address saved">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Address Ready
          </span>
        )}
      </footer>
    </div>
  )
}

export default App
