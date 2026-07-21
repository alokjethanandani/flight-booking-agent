/**
 * Extracts a budget cap (USD) from the user's natural-language trip prompt.
 *
 * Budget lives in the PROMPT now, not the guardrails panel — but the deterministic
 * gate that enforces it (lib/rank-offers.ts) must stay deterministic, so we read
 * the number here with a regex rather than trusting the model to report it. That
 * keeps the trust boundary intact: a regex extracts the figure, the gate enforces
 * the 20% tolerance on it — no LLM in the numeric path.
 *
 * A dollar-sign-anchored amount is the reliable, unambiguous signal and is tried
 * first. A keyword-anchored bare number ("under 650") is accepted only when it is
 * clearly a price (>= $50 and not immediately followed by a non-money unit like
 * "stops" or "h"), so "max 2 stops" / "under 12h total" are never misread as a
 * budget.
 *
 * Returns the dollar amount, or null when the prompt names no budget (→ no cap).
 */

// 1,200 (grouped) or 1200 or 650 — no lone thousands separators without groups.
const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+)`

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''))
}

// Units that mean the number is a trip detail, not a price.
const NON_MONEY_UNIT =
  /^(?:stop|stops|h\b|hr|hrs|hour|hours|min|mins|day|days|passenger|passengers|adult|adults|pm|am|:)/

export function parseBudgetFromPrompt(prompt: string): number | null {
  const text = prompt.toLowerCase()

  // 1) $-anchored: "$650", "$1,200", "$ 650" — unambiguous, wins outright.
  const dollar = text.match(new RegExp(String.raw`\$\s?${AMOUNT}`))
  if (dollar) return toNumber(dollar[1])

  // 2) keyword-anchored bare number: "under 650", "budget of 500 dollars".
  const kw = text.match(
    new RegExp(
      String.raw`(?:under|below|less than|no more than|up to|max(?:imum)?|budget(?:\s+of)?|around|about)\s+\$?\s?${AMOUNT}\s*(?:dollars|usd|bucks)?`,
    ),
  )
  if (kw) {
    const n = toNumber(kw[1])
    const after = text.slice((kw.index ?? 0) + kw[0].length).trimStart()
    if (n >= 50 && !NON_MONEY_UNIT.test(after)) return n
  }

  // 3) trailing currency word: "650 dollars", "500 usd".
  const trailing = text.match(new RegExp(String.raw`${AMOUNT}\s*(?:dollars|usd|bucks)\b`))
  if (trailing) {
    const n = toNumber(trailing[1])
    if (n >= 50) return n
  }

  return null
}
