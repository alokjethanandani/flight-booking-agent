# Vision Brief — Logged-In FlightGenie (Product Vision, Not v1)

**Owner:** Alok · **For:** Claude Design + portfolio/interview narrative · **Drafted:** 2026-07-14 · **Status:** Vision
**Companion docs:** `Mini-PRD-Flight-Booking-Agent.md` (v1 scope), `UX-Interaction-Brief-Phase4.md` (v1 build — see Part B, which this expands), `design-system-prompt.md` v2 (visual language), `Vision-Design-Prompt-Logged-In.md` (the paste-into-Claude-Design generation prompt for these screens).

---

## 0. Scope fence (read first)

This is the **product vision** — where FlightGenie goes *after* the POC proves the oversight model. It is **explicitly out of v1 build scope** (PRD §3 non-goals: accounts, production auth, stored payment). Nothing here gets wired into the Phase 4 demo. It exists as a **mockup + narrative** to show reviewers/interviewers the trajectory.

Two hard rules for anyone prototyping this:
1. **Nothing functional.** Payment, membership IDs, and account data are *mocked static UI only* — never a real vault, never a real charge, never a real credential store. This is a picture of the destination, not the destination.
2. **The visual system is locked.** Build on `design-system-prompt.md` v2: white canvas, whitespace-forward, **color = signal**, black controls, orange accent only, pill geometry, Inter, light+dark, no illustration.

---

## 1. The thesis this vision makes tangible

v1 proves the agent can *act vs. ask*. The logged-in vision proves the **more interesting** claim: **stored preferences are the guardrails that make automation safe by construction, and trust is earned progressively rather than granted up front.**

The through-line: *the more of yourself you give the agent (preferences, IDs, payment, rules), the more it can safely do without asking — and every autonomous act stays legible and reversible.* That is the entire "designing for human oversight, not execution" POV, extended from a single booking to a standing relationship.

This is why the account isn't a login wall — it's the **trust-configuration surface**. The preference screens *are* the control surfaces from PRD §8, made persistent.

## 2. Information architecture

A returning, logged-in user. Bottom-nav or sidebar shell (per v2 pill-nav pattern). Six areas:

| Area | Role | Trust stakes |
|---|---|---|
| **Home / Dashboard** | Upcoming trips, active automation rules, agent activity feed | — |
| **Chat + Search** | The v1 surface, now personalized (pre-filled from prefs) | Low |
| **Travel Profile** | Preferred airlines, home airports, cabin, seat, meal | Low |
| **Traveler & IDs** | Frequent-flyer, Known Traveler Number, passport, redress; saved companions | Medium (PII) |
| **Payment** | Card(s) on file, default, spend caps | **Highest** |
| **Automation & Trust** | Global mode + per-route rules + approval/notification prefs | **Highest** |

The last two are where the design work matters. Everything else is table-stakes account UI.

## 3. Stored-preferences model (what "knowing you" means)

Group by trust stakes so the UI can escalate friction proportionally (my "scale friction to stakes" principle applied to the product itself):

**Low stakes — convenience (pre-fills the search, no risk if wrong)**
- Preferred airlines (ranked, soft preference — matches v1's soft-airline decision)
- Home / preferred airports (default origin; nearby-airport set)
- Default cabin, seat (aisle / window / no preference), meal, trip type

**Medium stakes — identity / PII (needs verification affordances, not just a text field)**
- Frequent-flyer / loyalty numbers per airline
- Known Traveler Number (TSA PreCheck) / Global Entry, Redress number
- Passport (for international) — number, expiry, nationality
- Saved travelers (self + companions/family) — book for others

**Highest stakes — money + autonomy (the design centerpiece)**
- Payment card(s) on file — tokenized display only (`•••• 4242`), default card, per-card label
- **Spend caps** — max the agent may auto-charge per booking / per month
- **Automation rules** — the standing instructions that let the agent act without asking

Design implication: **friction scales with stakes.** Editing a seat preference is one tap. Adding a card or an auto-book rule gets a confirmation, a cap, and an explicit "here's what this now lets the agent do" summary.

## 4. Payment on file — the highest-trust-stakes surface

This is the screen that makes autonomous booking *real*, so it's where the oversight design earns its keep. It is also the one I flagged as *cut from v1* — correct for the live POC, essential for the vision. Design principles:

- **Tokenized, never raw.** Show `•••• 4242 · Visa · exp 09/28`, a label, and a default toggle. No full PAN anywhere, ever — even in the mock.
- **Every card carries a spend cap.** A card on file is meaningless to the trust model without a ceiling. Surface the cap *on* the card: "Auto-book up to **$400**." This is the guardrail that makes "card on file + automatic" safe by construction.
- **Show what the card unlocks.** Beside the card, state plainly which automation rules can draw on it. Money and autonomy are linked; the UI must make the link visible.
- **Reversibility front-and-center.** A clear, always-available "pause all automatic booking" kill-switch. Trust requires an off-ramp.

## 5. Automation & Trust — the centerpiece screen

Where the v1 mode toggle grows into a standing policy. Three layers:

1. **Global default** — HITL or Automatic (v1's toggle). Default stays **HITL** (earned trust).
2. **Per-route / per-condition rules** — the real power. Example rule, rendered as an editable, plain-language card:
   > *"Auto-book **AUS → SFO**, round-trip, under **$350**, on **preferred airlines**, **1 stop max**, using **Visa ••42**. Otherwise, ask me."*
   Every rule = a scoped grant of autonomy with an explicit budget and an explicit fallback ("otherwise ask"). This is the trust boundary made into a first-class, user-authored object.
3. **Approval & notification prefs** — when the agent *does* pause, how it reaches you (in-app, and the vision-tier SMS/email/WhatsApp handoff). When it *acts*, how it tells you after.

**Progressive trust — the signature interaction.** The agent proposes automation the user has effectively demonstrated:
> *"You've picked the same AUS→SFO pattern 3 times. Want me to auto-book it under $350 next time?"* → one tap creates the rule above.

Trust is *earned and offered*, never assumed. This single flow is the most portfolio-worthy screen in the app — it's trust calibration you can watch happen.

## 6. Legibility & reversibility (carried from v1, raised in stakes)

Autonomy without an audit trail is not oversight — it's abdication. So the logged-in app needs:

- **Agent activity feed** — a reverse-chron log of what the agent did autonomously: *"Auto-booked AUS→SFO, $312, under your $350 cap — [view] [undo]."* Every autonomous act is legible after the fact and (within the mock) reversible.
- **Personalized pre-action plan preview** — the v1 §A2a pattern, now reading from the user's rules: *"For this trip, my rules let me auto-book up to $350 on Delta/United. Above that, I'll ask."* The boundary is stated *before* the agent acts, personalized to their standing grants.
- **Savings / trust receipts** — light: "The agent handled 4 trips this quarter within your rules." Reinforces earned trust without gamifying.

## 7. Onboarding (light)

Don't front-load a 10-field setup. **Progressive profiling:** create account (SSO), search immediately, and capture preferences *in context* as they come up ("Save AUS as your home airport?" after the first search). The account fills itself through use — which is also how trust ramps. A dedicated profile hub exists for users who want to configure up front, but it's opt-in, not a gate.

## 8. What to prototype (screen list for the mockup)

Priority order for the HTML prototype and the Claude Design generation:
1. **Home / Dashboard** (returning user: upcoming trip, active rules, activity feed)
2. **Automation & Trust** (global toggle + rule cards + a progressive-trust prompt)
3. **Payment** (card on file + spend cap + kill-switch)
4. **Travel Profile** (airlines ranked, home airports, seat/cabin)
5. **Traveler & IDs** (loyalty + KTN + passport + saved travelers)

## 9. Portfolio framing (why this matters in a hiring loop)

The v1 POC says "I can build an agent." This vision says "I understand what agent products *become*: a standing negotiation of trust between a person and an autonomous system, where the interface's job is to keep that trust legible, bounded, and reversible." That's the senior-designer signal — not more screens, but a coherent trust model that scales from one booking to a relationship.

## 10. Open questions
- **Nearby-airport intelligence** — does the agent proactively suggest alternate airports (OAK vs. SFO) as a preference, or only honor what's set? (Automation surface-area question.)
- **Multi-traveler automation** — do auto-book rules apply when booking for companions, or self-only? (Stakes jump when spending on others.)
- **Rule conflicts** — when two rules could match a search, how does the UI show precedence? (Deferred; flag if prototyping rule-heavy users.)
