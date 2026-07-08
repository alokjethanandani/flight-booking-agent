/**
 * Fail-fast credential checks, run before the agent loop starts.
 *
 * Why this exists: the Agent SDK spawns a CLI subprocess that retries a bad
 * ANTHROPIC_API_KEY silently with exponential backoff — up to ~10 attempts
 * over ~40+ seconds — before finally surfacing a generic "Not logged in"
 * error. That reads as a hang, not an auth failure, and it's a bad debug
 * loop to repeat every time credentials change (Phase 1 adds a Duffel key
 * on top of this). This module makes one cheap, fast request up front and
 * fails immediately with a specific, actionable message instead.
 *
 * Uses GET /v1/models (docs.anthropic.com/en/api/models-list) — a metadata
 * lookup, not a completion, so it doesn't consume model tokens and is safe
 * to call on every startup.
 */

const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const PREFLIGHT_TIMEOUT_MS = 10_000;

export class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

/**
 * Throws CredentialError with a specific, actionable message if
 * ANTHROPIC_API_KEY is missing or rejected. Resolves silently if it's valid.
 */
export async function assertAnthropicApiKeyValid(): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key || key.trim().length === 0) {
    throw new CredentialError(
      [
        'ANTHROPIC_API_KEY is not set.',
        '  -> Copy .env.example to .env and fill in ANTHROPIC_API_KEY, or export it in your shell.',
        '  -> Get a key at https://console.anthropic.com (left nav: "API Keys").',
      ].join('\n'),
    );
  }

  if (key !== key.trim()) {
    console.warn(
      '  [preflight] warning: ANTHROPIC_API_KEY has leading/trailing whitespace — trimming for this check, but fix the .env value.',
    );
  }
  const trimmedKey = key.trim();

  if (!trimmedKey.startsWith('sk-ant-')) {
    console.warn(
      '  [preflight] warning: ANTHROPIC_API_KEY does not start with "sk-ant-" — double-check you copied the whole key and not, e.g., a Claude.ai session token.',
    );
  }

  // One retry on network-level failures only (DNS blips, transient
  // connection resets) — a bad key should still fail on the first real
  // response, so this doesn't slow down the actual "fail fast" case.
  const attempts = 2;
  let lastNetworkError: unknown;
  let response: Response | undefined;
  for (let attempt = 1; attempt <= attempts && !response; attempt++) {
    try {
      response = await fetch(`${ANTHROPIC_API_BASE}/v1/models?limit=1`, {
        method: 'GET',
        headers: {
          'x-api-key': trimmedKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
      });
    } catch (err) {
      lastNetworkError = err;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }
  }

  if (!response) {
    const err = lastNetworkError;
    const cause =
      err instanceof Error
        ? // Node's fetch wraps the real DNS/socket error in `.cause`.
          ((err as { cause?: Error }).cause?.message ?? err.message)
        : String(err);
    throw new CredentialError(
      [
        `Could not reach api.anthropic.com to validate the key after ${attempts} attempts (${cause}).`,
        '  -> Check your network connection (or corporate proxy/firewall) and try again.',
      ].join('\n'),
    );
  }

  if (response.status === 401) {
    throw new CredentialError(
      [
        'ANTHROPIC_API_KEY was rejected by Anthropic (HTTP 401, authentication_failed).',
        '  -> The key is set and readable by this script, but the API says it is invalid.',
        '  -> Regenerate a key at https://console.anthropic.com (API Keys) and replace the',
        '     whole ANTHROPIC_API_KEY= line in .env. A common cause is a dropped or',
        '     duplicated character from copy-paste, or a revoked/wrong-workspace key.',
      ].join('\n'),
    );
  }

  if (response.status === 403) {
    throw new CredentialError(
      [
        'ANTHROPIC_API_KEY was rejected by Anthropic (HTTP 403, permission_error).',
        '  -> The key is valid but not authorized for this — check the key belongs to a',
        '     workspace with API access enabled, and that billing/credits are set up at',
        '     https://console.anthropic.com.',
      ].join('\n'),
    );
  }

  if (!response.ok) {
    throw new CredentialError(
      [
        `Unexpected response validating ANTHROPIC_API_KEY: HTTP ${response.status}.`,
        '  -> This may be a transient Anthropic-side issue — check https://status.anthropic.com.',
      ].join('\n'),
    );
  }

  console.log('  [preflight] ANTHROPIC_API_KEY is valid.');
}

/**
 * Fail-fast check that the Duffel key for the given environment is present
 * and plausibly shaped (right prefix). Doesn't make a network call — Duffel
 * has no free metadata endpoint as cheap as Anthropic's /v1/models, and the
 * search call itself will surface auth errors clearly enough. This just
 * catches "forgot to set it" / "swapped test and prod" before spinning up
 * the agent loop.
 */
export async function assertDuffelApiKeyPresent(
  env: 'prod' | 'test',
): Promise<void> {
  // Reuses getDuffelClient's own validation (presence + prefix warning) —
  // constructing the client is enough to trigger it; we don't need to keep
  // the instance here.
  const { getDuffelClient, MissingDuffelKeyError } = await import(
    './duffel-client.js'
  );
  try {
    getDuffelClient(env);
    console.log(`  [preflight] DUFFEL_API_KEY_${env === 'prod' ? 'PROD' : 'TEST'} is present.`);
  } catch (err) {
    if (err instanceof MissingDuffelKeyError) {
      throw new CredentialError(err.message);
    }
    throw err;
  }
}

/**
 * Runs all preflight checks and exits the process with a clean, readable
 * error (no stack trace) if any fail. Call this first thing in main().
 * Pass `duffelEnv` for scripts that also need a Duffel key checked.
 */
export async function runPreflightChecks(options?: {
  duffelEnv?: 'prod' | 'test';
}): Promise<void> {
  try {
    await assertAnthropicApiKeyValid();
    if (options?.duffelEnv) {
      await assertDuffelApiKeyPresent(options.duffelEnv);
    }
  } catch (err) {
    if (err instanceof CredentialError) {
      console.error(`\n✗ Startup check failed:\n\n${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
}
