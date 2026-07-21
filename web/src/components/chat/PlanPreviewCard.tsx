import { Zap, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Mode } from '@/lib/api'

export function PlanPreviewCard({ mode, message }: { mode: Mode; message: string }) {
  const Icon = mode === 'automated' ? Zap : UserCheck
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Before I act</div>
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Icon className="size-2.5" />
          {mode === 'automated' ? 'Autobook for exact match' : 'Manual review'}
        </Badge>
      </div>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 flex-shrink-0 text-foreground" />
        <div className="text-sm leading-normal text-foreground">{message}</div>
      </div>
    </div>
  )
}
