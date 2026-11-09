import { SearchX, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { OffersPayload } from '@/lib/api'
import { FlightResultCard } from './FlightResultCard'

export function ResultsSection({
  offers,
  constraintSummary,
  onRelax,
  onRetry,
  running,
}: {
  offers: OffersPayload
  constraintSummary: string
  onRelax: () => void
  onRetry: () => void
  running: boolean
}) {
  const [showAlternates, setShowAlternates] = useState(false)
  const [showRejected, setShowRejected] = useState(false)
  const bookable = [...offers.eligible, ...offers.tolerance]

  if (bookable.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
        <div className="flex items-start gap-2.5">
          <SearchX className="mt-0.5 size-4.5 flex-shrink-0 text-muted-foreground" />
          <div className="text-sm leading-normal text-foreground">
            <b>No bookable offers found.</b>{' '}
            {offers.searchedCount > 0
              ? `The search returned ${offers.searchedCount} option${offers.searchedCount > 1 ? 's' : ''}, but none passed the required checks.`
              : 'The search returned no offers.'}
            <div className="mt-1 text-xs text-muted-foreground">
              Rules: <span className="font-medium text-foreground">{constraintSummary}</span>. Adjust your rules or request, then search again.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRelax}>Adjust rules</Button>
          <Button size="sm" variant="outline" onClick={onRetry} disabled={running}>
            Search again
          </Button>
        </div>
      </div>
    )
  }

  const [preferred, ...alternates] = bookable

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="mt-0.5 size-3 flex-shrink-0" />
        <span>
          Search returned {offers.searchedCount} offers. Checked against:{' '}
          <span className="font-medium text-foreground">{constraintSummary}</span>.
        </span>
      </div>
      {preferred && <FlightResultCard offer={preferred} preferred />}

      {alternates.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAlternates((v) => !v)}
          className="flex items-center gap-1 self-start text-xs font-medium text-foreground"
        >
          {showAlternates ? 'Hide' : `See ${alternates.length} other option${alternates.length > 1 ? 's' : ''}`}
          {showAlternates ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      )}
      {showAlternates && (
        <div className="flex flex-col gap-3">
          {alternates.map((offer) => (
            <FlightResultCard key={offer.offerId} offer={offer} preferred={false} />
          ))}
        </div>
      )}

      {offers.rejected.length > 0 && (
        <button
          type="button"
          onClick={() => setShowRejected((v) => !v)}
          className="flex items-center gap-1 self-start text-xs text-muted-foreground"
        >
          {showRejected ? 'Hide' : `${offers.rejected.length} rejected offer${offers.rejected.length > 1 ? 's' : ''}`}
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
