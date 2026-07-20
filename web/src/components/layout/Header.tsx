import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { useTheme } from '@/lib/theme'

export function Header() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tracking-tight text-foreground">Flight</span>
        <span className="text-lg font-semibold tracking-tight text-brand">Genie</span>
      </div>
      <div className="flex items-center gap-2">
        <SettingsPanel />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  )
}
