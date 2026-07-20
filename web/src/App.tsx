import { Header } from '@/components/layout/Header'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { ResultsPanel } from '@/components/results/ResultsPanel'

function App() {
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col lg:basis-[42%]">
          <ChatPanel />
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:basis-[58%]">
          <ResultsPanel />
        </div>
      </main>
    </div>
  )
}

export default App
