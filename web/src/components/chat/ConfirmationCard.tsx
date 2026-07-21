import { Check, Info, ClockAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BookingResult } from '@/lib/api'
import { formatMoney, formatStops } from '@/lib/format'

export function ConfirmationCard({
  result,
  cancelled,
  onCancel,
}: {
  result: BookingResult
  cancelled?: boolean
  onCancel: () => void
}) {
  if (result.status === 'offer_expired') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary p-3.5 text-sm text-foreground">
        <ClockAlert className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
        <div>That fare expired while we talked — FlightGenie will re-search for a fresh price rather than book a stale one.</div>
      </div>
    )
  }

  const leg = result.itinerary[0]

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-5 text-center">
      <div className="flex flex-col items-center gap-2.5">
        <div className="flex size-12 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground">
          <Check className="size-6" />
        </div>
        <div className="text-lg font-bold text-foreground">
          {cancelled ? 'Booking cancelled' : 'Booking confirmed'}
        </div>
        <Badge variant={cancelled ? 'secondary' : 'success'}>{cancelled ? 'Cancelled' : 'Confirmed · Simulated'}</Badge>
      </div>

      <div className="flex w-full flex-col items-center gap-1 rounded-lg border border-border bg-background p-3.5">
        <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Confirmation number</div>
        <div className="font-mono text-xl font-bold tracking-wide text-foreground">{result.bookingReference}</div>
      </div>

      <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">{result.airline}</div>
          <div className="text-lg font-bold text-foreground">${formatMoney(result.priceAmount, result.priceCurrency)}</div>
        </div>
        {leg && (
          <div className="flex items-center justify-between gap-3 border-t border-b border-border py-3 text-sm text-muted-foreground">
            <span>{leg.from ?? '?'} → {leg.to ?? '?'}</span>
            <span>{formatStops(leg.stops)}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground">{result.passengerCount} passenger(s) · PNR {result.pnr}</div>
      </div>

      <div className="flex w-full items-start gap-2.5 rounded-lg border border-border bg-secondary p-3">
        <Info className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
        <div className="text-left text-xs leading-normal text-muted-foreground">
          <b className="text-foreground">Simulated booking.</b> No ticket was issued and no card was charged — this is a proof-of-concept demo.
        </div>
      </div>

      {!cancelled && (
        <Button variant="outline" className="w-full border-destructive text-destructive" onClick={onCancel}>
          Cancel booking
        </Button>
      )}
    </div>
  )
}
