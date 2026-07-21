/**
 * Phase 4 — Express app: static SPA serve (phase4 mode) + the three API
 * routes (HLD §5). No database, no auth, no persistence beyond the
 * in-process run state in run-orchestrator.ts (HLD §8).
 *
 * Dev: run alongside `npm run dev:web` (Vite dev server), which proxies
 * `/api/*` here (see web/vite.config.ts). Prod-ish demo: `npm run phase4`
 * serves the built SPA from web/dist directly off this same server.
 */

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { runPreflightChecks } from '../lib/preflight.js';
import {
  registerRun,
  attachStream,
  submitDecision,
  RunAlreadyActiveError,
} from './run-orchestrator.js';
import type { RunRequestBody } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Deliberately NOT `process.env.PORT`: in split dev mode (`npm run dev`) the
// dev-tooling harness exports PORT for the browser-facing process (Vite, on
// 5173), and this API server is a second, internal process proxied through
// it (web/vite.config.ts targets :3001) — reusing PORT here would collide.
const PORT = Number(process.env.API_PORT ?? 3001);
const SERVE_SPA = process.env.PHASE4_SERVE_SPA === '1';

const app = express();
app.use(express.json());

app.post('/api/run', (req: Request, res: Response) => {
  const body = req.body as Partial<RunRequestBody>;
  if (
    typeof body.tripRequest !== 'string' ||
    body.tripRequest.trim() === '' ||
    (body.mode !== 'automated' && body.mode !== 'hitl') ||
    typeof body.constraints !== 'object' ||
    body.constraints === null
  ) {
    res.status(400).json({
      error: 'Body must be { tripRequest: string, constraints: object, mode: "automated" | "hitl" }.',
    });
    return;
  }

  try {
    const runId = registerRun({
      tripRequest: body.tripRequest,
      constraints: body.constraints,
      mode: body.mode,
      offline: body.offline === true,
    });
    res.json({ runId });
  } catch (err) {
    if (err instanceof RunAlreadyActiveError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

app.get('/api/stream', (req: Request, res: Response) => {
  const runId = String(req.query.runId ?? '');
  if (!runId || !attachStream(runId, res)) {
    res.status(404).json({ error: `No pending run "${runId}". POST /api/run first.` });
  }
});

app.post('/api/decision', (req: Request, res: Response) => {
  const { runId, answer } = req.body as { runId?: string; answer?: string };
  if (typeof runId !== 'string' || typeof answer !== 'string') {
    res.status(400).json({ error: 'Body must be { runId: string, answer: string }.' });
    return;
  }
  const ok = submitDecision(runId, answer);
  if (!ok) {
    res.status(404).json({ error: `No pending decision for run "${runId}".` });
    return;
  }
  res.json({ ok: true });
});

if (SERVE_SPA) {
  const spaDir = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(spaDir));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(spaDir, 'index.html'));
  });
}

async function main(): Promise<void> {
  console.log('--- preflight ---');
  await runPreflightChecks({ duffelEnv: 'prod' });

  app.listen(PORT, () => {
    console.log(`\nPhase 4 server listening on http://localhost:${PORT}`);
    console.log(SERVE_SPA ? '  serving built SPA from web/dist' : '  API only — run `npm run dev:web` for the SPA');
  });
}

main().catch((err) => {
  console.error('Phase 4 server failed to start:', err);
  process.exit(1);
});
