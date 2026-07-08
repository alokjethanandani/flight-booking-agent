/**
 * A tiny in-process store bridging the search_flights and rank_offers tools.
 *
 * Why this exists: search_flights returns a *text summary* to the model, not
 * structured offer objects. If rank_offers took offers as tool input, the
 * model would have to reconstruct full offers from that summary — lossy,
 * token-heavy, and error-prone. Instead search_flights stashes the real
 * NormalizedOffers here and hands the model a short searchId; rank_offers
 * looks them back up and gates the genuine data. So the trust boundary runs
 * on full-fidelity offers, never on a model paraphrase.
 *
 * In-memory and process-local — fine for a single-session POC. No persistence.
 */

import type { NormalizedOffer } from './normalize-offer.js';

const store = new Map<string, NormalizedOffer[]>();
let latestSearchId: string | null = null;
let counter = 0;

export function saveSearchResult(offers: NormalizedOffer[]): string {
  counter += 1;
  const id = `search_${counter}`;
  store.set(id, offers);
  latestSearchId = id;
  return id;
}

/**
 * Returns the offers for a given searchId, or the most recent search when no
 * id is given (the common case in a single-trip demo). Undefined if nothing
 * matches.
 */
export function getSearchResult(
  searchId?: string,
): { searchId: string; offers: NormalizedOffer[] } | undefined {
  const id = searchId ?? latestSearchId;
  if (id == null) return undefined;
  const offers = store.get(id);
  if (offers == null) return undefined;
  return { searchId: id, offers };
}

/** Test-only reset. */
export function _clearOfferStore(): void {
  store.clear();
  latestSearchId = null;
  counter = 0;
}
