# Design-Generation Prompt — Logged-In Vision Screens (FlightGenie)

> Paste the block below into Claude Design (or v0/Lovable) to generate the **logged-in
> vision** mockups. This is a **vision prototype**, not v1 — see `Vision-Brief-Logged-In.md`
> for the why and the trust model. It reuses the **v2 design system** defined in
> `design-system-prompt.md` — generate that system first (or in the same session) so these
> screens inherit its tokens and components.

---

## PROMPT

Design the **logged-in / account experience** for **FlightGenie**, a consumer AI
flight-booking app. Build on the existing FlightGenie design system — **do not invent a new
visual language.** Everything inherits from it:

- **shadcn/ui + Tailwind, single CSS-variable theme**, Inter, full light + dark.
- **White canvas, whitespace-forward. Color = signal, never decoration.** Neutral cards are
  white with soft shadow / hairline border; bright color appears **only** where it carries
  meaning (semantic status, the one accent, the preferred pick).
- **Black is the control neutral** — primary buttons, nav, active pill states are solid black.
  **Orange is brand accent only.** Semantic tokens: **success** (muted forest green),
  **warning** (amber), **destructive** (red).
- **Fully-rounded pill geometry**; large-radius white cards; **no illustration** (clean /
  photographic). Mobile-first, ≥44px touch targets.

### What this is (context so the screens have the right stakes)
FlightGenie is an agent that searches and books flights and runs in two modes — **automatic**
(acts within the user's rules) and **human-in-the-loop** (asks first). The logged-in app is
the **trust-configuration surface**: the user stores preferences, IDs, and payment, and
authors the rules that let the agent act safely without asking. **The organizing principle is
trust: friction scales with stakes** — changing a seat preference is one tap; adding a card or
an auto-book rule takes a confirmation, a spend cap, and a plain-language summary of what the
agent may now do.

**Mock only.** Payment, membership IDs, and personal data are static UI — never functional.
Show tokenized cards (`•••• 4242`), never raw numbers.

### Global shell
A persistent nav (bottom pill-nav on mobile, sidebar on laptop) across five destinations:
**Home · Search · Profile · Payment · Automation.** Include a light top bar with avatar +
the FlightGenie wordmark (orange accent permitted on the wordmark only).

### Screens to generate (all states: default, hover, focus, loading, empty, error)

**1. Home / Dashboard (returning user)**
- Greeting + next upcoming trip card (white, rounded; route, dates, status pill).
- **Active automation rules** — compact list of plain-language rule chips (see screen 5).
- **Agent activity feed** — reverse-chron list: *"Auto-booked AUS→SFO · $312 · within your
  $350 cap"* each with **[view] [undo]**. Use a **success** status dot for completed
  autonomous actions, **warning** for "paused, needs you."
- One primary black CTA: "Plan a trip."

**2. Travel Profile (low-stakes prefs)**
- **Preferred airlines** — a **ranked**, reorderable list (drag chips); label clearly as a
  *soft* preference ("we'll prefer these, not require them").
- **Home airports** — default origin + a nearby-airport set (IATA chips).
- **Cabin**, **seat** (segmented pill: Aisle / Window / No preference), **meal**.
- All edits are inline, one-tap, no confirmation — this is the low-friction tier.

**3. Traveler & IDs (medium-stakes / PII)**
- **Loyalty / frequent-flyer** numbers per airline (add/edit rows).
- **Known Traveler Number (TSA PreCheck) / Global Entry**, **Redress number**.
- **Passport** (international) — number (masked), expiry, nationality; show an **expiry
  warning** state using the warning token when near expiry.
- **Saved travelers** — self + companions/family cards; "book for" affordance.
- These edits show a light verification/confirm affordance — more friction than screen 2,
  reflecting PII stakes.

**4. Payment (highest-stakes)**
- **Card(s) on file** — tokenized card cards (`•••• 4242 · Visa · exp 09/28`), a **Default**
  toggle, per-card label.
- **Spend cap on every card**, shown on the card: *"Auto-book up to **$400**."*
- **"What this unlocks"** — beside each card, the automation rules that can draw on it.
- **Kill-switch** — a prominent, always-visible **"Pause all automatic booking"** control
  (use warning/destructive treatment; this is the off-ramp).
- Adding a card = a confirmation step summarizing the new autonomy it grants.

**5. Automation & Trust (the centerpiece — spend the most craft here)**
- **Global mode** — Automatic / HITL segmented pill; default HITL. One-line explanation each.
- **Rule cards** — each rule as an editable, plain-language card:
  > *"Auto-book **AUS → SFO**, round-trip, under **$350**, on **preferred airlines**,
  > **1 stop max**, using **Visa ••42**. Otherwise, **ask me**."*
  Bold the variables (route, cap, card, fallback). Every rule visibly names its **spend cap**
  and its **"otherwise ask"** fallback — the grant of autonomy is always bounded and always
  has an off-ramp. Edit / pause / delete per rule.
- **Progressive-trust prompt** — a highlighted suggestion card (accent-bordered, not a status
  color): *"You've picked the same AUS→SFO pattern 3 times. Auto-book it under $350 next
  time?"* with **[Create rule] [Not now]**. One tap creates the rule above. **This is the
  hero moment of the vision — design it to be the screenshot.**
- **Personalized pre-action plan preview** — a banner shown at search time: *"My rules let me
  auto-book up to $350 on Delta/United for this trip. Above that, I'll ask."*

### Deliverable
- The five screens above in **both light and dark**, mobile-first, laptop variant for Home and
  Automation.
- A short **flow** showing progressive trust: activity feed → progressive-trust prompt →
  created rule → personalized pre-action preview at next search.
- Reuse system tokens/components throughout; introduce **no** new colors. The only chromatic
  elements are semantic status + the single accent. Keep it lean.

### Do NOT
- No functional payment, no real credential storage, no raw card numbers.
- No decorative color-blocking of cards. No illustration/3D/gradient blobs.
- No new styling system, no second component library.
