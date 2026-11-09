import { useEffect, useRef } from 'react'
import type { FeedItem } from '@/hooks/useAgentRun'
import type { OversightDecision } from '@/lib/api'
import { UserBubble, AgentBubble, Note } from './MessageBubble'
import { PlanPreviewCard } from './PlanPreviewCard'
import { ThinkingSteps } from './ThinkingSteps'
import { ResultsSection } from './ResultsSection'
import { EscalationCard } from './EscalationCard'
import { ConfirmationCard } from './ConfirmationCard'
import { ErrorCard } from './ErrorCard'
import { TypingIndicator } from './TypingIndicator'

// Kinds that already carry their own "in progress" or "waiting on you"
// visual (a spinner, or a pending human decision) — the generic typing
// indicator would be redundant or misleading appended after these.
const SELF_ANIMATING_OR_WAITING = new Set<FeedItem['kind']>([
  'thinking', 'escalation', 'confirmation', 'error',
])

/**
 * Agent-voice presentation of a gate decision for the chat feed. The verbatim
 * `reason` stays in the OversightDecision (the authoritative trace, from the
 * read-only oversight.ts); this is just the friendlier user-facing line.
 */
function friendlyDecision(d: OversightDecision): string {
  const reselected = d.finalOfferId != null && d.finalOfferId !== d.requestedOfferId
  switch (d.action) {
    case 'hitl-approved':
      return reselected
        ? 'You selected another flight.'
        : 'You approved the recommended flight.'
    case 'hitl-declined':
      return 'You declined. No booking was made.'
    case 'escalated-approved':
      return 'You approved booking over budget.'
    case 'escalated-declined':
      return 'You declined the over-budget option. No booking was made.'
    case 'auto-book':
      return 'This offer meets your configured rules. Automatic booking can proceed.'
    case 'blocked-rejected':
      return "This offer failed a required check. Booking is blocked."
    case 'blocked-unknown':
      return "This offer is missing from the ranked results. Booking is blocked."
    default:
      return d.reason
  }
}

export function ChatFeed({
  feed,
  running,
  onDecide,
  onCancelBooking,
  onRelax,
  onRetry,
}: {
  feed: FeedItem[]
  running: boolean
  onDecide: (escalationId: number, answer: string) => void
  onCancelBooking: (id: number) => void
  onRelax: () => void
  onRetry: () => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastKind = feed[feed.length - 1]?.kind
  const showTyping = running && (lastKind == null || !SELF_ANIMATING_OR_WAITING.has(lastKind))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [feed, showTyping])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6">
      {feed.map((item) => {
        switch (item.kind) {
          case 'user':
            return <UserBubble key={item.id} text={item.text} />
          case 'assistant':
            return <AgentBubble key={item.id} text={item.text} />
          case 'note':
            return <Note key={item.id} text={item.text} />
          case 'plan':
            return <PlanPreviewCard key={item.id} mode={item.mode} message={item.message} />
          case 'thinking':
            return <ThinkingSteps key={item.id} steps={item.steps} />
          case 'offers':
            return (
              <ResultsSection
                key={item.id}
                offers={item.offers}
                constraintSummary={item.constraintSummary}
                onRelax={onRelax}
                onRetry={onRetry}
                running={running}
              />
            )
          case 'escalation':
            return (
              <EscalationCard
                key={item.id}
                payload={item.payload}
                resolvedAnswer={item.resolvedAnswer}
                onAnswer={(answer) => onDecide(item.id, answer)}
              />
            )
          case 'decision':
            return (
              <div
                key={item.id}
                className="self-start text-xs text-muted-foreground"
              >
                {item.decision.outcome === 'allow' ? '✓' : '·'} {friendlyDecision(item.decision)}
              </div>
            )
          case 'confirmation':
            return (
              <ConfirmationCard
                key={item.id}
                result={item.result}
                cancelled={item.cancelled}
                onCancel={() => onCancelBooking(item.id)}
              />
            )
          case 'error':
            return <ErrorCard key={item.id} message={item.message} onRetry={onRetry} />
          default:
            return null
        }
      })}
      {feed.length === 0 && !running && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Enter a route and dates to search for flights.
        </div>
      )}
      {showTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}
