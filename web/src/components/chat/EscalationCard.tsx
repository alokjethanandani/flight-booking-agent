import { useState } from 'react'
import { CirclePause, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EscalationPayload } from '@/lib/api'
import { FlightResultCard } from './FlightResultCard'
import { formatMoney } from '@/lib/format'

export function EscalationCard({
  payload,
  resolvedAnswer,
  onAnswer,
}: {
  payload: EscalationPayload
  resolvedAnswer?: string
  onAnswer: (answer: string) => void
}) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [freeTextReply, setFreeTextReply] = useState('')
  const recommended = payload.offers.find((o) => o.offerId === payload.requestedOfferId)

  const title = payload.isFreeText
    ? 'FlightGenie has a question'
    : payload.mode === 'automated'
      ? 'I paused because this breaks your rule: budget'
      : 'Your approval is needed before booking'

  const detail = payload.isFreeText
    ? payload.prompt
    : recommended
      ? `${recommended.airlineName} — $${formatMoney(recommended.priceAmount, recommended.priceCurrency)}. ${recommended.budgetDetail}.`
      : undefined

  const resolvedLabel = resolvedAnswer != null
    ? payload.options.find((o) => o.value === resolvedAnswer)?.label ?? resolvedAnswer
    : null

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-warning-muted-foreground/25 bg-warning-muted p-3.5 text-warning-muted-foreground"
    >
      <div className="flex items-start gap-2.5">
        <CirclePause className="mt-0.5 size-4.5 flex-shrink-0" />
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold">{title}</div>
          {detail && <div className="text-sm leading-normal">{detail}</div>}
        </div>
      </div>

      {!payload.isFreeText && payload.mode === 'hitl' && payload.offers.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {payload.offers.map((offer) => {
            const opt = payload.options.find(
              (o) => (offer.offerId === payload.requestedOfferId && o.value === 'y') || o.value === String(offer.number),
            )
            return (
              <FlightResultCard
                key={offer.offerId}
                offer={offer}
                preferred={offer.offerId === payload.requestedOfferId}
                selectLabel={opt?.label ?? 'Choose this'}
                onSelect={resolvedAnswer == null ? () => onAnswer(opt?.value ?? String(offer.number)) : undefined}
              />
            )
          })}
        </div>
      )}

      {!payload.isFreeText && (
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className="flex items-center gap-1 self-start text-xs opacity-70"
        >
          View exact message
          {showPrompt ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      )}
      {showPrompt && !payload.isFreeText && (
        <pre className="max-h-48 overflow-auto rounded-md bg-background/50 p-2 text-[11px] whitespace-pre-wrap text-foreground">
          {payload.prompt}
        </pre>
      )}

      {resolvedLabel ? (
        <div className="text-xs font-medium opacity-80">You answered: {resolvedLabel}</div>
      ) : payload.isFreeText ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={freeTextReply}
            onChange={(e) => setFreeTextReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && freeTextReply.trim()) onAnswer(freeTextReply.trim())
            }}
            placeholder="Type your reply…"
            className="bg-background"
          />
          <Button
            size="icon"
            disabled={!freeTextReply.trim()}
            onClick={() => onAnswer(freeTextReply.trim())}
          >
            <Send className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {payload.options
            .filter((o) => payload.mode === 'automated' || o.value === 'y' || o.value === 'n')
            .map((o) => (
              <Button
                key={o.value}
                size="sm"
                variant={o.value === 'y' ? 'default' : o.value === 'n' ? 'ghost' : 'outline'}
                onClick={() => onAnswer(o.value)}
              >
                {o.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}
