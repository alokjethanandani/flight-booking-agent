/**
 * Phase 4 — tiny SSE framing helper.
 *
 * One `SseChannel` wraps a single response and knows how to write correctly
 * framed `event: <type>\ndata: <json>\n\n` chunks, plus a heartbeat comment
 * to keep the connection warm across the multi-second gaps a live model turn
 * or a live Duffel search can introduce (HLD §11).
 */

import type { Response } from 'express';

export class SseChannel {
  private readonly res: Response;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(res: Response) {
    this.res = res;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    this.heartbeatTimer = setInterval(() => {
      if (!this.closed) this.res.write(': heartbeat\n\n');
    }, 15_000);
  }

  send(event: string, payload: unknown): void {
    if (this.closed) return;
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.res.end();
  }
}
