import { SlidersHorizontal, ShieldCheck, Wallet, GitCommitHorizontal, Clock, Plane, Users, Armchair, Zap, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Mode, OffersPayload } from '@/lib/api'
import type { ConstraintsState } from '@/hooks/useAgentRun'

const AIRLINES = ['Delta', 'American', 'United', 'Southwest', 'JetBlue', 'Alaska', 'Frontier', 'Spirit']
const CABINS: { value: ConstraintsState['cabin']; label: string }[] = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
]

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn(
        'flex-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function SettingsPanel({
  open,
  onOpenChange,
  mode,
  onModeChange,
  modeAppliesNextRun,
  constraints,
  onConstraintsChange,
  lastOffers,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  onModeChange: (mode: Mode) => void
  modeAppliesNextRun: boolean
  constraints: ConstraintsState
  onConstraintsChange: (patch: Partial<ConstraintsState>) => void
  lastOffers: OffersPayload | null
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <SlidersHorizontal data-icon="inline-start" />
            Settings
          </Button>
        }
      />
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> Your guardrails
          </SheetTitle>
          <SheetDescription>Mode and constraints — the rules FlightGenie books within.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-4">
          {modeAppliesNextRun && (
            <div className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
              A search is already running under the previous mode — this change applies to your next search.
            </div>
          )}

          <div role="radiogroup" aria-label="Agent mode" className="flex flex-col gap-2.5">
            {(
              [
                { value: 'hitl' as const, icon: UserCheck, label: 'Manual review', desc: "I'll show you a preferred pick and secondary options — you choose, I book. Nothing books without your tap." },
                { value: 'automated' as const, icon: Zap, label: 'Autobook for exact match', desc: "I'll book the best option automatically if it meets every constraint. If it doesn't, I'll pause and ask you." },
              ]
            ).map((m) => {
              const selected = mode === m.value
              const Icon = m.icon
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onModeChange(m.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                    selected ? 'border-foreground bg-foreground/[0.04]' : 'border-border bg-card',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 size-[1.15rem] flex-shrink-0 rounded-full bg-card',
                      selected ? 'border-[5px] border-primary' : 'border-2 border-border',
                    )}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Icon className="size-3.5" /> {m.label}
                    </span>
                    <span className="text-xs leading-normal text-muted-foreground">{m.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><Wallet className="size-3.5" /> Budget</span>
              <div className="relative">
                <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  placeholder="No max"
                  value={constraints.budget ?? ''}
                  onChange={(e) => onConstraintsChange({ budget: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
                  className="h-9 w-28 pl-6 text-left"
                />
              </div>
            </div>
            {lastOffers && (
              <div className="text-xs text-muted-foreground">
                Last search: {lastOffers.eligible.length} eligible · {lastOffers.tolerance.length} within tolerance · {lastOffers.rejected.length} rejected — recalculated on your next search.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><GitCommitHorizontal className="size-3.5" /> Max stops</div>
            <div className="flex gap-0.5 rounded-full border border-border bg-card p-0.5">
              {[0, 1, 2].map((n) => (
                <SegButton key={n} active={constraints.maxStops === n} onClick={() => onConstraintsChange({ maxStops: n })}>
                  {n === 0 ? 'Nonstop' : `${n} stop${n > 1 ? 's' : ''}`}
                </SegButton>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="size-3.5" /> Max total duration</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={24}
                step={1}
                value={constraints.durHours}
                onChange={(e) => onConstraintsChange({ durHours: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })}
                className="h-9 w-16 text-center"
              />
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plane className="size-3.5" /> Preferred airline
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium">soft</span>
            </div>
            <Select value={constraints.preferredAirline} onValueChange={(v) => onConstraintsChange({ preferredAirline: v as string })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AIRLINES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">A soft preference — never eliminates an offer, only breaks ties.</div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Armchair className="size-3.5" /> Cabin</div>
            <Select value={constraints.cabin} onValueChange={(v) => onConstraintsChange({ cabin: v as ConstraintsState['cabin'] })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CABINS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-3.5" /> Passengers</div>
            <Select
              value={String(constraints.passengers)}
              onValueChange={(v) => onConstraintsChange({ passengers: Number(v) })}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'adult' : 'adults'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="h-11" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
