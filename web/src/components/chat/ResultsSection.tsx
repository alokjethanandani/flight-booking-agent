import { SearchX, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { OffersPayload } from '@/lib/api'
import { FlightResultCard } from './FlightResultCard'

export function ResultsSection({
  offers,
  onRelax,
}: {
  offers: OffersPayload
  onRelax: () => void
}) {
  const [showRejected, setShowRejected] = useState(false)
  const bookable = [...offers.eligible, ...offers.tolerance]

  if (bookable.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-start gap-2.5">
          <SearchX className="mt-0.5 size-4.5 flex-shrink-0 text-muted-foreground" />
          <div className="text-sm leading-normal text-foreground">
            <b>No offers meet your rules right now.</b>{' '}
            {offers.rejected[0]?.reasons[0] ?? 'Every option was filtered out.'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRelax}>Relax a rule</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Ranked by fit · {bookable.length} of {bookable.length + offers.rejected.length}
      </div>
      {bookable.map((offer, i) => (
        <FlightResultCard key={offer.offerId} offer={offer} preferred={i === 0} />
      ))}
      {offers.rejected.length > 0 && (
        <button
          type="button"
          onClick={() => setShowRejected((v) => !v)}
          className="flex items-center gap-1 self-start text-xs text-muted-foreground"
        >
          {offers.rejected.length} rejected offer{offers.rejected.length > 1 ? 's' : ''}
          {showRejected ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      )}
      {showRejected && (
        <div className="flex flex-col gap-3">
          {offers.rejected.map((offer) => (
            <FlightResultCard key={offer.offerId} offer={offer} preferred={false} />
          ))}
        </div>
      )}
    </div>
  )
}
