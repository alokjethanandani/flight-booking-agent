import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold">FlightGenie — Phase 4 scaffold</h1>
        <p className="text-muted-foreground">Vite + React + Tailwind + shadcn wired. UI comes next.</p>
        <Button>shadcn button smoke test</Button>
      </div>
    </main>
  )
}

export default App
