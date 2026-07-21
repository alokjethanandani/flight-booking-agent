export function formatMoney(amount: number, currency = 'USD'): string {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 })
    + (currency === 'USD' ? '' : ` ${currency}`)
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return 'duration unknown'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatStops(stops: number): string {
  return stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`
}
