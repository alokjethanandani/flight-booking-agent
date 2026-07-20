# Design-System Generation Prompt — Consumer Flight-Booking Agent

> Paste the block below into Claude Design (or v0/Lovable). It generates a shadcn-based
> design system for the flight-booking agent POC. Scoped intentionally thin per PRD §9 —
> enough to demo both modes legibly, not a full enterprise kit.
>
> **v2 (2026-07-14):** aesthetic direction updated from moodboard references — white-canvas,
> whitespace-forward, black controls, color-as-signal. See "Visual language" below.

---

## PROMPT

Build a **design system** for a consumer flight-booking web app. Use **shadcn/ui**
(https://ui.shadcn.com/) as the base — its components, conventions, and CSS-variable
theming are the foundation. Do not introduce a second styling system. Everything is
Tailwind + shadcn tokens, themed from one set of CSS variables.

### Product context (so components fit the real screens)
This is an AI agent that searches real flights and books them (booking is mocked). It runs
in two modes and the whole point is that the human can *see when the agent acts vs. asks*:
- **Automated mode** — the agent auto-selects and books the best option that meets all the
  user's constraints; if the best option breaks a constraint, it escalates instead.
- **Human-in-the-loop (HITL) mode** — the agent always presents a preferred pick plus
  secondary options and the user chooses.

The UI is thin: a **chat thread**, **flight result cards** (preferred + secondaries with
visible ranking reasoning), a **settings panel** (mode toggle + constraints), and an
**escalation surface** ("I paused because this breaks your rule: max 1 stop"). Design the
system to serve exactly these surfaces.

### Visual language (the aesthetic direction — read first)
The look is **a clean white canvas with heavy whitespace, where the only things that "pop"
are the elements that carry meaning.** Restraint is the point.

- **White / near-white surface.** Backgrounds are white (light) / near-black (dark). Generous
  whitespace and air between sections — let the layout breathe. This is not a dense dashboard.
- **Color = signal, never decoration.** This is the single most important rule and it is
  non-negotiable because color is load-bearing in this product: the semantic status colors
  (success / warning / alert) *mean* constraint status, and the accent marks the preferred
  pick and the one primary action. Do **not** color-block cards or tiles decoratively.
  Neutral cards stay white/paper with a subtle border or soft shadow; color appears only
  where it communicates state. A mostly-white UI makes those signals pop by contrast — that
  contrast *is* the oversight legibility.
- **Black is the control neutral.** The **primary action button** (Search, Book, Confirm)
  and any primary nav/tab control are **solid black** (near-black `--foreground`), white
  label. Orange is the **brand accent only** — used sparingly for the wordmark, a highlight,
  the "preferred pick" emphasis — **not** as the default button fill. This keeps the accent
  feeling premium and intentional.
- **Big, bold, black display type.** Headings are large, tight, heavy-weight, near-black.
  Strong type hierarchy carries the page; decoration does not.
- **Fully-rounded pill geometry.** Buttons, badges/chips, segmented controls, and status
  tags are **pill-shaped** (fully rounded). Cards use a large corner radius (~16–24px) with
  soft, low-contrast shadows or hairline borders — never heavy drop shadows.
- **Active state = filled black pill.** Segmented/day/tab selectors show the active item as a
  **solid black pill** with white text; inactive items are outlined/ghost. (Reference the
  day-selector and tab patterns in the moodboards.)
- **No illustration.** Clean and photographic only — whitespace, type, and real
  flight/destination or airline imagery where an image is genuinely needed. No 3D renders,
  no gradient blobs, no decorative graphics that could steal focus from the oversight model
  (PRD §9 risk).

### Theming requirements
- **Neutral-first palette on a white surface.** Primary/neutral scale is white →
  grey → near-black. **Black is the primary control color** (buttons, active pills). **Orange
  is the brand accent** (energetic, travel-forward) used sparingly, never as the default fill.
  Avoid a cold corporate blue anywhere prominent.
- **Semantic status tokens are the chromatic core — treat them as first-class, not
  afterthoughts.** They map directly to the ranking logic and drive the whole oversight
  legibility:
  - **success** — meets all constraints. A **muted / forest green**, kept desaturated so it
    reads as "success" against the white canvas rather than shouting.
  - **warning** — meets some / near budget (the tolerance tier / escalation-worthy). Amber.
  - **destructive / alert** — breaks a constraint (drives the escalation "deny" state). Red.
  On a mostly-white UI these are the elements that pop; design them to.
- **Typography:** use **Inter** (shadcn's default) across the system, leaning on heavy weights
  for display headings.
- **Full light and dark mode**, driven by CSS variables (shadcn's `--background`,
  `--foreground`, `--primary`, etc.). Every token has a light and dark value. **Dark mode
  keeps the same restraint** — a near-black surface with the same neutral-first, color-as-
  signal logic (color still appears only where it means something; the surface just inverts).
  Verify text/background pairs hit **WCAG AA (4.5:1)** in both themes — especially the orange
  accent and the amber warning on light backgrounds, which often fail.

### Responsive requirements
Design **mobile-first**, working cleanly across phone, tablet, and laptop. Specify behavior
at shadcn/Tailwind's standard breakpoints (`sm 640` / `md 768` / `lg 1024`):
- **Phone:** single column; chat and results stack; settings open in a sheet/drawer;
  flight cards go full-width with a condensed layout.
- **Tablet:** results in a comfortable single/two-column; settings can be a side sheet.
- **Laptop:** optional two-pane (chat + results, settings as a panel or dialog).
- Touch targets ≥ 44px; the date picker and autocomplete must be usable on touch.

### Components to specify (with all states: default, hover, focus, disabled, loading, error)
Standard shadcn components — buttons, inputs, select, dialog, sheet, tabs, badge, card,
switch, tooltip, skeleton — restyled to the visual language above (pill geometry, black
primary, white cards) — **plus** these two custom components that shadcn does **not** ship,
both core to flight search:

1. **Date-range picker** — build on **`react-day-picker`** (the headless calendar shadcn's
   own calendar docs recommend). Do **not** pull in MUI X or any second component library —
   mixing Tailwind with MUI's emotion theming breaks single-source theming and dark mode.
   Support one-way (single date) and round-trip (range) selection, matching the app's two
   trip types. Show: input trigger, popover calendar, range highlight, hover-preview,
   disabled past dates, mobile full-width variant. Selected dates use the **filled-black-pill**
   active treatment.

2. **Airport / city autocomplete** — build on shadcn's **Combobox** pattern (Command /
   `cmdk` + Popover). Async-search results, keyboard nav, "IATA code + city + airport name"
   result rows, recent/empty states, loading state, and a clear selected-value chip (pill).

Also specify the product-specific composites:
- **Flight result card** — white surface, rounded, soft shadow; airline, times, stops,
  duration, price; a **"why this rank"** affordance; and a **constraint-status badge** (pill)
  using the success/warning/alert tokens. The **"preferred pick"** gets a distinct treatment
  — an accent-bordered or accent-tagged emphasis — clearly elevated above secondary options,
  which stay neutral/white. Color on these cards comes **only** from the status badge and the
  preferred-pick accent — nowhere else.
- **Segmented / selector controls** — trip type (one-way / round-trip) and any day or tab
  selector use the **outlined-pill / filled-black-active** pattern.
- **Mode toggle** — automated vs. HITL, with a short inline explanation of what each means.
- **Escalation / agent-pause callout** — the "I stopped because X" surface; uses the
  **warning** token (attention-needed), reserving **destructive** for hard-broken
  constraints. Should read as attention-needed without feeling like a hard error.

### Deliverable
- A documented token set (color, typography, spacing, radius, shadow) as CSS variables for
  light and dark. Radius scale should reflect the pill geometry (a full-round token for pills,
  a large token for cards).
- The component specs above with variants and states.
- A one-screen sample composition (chat + a preferred card + two secondaries + the settings
  panel) shown in **both light and dark** so the theme is verifiable. It must visibly
  demonstrate the "white canvas, color = signal, black controls" direction. Use the app name
  **FlightGenie** for the wordmark.
- Keep it lean and consistent — this is a demo POC, not a full enterprise kit. Favor a
  small, coherent token set over breadth.

---

## Decisions locked in

- **Aesthetic direction (v2, from moodboards):** white canvas + heavy whitespace; **color used
  only as signal**, never decoratively; **black** as the primary control/CTA color; **orange**
  as brand accent only; big bold black display type; fully-rounded pill geometry; white rounded
  cards with soft shadows; **no illustration** (clean / photographic).
- **Color = signal, not decoration.** Non-negotiable — protects the semantic status system that
  drives the oversight legibility (the point of the product).
- **Font:** Inter (shadcn default), heavy weights for display.
- **Green:** muted / forest tone, so it reads as "success" against the white canvas.
- **Theme modes:** full light **and** dark retained; dark mode keeps the same restraint on a
  near-black surface.
- **Name:** **FlightGenie** — used for the sample wordmark.

## Still open (optional)
- **Logo:** no logo asset exists yet; the sample composition uses a text wordmark. Add a mark
  later if you want one.
- **Accent scope:** orange is currently brand-accent + preferred-pick emphasis. If the
  preferred-pick emphasis reads as competing with the status colors in practice, consider
  giving the preferred pick a neutral-but-elevated treatment and reserving orange purely for
  the wordmark.
