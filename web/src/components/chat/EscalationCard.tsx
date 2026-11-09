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
  const [showAlternates, setShowAlternates] = useState(false)
  const [freeTextReply, setFreeTextReply] = useState('')
  const recommended = payload.offers.find((o) => o.offerId === payload.requestedOfferId)
  const alternates = payload.offers.filter((o) => o.offerId !== payload.requestedOfferId)
  const recommendOption = payload.options.find((o) => o.value === 'y')
  const declineOption = payload.options.find((o) => o.value === 'n')

  const title = payload.isFreeText
    ? 'FlightGenie has a question'
    : payload.mode === 'automated'
      ? 'This option is over budget. Your approval is required.'
      : 'Approve this simulated booking'

  const detail = payload.isFreeText
    ? payload.prompt
    : recommended
      ? `${recommended.airlineName}: $${formatMoney(recommended.priceAmount, recommended.priceCurrency)}. ${recommended.budgetDetail}.`
      : undefined

  const resolvedLabel = resolvedAnswer != null
    ? payload.options.find((o) => o.value === resolvedAnswer)?.label ?? resolvedAnswer
    : null

  const answered = resolvedAnswer != null

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border-2 border-warning bg-card p-3.5 text-foreground"
    >
      <div className="flex items-start gap-2.5">
        <CirclePause className="mt-0.5 size-4.5 flex-shrink-0 text-warning" />
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold">{title}</div>
          {detail && <div className="text-sm leading-normal text-muted-foreground">{detail}</div>}
        </div>
      </div>

      {!payload.isFreeText && recommended && <FlightResultCard offer={recommended} preferred />}

      {!payload.isFreeText && !answered && recommendOption && declineOption && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onAnswer(recommendOption.value)}>Approve booking</Button>
          <Button size="sm" variant="ghost" onClick={() => onAnswer(declineOption.value)}>Decline</Button>
        </div>
      )}

      {!payload.isFreeText && alternates.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAlternates((v) => !v)}
          className="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground"
        >
          {showAlternates ? 'Hide' : `See ${alternates.length} other option${alternates.length > 1 ? 's' : ''}`}
          {showAlternates ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      )}
      {showAlternates && (
        <div className="flex flex-col gap-2.5">
          {alternates.map((offer) => {
            const opt = payload.options.find((o) => o.value === String(offer.number))
            return (
              <FlightResultCard
                key={offer.offerId}
                offer={offer}
                preferred={false}
                selectLabel="Approve booking"
                onSelect={!answered && opt ? () => onAnswer(opt.value) : undefined}
              />
            )
          })}
        </div>
      )}

      {!payload.isFreeText && (
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className="flex items-center gap-1 self-start text-xs text-muted-foreground"
        >
          View approval details
          {showPrompt ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      )}
      {showPrompt && !payload.isFreeText && (
        <pre className="max-h-48 overflow-auto rounded-md bg-background/50 p-2 text-[11px] whitespace-pre-wrap text-foreground">
          {payload.prompt}
        </pre>
      )}

      {resolvedLabel ? (
        <div className="text-xs font-medium text-muted-foreground">You answered: {resolvedLabel}</div>
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
      ) : null /* Book / Decline are the inline action row above */}
    </div>
  )
}
