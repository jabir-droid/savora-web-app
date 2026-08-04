export const formatCurrency = (number) => {
  const currency = localStorage.getItem('savora_currency') || 'IDR'
  if (currency === 'USD') {
    const usdValue = (number || 0) / 16000
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(usdValue)
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number || 0)
}
