import { useEffect, useRef } from 'react'
import type { FeedItem } from '@/hooks/useAgentRun'
import { UserBubble, AgentBubble, Note } from './MessageBubble'
import { PlanPreviewCard } from './PlanPreviewCard'
import { ThinkingSteps } from './ThinkingSteps'
import { ResultsSection } from './ResultsSection'
import { EscalationCard } from './EscalationCard'
import { ConfirmationCard } from './ConfirmationCard'
import { ErrorCard } from './ErrorCard'

export function ChatFeed({
  feed,
  onDecide,
  onCancelBooking,
  onRelax,
  onRetry,
}: {
  feed: FeedItem[]
  onDecide: (escalationId: number, answer: string) => void
  onCancelBooking: (id: number) => void
  onRelax: () => void
  onRetry: () => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [feed])

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
            return <ResultsSection key={item.id} offers={item.offers} onRelax={onRelax} />
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
                {item.decision.outcome === 'allow' ? '✓' : '·'} {item.decision.reason}
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
      {feed.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Tell FlightGenie where you're headed and it'll take it from here.
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
