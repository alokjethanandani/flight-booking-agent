import { useCallback, useRef, useState } from 'react'
import {
  startRun,
  submitDecision,
  openRunStream,
  type Mode,
  type Constraints,
  type OffersPayload,
  type EscalationPayload,
  type OversightDecision,
  type BookingResult,
} from '@/lib/api'

let feedIdCounter = 0
const nextId = (): number => (feedIdCounter += 1)

export type ThinkingStepLabel = 'searching' | 'ranking' | 'deciding'
export interface ThinkingStep {
  label: ThinkingStepLabel
  status: 'pending' | 'active' | 'done'
}

const STEP_ORDER: ThinkingStepLabel[] = ['searching', 'ranking', 'deciding']

export type FeedItem =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'assistant'; text: string }
  | { id: number; kind: 'plan'; mode: Mode; message: string }
  | { id: number; kind: 'thinking'; steps: ThinkingStep[]; done: boolean }
  | { id: number; kind: 'offers'; offers: OffersPayload }
  | { id: number; kind: 'escalation'; payload: EscalationPayload; resolvedAnswer?: string }
  | { id: number; kind: 'decision'; decision: OversightDecision }
  | { id: number; kind: 'confirmation'; result: BookingResult; cancelled?: boolean }
  | { id: number; kind: 'error'; message: string }
  | { id: number; kind: 'note'; text: string }

export interface ConstraintsState {
  budget: number | null
  maxStops: number
  durHours: number
  preferredAirline: string
  passengers: number
  cabin: 'economy' | 'premium_economy' | 'business' | 'first'
}

export const DEFAULT_CONSTRAINTS: ConstraintsState = {
  budget: null,
  maxStops: 0,
  durHours: 12,
  preferredAirline: 'Delta',
  passengers: 1,
  cabin: 'economy',
}

const AIRLINE_CODES: Record<string, string> = {
  Delta: 'DL', American: 'AA', United: 'UA', Southwest: 'WN',
  JetBlue: 'B6', Alaska: 'AS', Frontier: 'F9', Spirit: 'NK',
}

function toApiConstraints(c: ConstraintsState): Constraints {
  return {
    maxPrice: c.budget ?? undefined,
    currency: c.budget != null ? 'USD' : undefined,
    maxStops: c.maxStops,
    maxTotalDurationMinutes: c.durHours * 60,
    preferredAirlines: c.preferredAirline ? [AIRLINE_CODES[c.preferredAirline] ?? c.preferredAirline] : undefined,
  }
}

function buildTripRequest(query: string, c: ConstraintsState): string {
  const pax = `${c.passengers} ${c.passengers === 1 ? 'passenger' : 'passengers'}`
  return `${query.trim()} (${pax}, ${c.cabin.replace('_', ' ')} cabin.)`
}

export type Screen = 'home' | 'chat'

export function useAgentRun() {
  const [screen, setScreen] = useState<Screen>('home')
  const [mode, setMode] = useState<Mode>('hitl')
  const [constraints, setConstraintsState] = useState<ConstraintsState>(DEFAULT_CONSTRAINTS)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [modeAppliesNextRun, setModeAppliesNextRun] = useState(false)
  const [lastQuery, setLastQuery] = useState('')

  const closeStreamRef = useRef<(() => void) | null>(null)
  const activeThinkingIdRef = useRef<number | null>(null)

  const appendItem = useCallback((item: FeedItem) => {
    setFeed((f) => [...f, item])
  }, [])

  const updateItem = useCallback((id: number, updater: (item: FeedItem) => FeedItem) => {
    setFeed((f) => f.map((it) => (it.id === id ? updater(it) : it)))
  }, [])

  const finishThinking = useCallback(() => {
    const id = activeThinkingIdRef.current
    if (id == null) return
    updateItem(id, (it) => {
      if (it.kind !== 'thinking') return it
      return { ...it, done: true, steps: it.steps.map((s) => ({ ...s, status: s.status === 'pending' ? s.status : 'done' })) }
    })
    activeThinkingIdRef.current = null
  }, [updateItem])

  const handleLoopStep = useCallback((p: { label: ThinkingStepLabel }) => {
    const idx = STEP_ORDER.indexOf(p.label)
    if (activeThinkingIdRef.current == null) {
      const id = nextId()
      activeThinkingIdRef.current = id
      appendItem({
        id,
        kind: 'thinking',
        done: false,
        steps: STEP_ORDER.map((label, i) => ({
          label,
          status: i < idx ? 'done' : i === idx ? 'active' : 'pending',
        })),
      })
      return
    }
    updateItem(activeThinkingIdRef.current, (it) => {
      if (it.kind !== 'thinking') return it
      return {
        ...it,
        steps: it.steps.map((s, i) => ({
          ...s,
          status: i < idx ? 'done' : i === idx ? 'active' : s.status,
        })),
      }
    })
  }, [appendItem, updateItem])

  const startNewRun = useCallback(async (query: string) => {
    setLastQuery(query)
    setModeAppliesNextRun(false)
    setScreen('chat')
    setFeed([{ id: nextId(), kind: 'user', text: query }])
    activeThinkingIdRef.current = null
    setRunning(true)

    try {
      const tripRequest = buildTripRequest(query, constraints)
      const { runId: newRunId } = await startRun({
        tripRequest,
        constraints: toApiConstraints(constraints),
        mode,
      })
      setRunId(newRunId)

      closeStreamRef.current?.()
      closeStreamRef.current = openRunStream(newRunId, {
        onLoopStep: handleLoopStep,
        onAssistantText: (p) => appendItem({ id: nextId(), kind: 'assistant', text: p.text }),
        onPlanPreview: (p) => appendItem({ id: nextId(), kind: 'plan', mode: p.mode, message: p.message }),
        onOffers: (p) => {
          finishThinking()
          appendItem({ id: nextId(), kind: 'offers', offers: p })
        },
        onEscalation: (p) => {
          finishThinking()
          appendItem({ id: nextId(), kind: 'escalation', payload: p })
        },
        onDecision: (p) => {
          appendItem({ id: nextId(), kind: 'decision', decision: p })
        },
        onConfirmation: (p) => {
          finishThinking()
          appendItem({ id: nextId(), kind: 'confirmation', result: p })
        },
        onError: (p) => {
          finishThinking()
          appendItem({ id: nextId(), kind: 'error', message: p.message })
        },
        onDone: () => {
          finishThinking()
          setRunning(false)
        },
      })
    } catch (err) {
      finishThinking()
      appendItem({ id: nextId(), kind: 'error', message: err instanceof Error ? err.message : String(err) })
      setRunning(false)
    }
  }, [constraints, mode, appendItem, handleLoopStep, finishThinking])

  const decide = useCallback(async (targetRunId: string, escalationId: number, answer: string) => {
    updateItem(escalationId, (it) => (it.kind === 'escalation' ? { ...it, resolvedAnswer: answer } : it))
    try {
      await submitDecision(targetRunId, answer)
    } catch (err) {
      appendItem({ id: nextId(), kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [appendItem, updateItem])

  const cancelBooking = useCallback((id: number) => {
    updateItem(id, (it) => (it.kind === 'confirmation' ? { ...it, cancelled: true } : it))
    appendItem({ id: nextId(), kind: 'note', text: 'Booking cancelled — nothing was ever charged (simulated).' })
  }, [updateItem, appendItem])

  const changeMode = useCallback((next: Mode) => {
    setMode(next)
    if (running) setModeAppliesNextRun(true)
  }, [running])

  const setConstraints = useCallback((patch: Partial<ConstraintsState>) => {
    setConstraintsState((c) => ({ ...c, ...patch }))
  }, [])

  const newSearch = useCallback(() => {
    closeStreamRef.current?.()
    closeStreamRef.current = null
    activeThinkingIdRef.current = null
    setScreen('home')
    setFeed([])
    setRunning(false)
    setRunId(null)
    setModeAppliesNextRun(false)
  }, [])

  const retry = useCallback(() => {
    if (lastQuery) void startNewRun(lastQuery)
  }, [lastQuery, startNewRun])

  return {
    screen, mode, constraints, feed, running, runId, modeAppliesNextRun,
    startNewRun, decide, changeMode, setConstraints, newSearch, retry, cancelBooking,
  }
}
