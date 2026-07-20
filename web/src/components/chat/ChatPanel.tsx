export function ChatPanel() {
  return (
    <section aria-label="Chat" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <p className="text-sm">Tell FlightGenie where you're headed and it'll take it from here.</p>
      </div>
    </section>
  )
}
