import { Sparkles } from 'lucide-react'

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand-muted-foreground">
        <Sparkles className="size-3.5" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-3">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  )
}
