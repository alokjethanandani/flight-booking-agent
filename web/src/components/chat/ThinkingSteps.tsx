import { Check, Circle, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ThinkingStep, ThinkingStepLabel } from '@/hooks/useAgentRun'

const STEP_TEXT: Record<ThinkingStepLabel, string> = {
  searching: 'Searching flights',
  ranking: 'Ranking against your rules',
  deciding: 'Deciding',
}

export function ThinkingSteps({ steps }: { steps: ThinkingStep[] }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-3.5">
      {steps.map((step) => (
        <div key={step.label} className="flex items-start gap-2.5 text-sm">
          <span
            className={cn(
              'flex size-5.5 flex-shrink-0 items-center justify-center rounded-full',
              step.status === 'done' && 'bg-success-muted text-success-muted-foreground',
              step.status === 'active' && 'bg-secondary text-foreground',
              step.status === 'pending' && 'border border-border text-muted-foreground',
            )}
          >
            {step.status === 'done' ? (
              <Check className="size-3" />
            ) : step.status === 'active' ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <Circle className="size-3" />
            )}
          </span>
          <div className="font-medium text-foreground">{STEP_TEXT[step.label]}</div>
        </div>
      ))}
    </div>
  )
}
