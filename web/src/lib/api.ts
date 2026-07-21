/**
 * Client-side mirror of src/server/types.ts + the lib/ types it re-exposes
 * (oversight.ts's OversightDecision, book-flight.ts's BookingResult,
 * constraints.ts's Constraints). Duplicated rather than imported — the web/
 * and root TS projects are separate builds — but the shapes must stay in
 * lockstep with the server contract (HLD §5).
 */

export type Mode = 'automated' | 'hitl'
export type OfferTier = 'eligible' | 'tolerance' | 'rejected'

export interface Constraints {
  maxPrice?: number
  currency?: string
  maxStops?: number
  maxTotalDurationMinutes?: number
  preferredAirlines?: string[]
  budgetTolerancePct?: number
}

export interface OfferSummary {
  offerId: string
  tier: OfferTier
  number?: number
  airlineName: string
  airlineIataCode: string | null
  priceAmount: number
  priceCurrency: string
  totalDurationMinutes: number | null
  maxStopsAcrossSlices: number
  reasons: string[]
  budgetDetail: string
}

export interface OffersPayload {
  eligible: OfferSummary[]
  tolerance: OfferSummary[]
  rejected: OfferSummary[]
}

export interface EscalationOption {
  value: string
  label: string
}

export interface EscalationPayload {
  mode: Mode
  prompt: string
  requestedOfferId?: string
  options: EscalationOption[]
  offers: OfferSummary[]
  isFreeText: boolean
}

export interface LoopStepPayload {
  label: 'searching' | 'ranking' | 'deciding'
}

export interface PlanPreviewPayload {
  mode: Mode
  message: string
}

export type OversightAction =
  | 'auto-book'
  | 'escalated-approved'
  | 'escalated-declined'
  | 'blocked-rejected'
  | 'blocked-unknown'
  | 'hitl-approved'
  | 'hitl-declined'

export interface OversightDecision {
  at: string
  mode: Mode
  toolName: string
  requestedOfferId: string
  tier: OfferTier | 'unknown'
  outcome: 'allow' | 'deny'
  action: OversightAction
  reason: string
  finalOfferId?: string
  humanPrompt?: string
  humanAnswer?: string
}

export interface BookedSlice {
  from: string | null
  to: string | null
  departingAt: string
  arrivingAt: string
  stops: number
  durationMinutes: number | null
}

export interface BookingConfirmation {
  status: 'confirmed'
  mock: true
  pnr: string
  bookingReference: string
  offerId: string
  airline: string
  airlineIataCode: string | null
  priceAmount: number
  priceCurrency: string
  passengerCount: number
  itinerary: BookedSlice[]
  bookedAt: string
  notice: string
}

export interface OfferExpired {
  status: 'offer_expired'
  mock: true
  offerId: string
  expiresAt: string
  checkedAt: string
  message: string
}

export type BookingResult = BookingConfirmation | OfferExpired

// --- REST -------------------------------------------------------------------

export interface RunRequestBody {
  tripRequest: string
  constraints: Constraints
  mode: Mode
  offline?: boolean
}

const API_DOWN_HINT =
  "Couldn't reach the FlightGenie server. It runs as a separate process from " +
  'the web UI — make sure the full stack is up (run `npm run dev`, which starts ' +
  'the API server and the web app together), not just the frontend.'

/**
 * POSTs JSON and returns the parsed body, translating the two failure modes
 * that read as opaque "502"s into an actionable message: a totally-unreachable
 * API (fetch rejects, or the Vite dev proxy has no target — ECONNREFUSED), and
 * a gateway error status (502/503/504) from the proxy when the Express server
 * isn't listening.
 */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Network-level failure — no response at all (server down, proxy target unreachable).
    throw new Error(API_DOWN_HINT)
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error(API_DOWN_HINT)
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? `POST ${path} failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export function startRun(body: RunRequestBody): Promise<{ runId: string }> {
  return postJson<{ runId: string }>('/api/run', body)
}

export async function submitDecision(runId: string, answer: string): Promise<void> {
  await postJson<{ ok: true }>('/api/decision', { runId, answer })
}

// --- SSE ----------------------------------------------------------------

export interface SseHandlers {
  onLoopStep: (p: LoopStepPayload) => void
  onAssistantText: (p: { text: string }) => void
  onOffers: (p: OffersPayload) => void
  onPlanPreview: (p: PlanPreviewPayload) => void
  onEscalation: (p: EscalationPayload) => void
  onDecision: (p: OversightDecision) => void
  onConfirmation: (p: BookingResult) => void
  onError: (p: { message: string }) => void
  onDone: (p: { decisionLog: OversightDecision[] }) => void
}

/** Opens the run's SSE stream and wires each event type to its handler. Returns a closer. */
export function openRunStream(runId: string, handlers: SseHandlers): () => void {
  const source = new EventSource(`/api/stream?runId=${encodeURIComponent(runId)}`)

  const bind = <T,>(type: string, handler: (payload: T) => void): void => {
    source.addEventListener(type, (evt) => {
      handler(JSON.parse((evt as MessageEvent).data) as T)
    })
  }

  bind('loop_step', handlers.onLoopStep)
  bind('assistant_text', handlers.onAssistantText)
  bind('offers', handlers.onOffers)
  bind('plan_preview', handlers.onPlanPreview)
  bind('escalation', handlers.onEscalation)
  bind('decision', handlers.onDecision)
  bind('confirmation', handlers.onConfirmation)
  bind('error', handlers.onError)
  source.addEventListener('done', (evt) => {
    handlers.onDone(JSON.parse((evt as MessageEvent).data) as { decisionLog: OversightDecision[] })
    source.close()
  })

  return () => source.close()
}
