export function ResultsPanel() {
  return (
    <section
      aria-label="Results"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-border p-4 sm:p-6 lg:border-t-0 lg:border-l"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground">
        <p>No search yet — results and the oversight trace will appear here.</p>
      </div>
    </section>
  )
}
