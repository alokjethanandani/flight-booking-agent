import { Sparkles } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
        {text}
      </div>
    </div>
  )
}

export function AgentBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand-muted-foreground">
        <Sparkles className="size-3.5" />
      </div>
      <div className="flex max-w-[85%] flex-col gap-2 overflow-x-auto rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm leading-normal text-foreground [&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h2]:mt-1 [&_h2]:text-sm [&_h2]:font-bold [&_h3]:mt-1 [&_h3]:text-sm [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-normal [&_table]:w-full [&_table]:border-collapse [&_td]:border-t [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5">
        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
      </div>
    </div>
  )
}

export function Note({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        'self-center rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {text}
    </div>
  )
}
