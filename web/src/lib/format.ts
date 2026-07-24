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

// Flight times are local airport wall-clock times; format from the ISO string's
// own components so we never shift them into the viewer's timezone.
function isoParts(iso: string): { y: string; mo: string; d: string; hh: string; mm: string } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return null
  return { y: m[1], mo: m[2], d: m[3], hh: m[4], mm: m[5] }
}

export function isoDate(iso: string): string {
  const p = isoParts(iso)
  if (!p) return iso
  return new Date(Number(p.y), Number(p.mo) - 1, Number(p.d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function isoTime(iso: string): string {
  const p = isoParts(iso)
  return p ? `${p.hh}:${p.mm}` : ''
}

export function legLabel(leg: { from: string | null; to: string | null; departingAt: string; arrivingAt: string }): string {
  return `${isoDate(leg.departingAt)} · ${leg.from ?? '?'} ${isoTime(leg.departingAt)} → ${leg.to ?? '?'} ${isoTime(leg.arrivingAt)}`
}
