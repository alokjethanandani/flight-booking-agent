import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { HomeScreen } from '@/components/home/HomeScreen'
import { ChatFeed } from '@/components/chat/ChatFeed'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { useAgentRun } from '@/hooks/useAgentRun'

function App() {
  const {
    screen, mode, constraints, feed, runId, modeAppliesNextRun,
    startNewRun, decide, changeMode, setConstraints, newSearch, retry, cancelBooking,
  } = useAgentRun()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const lastOffers = useMemo(() => {
    for (let i = feed.length - 1; i >= 0; i -= 1) {
      const item = feed[i]
      if (item.kind === 'offers') return item.offers
    }
    return null
  }, [feed])

  return (
    <div className="mx-auto flex h-svh w-full max-w-2xl flex-col bg-background text-foreground">
      <Header
        onNewSearch={newSearch}
        settingsSlot={
          <SettingsPanel
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            mode={mode}
            onModeChange={changeMode}
            modeAppliesNextRun={modeAppliesNextRun}
            constraints={constraints}
            onConstraintsChange={setConstraints}
            lastOffers={lastOffers}
          />
        }
      />
      <main className="flex min-h-0 flex-1 flex-col">
        {screen === 'home' ? (
          <HomeScreen
            constraints={constraints}
            onSubmit={(q) => void startNewRun(q)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : (
          <ChatFeed
            feed={feed}
            onDecide={(escalationId, answer) => {
              if (runId) void decide(runId, escalationId, answer)
            }}
            onCancelBooking={cancelBooking}
            onRelax={() => setSettingsOpen(true)}
            onRetry={retry}
          />
        )}
      </main>
    </div>
  )
}

export default App
