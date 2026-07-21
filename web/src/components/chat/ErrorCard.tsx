import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-alert-muted-foreground/25 bg-alert-muted p-3.5 text-alert-muted-foreground">
      <div className="flex items-start gap-2.5">
        <WifiOff className="mt-0.5 size-4.5 flex-shrink-0" />
        <div className="text-sm leading-normal">{message}</div>
      </div>
      <div>
        <Button size="sm" variant="outline" onClick={onRetry}>Retry search</Button>
      </div>
    </div>
  )
}
