import { useState } from 'react'
import { Star, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OfferSummary } from '@/lib/api'
import { formatMoney, formatDuration, formatStops } from '@/lib/format'
import { TIER_META } from './tierMeta'

export function FlightResultCard({
  offer,
  preferred,
  onSelect,
  selectLabel,
}: {
  offer: OfferSummary
  preferred: boolean
  onSelect?: () => void
  selectLabel?: string
}) {
  const [showReasons, setShowReasons] = useState(false)
  const meta = TIER_META[offer.tier]
  const bookable = offer.tier !== 'rejected'

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm',
        preferred ? 'border-2 border-brand bg-brand-muted/20' : 'border-border',
        !bookable && 'opacity-70',
      )}
    >
      {preferred && (
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-brand">
          <Star className="size-3.5" /> PREFERRED PICK
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {offer.airlineName}
            {offer.airlineIataCode ? ` (${offer.airlineIataCode})` : ''}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-xl font-bold text-foreground">${formatMoney(offer.priceAmount, offer.priceCurrency)}</div>
          <div className="text-xs text-muted-foreground">{offer.priceCurrency}, total</div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span>{formatStops(offer.maxStopsAcrossSlices)}</span>
        <span>·</span>
        <span>{formatDuration(offer.totalDurationMinutes)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        {offer.reasons.length > 0 && (
          <button
            type="button"
            onClick={() => setShowReasons((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            Why this rank
            {showReasons ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}
      </div>
      {showReasons && (
        <ul className="flex flex-col gap-1 pl-4 text-xs text-muted-foreground list-disc">
          {offer.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {bookable && onSelect && (
        <div className="pt-1">
          <Button size="sm" onClick={onSelect}>
            {selectLabel ?? (preferred ? 'Book this' : 'Select')}
          </Button>
        </div>
      )}
    </div>
  )
}
