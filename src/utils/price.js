export const CURRENCIES = {
  KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
  ZAR: { symbol: 'R', name: 'South African Rand' },
  NGN: { symbol: '₦', name: 'Nigerian Naira' },
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' }
}

const PRICE_CACHE_KEY = 'btc_prices'
const PRICE_CACHE_DURATION = 5 * 60 * 1000

export const fetchBTCPrices = async () => {
  try {
    const currencies = Object.keys(CURRENCIES).join(',').toLowerCase()
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currencies}`
    )
    
    if (!response.ok) throw new Error('Failed to fetch prices')
    
    const data = await response.json()
    const prices = data.bitcoin
    
    const cached = {
      prices,
      timestamp: Date.now()
    }
    
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cached))
    return prices
    
  } catch (err) {
    console.error('Price fetch error:', err)
    const cached = getCachedPrices()
    return cached ? cached.prices : null
  }
}

export const getCachedPrices = () => {
  try {
    const cached = localStorage.getItem(PRICE_CACHE_KEY)
    if (!cached) return null
    
    const parsed = JSON.parse(cached)
    const age = Date.now() - parsed.timestamp
    
    if (age < PRICE_CACHE_DURATION) {
      return parsed
    }
    
    return null
  } catch (err) {
    return null
  }
}

export const getBTCPrice = async (currency = 'kes') => {
  const cached = getCachedPrices()
  if (cached && cached.prices[currency]) {
    return cached.prices[currency]
  }
  
  const prices = await fetchBTCPrices()
  return prices ? prices[currency] : null
}

export const satsToFiat = (sats, btcPrice) => {
  if (!btcPrice || !sats) return 0
  const btc = sats / 100000000
  return btc * btcPrice
}

export const formatFiat = (amount, currency) => {
  const currencyInfo = CURRENCIES[currency.toUpperCase()]
  if (!currencyInfo) return amount.toFixed(2)
  
  const formatted = amount.toFixed(2)
  return `${currencyInfo.symbol} ${formatted}`
}

export const getSelectedCurrency = () => {
  return localStorage.getItem('selected_currency') || 'KES'
}

export const setSelectedCurrency = (currency) => {
  localStorage.setItem('selected_currency', currency.toUpperCase())
}

export const getDisplayMode = () => {
  return localStorage.getItem('display_mode') || 'sats'
}

export const setDisplayMode = (mode) => {
  localStorage.setItem('display_mode', mode)
}
