/**
 * Env-aware Duffel client factory.
 *
 * Two Duffel tokens exist in `.env`:
 *   - DUFFEL_API_KEY_PROD — real multi-airline data. This is what the actual
 *     `search_flights` tool (the one wired into the agent) uses at runtime.
 *     Locked PRD decision (§9/§10): production search avoids the "test mode
 *     only returns one sandbox airline" problem that would defeat the whole
 *     comparison-shopping premise.
 *   - DUFFEL_API_KEY_TEST — only for local dev/smoke-testing the wiring
 *     (request shape, response parsing, normalization) without spending
 *     production supplier-search quota while iterating. Never used by the
 *     tool the agent actually calls.
 *
 * `book_flight` never uses either key — it's mocked end-to-end and never
 * reaches Duffel's `order` endpoint, in either environment. See CLAUDE.md
 * guardrails.
 */

import { Duffel } from '@duffel/api';

export type DuffelEnv = 'prod' | 'test';

export class MissingDuffelKeyError extends Error {
  constructor(env: DuffelEnv, envVarName: string) {
    super(
      [
        `DUFFEL_API_KEY_${envVarName} is not set (needed for Duffel "${env}" environment).`,
        '  -> Copy .env.example to .env and fill in the appropriate key.',
        '  -> Get tokens from your Duffel dashboard (Settings -> Access tokens).',
      ].join('\n'),
    );
    this.name = 'MissingDuffelKeyError';
  }
}

/**
 * Returns a Duffel client configured for the requested environment.
 * Duffel determines live vs. test mode from the token itself
 * (`duffel_live_...` vs `duffel_test_...`) — both hit the same
 * api.duffel.com base path, so there's no separate base URL to configure.
 */
export function getDuffelClient(env: DuffelEnv): Duffel {
  const envVarSuffix = env === 'prod' ? 'PROD' : 'TEST';
  const envVarName = `DUFFEL_API_KEY_${envVarSuffix}`;
  const token = process.env[envVarName];

  if (!token || token.trim().length === 0) {
    throw new MissingDuffelKeyError(env, envVarSuffix);
  }

  const expectedPrefix = env === 'prod' ? 'duffel_live_' : 'duffel_test_';
  if (!token.trim().startsWith(expectedPrefix)) {
    console.warn(
      `  [duffel-client] warning: ${envVarName} does not start with "${expectedPrefix}" — ` +
        `double-check it's actually a ${env} token and not swapped with the other environment.`,
    );
  }

  return new Duffel({ token: token.trim() });
}
