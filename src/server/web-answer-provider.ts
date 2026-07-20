/**
 * Phase 4 — the third `AnswerProvider` (HLD §4.1), alongside the existing
 * stdin and scripted implementations in `lib/prompt-io.ts` (neither of which
 * is touched — this is additive).
 *
 * `ask(prompt)` never resolves on its own: it emits an SSE `escalation` event
 * carrying the gate's prompt (rendered verbatim, per HLD §5) and parks its
 * `resolve` via `setPendingResolve`. The oversight gate's `canUseTool` is an
 * async callback and already awaits stdin arbitrarily in the CLI (Phase 3);
 * awaiting a browser round-trip is the same pattern over a different
 * transport. `POST /api/decision` (wired in run-orchestrator.ts) is what
 * eventually calls the parked resolver.
 */

import type { AnswerProvider } from '../lib/prompt-io.js';
import type { SseChannel } from './sse.js';
import type { EscalationPayload } from './types.js';

export interface WebAnswerDeps {
  sse: SseChannel;
  setPendingResolve: (resolve: ((answer: string) => void) | null) => void;
  buildEscalationPayload: (prompt: string) => EscalationPayload;
}

export function createWebAnswerProvider(deps: WebAnswerDeps): AnswerProvider {
  return {
    scripted: false,
    async ask(prompt: string): Promise<string> {
      return new Promise<string>((resolve) => {
        deps.setPendingResolve(resolve);
        deps.sse.send('escalation', deps.buildEscalationPayload(prompt));
      });
    },
  };
}
