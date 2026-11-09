import { useState } from 'react'
import { MapPin, Search, Users, Repeat, GitCommitHorizontal, Plane, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hasAirlinePreference } from '@/hooks/useAgentRun'
import type { ConstraintsState } from '@/hooks/useAgentRun'

const EXAMPLES = [
  'AUS → JFK next Saturday, nonstop, roundtrip, under $650',
  'AUS → SFO next weekend, 1 stop max, under $500',
  'AUS → DEN, nonstop, roundtrip, flexible on price',
]

export function HomeScreen({
  constraints,
  onSubmit,
  onOpenSettings,
}: {
  constraints: ConstraintsState
  onSubmit: (query: string) => void
  onOpenSettings: () => void
}) {
  const [query, setQuery] = useState('')

  const submit = (): void => {
    const q = query.trim()
    if (!q) return
    onSubmit(q)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-2 pt-1">
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-foreground">Where are you flying?</h1>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
          <MapPin className="size-3" /> Flying from Austin (AUS)
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <textarea
          className="min-h-20 w-full resize-none rounded-md border border-input bg-background px-3.5 py-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          placeholder="e.g. AUS → SFO next weekend, nonstop, under $600"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <Button onClick={submit}>
          <Search className="size-3.5" /> Search flights
        </Button>
      </div>

      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-secondary p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Current settings</div>
          <Button variant="outline" size="sm" onClick={onOpenSettings}>
            <SlidersHorizontal className="size-3" /> Edit
          </Button>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2.5 text-foreground">
            <Users className="size-3.5 text-muted-foreground" />
            {constraints.passengers} {constraints.passengers === 1 ? 'adult' : 'adults'}
          </div>
          <div className="flex items-center gap-2.5 text-foreground">
            <Repeat className="size-3.5 text-muted-foreground" /> Round trip
          </div>
          <div className="flex items-center gap-2.5 text-foreground">
            <GitCommitHorizontal className="size-3.5 text-muted-foreground" />
            {constraints.maxStops === 0 ? 'Nonstop' : `${constraints.maxStops} stop(s) max`}
          </div>
          <div className="flex items-center gap-2.5 text-foreground">
            <Plane className="size-3.5 text-muted-foreground" />
            {!hasAirlinePreference(constraints) ? (
              <>Any airline <span className="text-muted-foreground">(no preference)</span></>
            ) : constraints.airlineHard ? (
              <>{constraints.preferredAirline} only <span className="text-muted-foreground">(filter)</span></>
            ) : (
              <>{constraints.preferredAirline} preferred <span className="text-muted-foreground">(preference)</span></>
            )}
          </div>
        </div>
      </div>

      <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Try one of these</div>
      <div className="flex flex-col gap-2.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setQuery(ex)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left text-sm text-foreground"
          >
            <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand-muted-foreground">
              <Plane className="size-4" />
            </span>
            <span className="min-w-0 flex-1">{ex}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
