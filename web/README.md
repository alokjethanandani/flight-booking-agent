# FlightGenie browser app

The browser app shows the flight agent's plan, search results, approval requests, and simulated confirmation. I kept booking permission in the server-side gate so browser and terminal runs follow the same rules.

## Setup

Use Node 22.12+ and npm. From the project root:

```bash
npm install
npm install --prefix web
cp .env.example .env
```

Set `ANTHROPIC_API_KEY` and `DUFFEL_API_KEY_PROD` in the root `.env`. See the [project setup guide](../README.md#run-locally) for credential details.

```bash
npm run dev
```

Open [localhost:5173](http://localhost:5173). Vite forwards `/api` requests to Express on [localhost:3001](http://localhost:3001). Running only the Vite server does not start the agent API.

## Build and check

Run these from the project root:

```bash
npm run build:web
npm run lint --prefix web
npm run phase4
```

`phase4` builds the UI and serves it with the API on port 3001. `npm run preview --prefix web` previews a build without starting the API.

## UI behavior

| Surface | Behavior |
|---|---|
| Settings | Manual review by default. Mode changes during a run apply to the next search |
| Trip request | A regex extracts a supported USD budget expression. No recognized budget means no price cap |
| Stops and duration | Read from Settings for each run. Round-trip duration sums both flight legs |
| Airline | Soft preference by default. "Only use this airline" filters other carriers on the server |
| Results | Show the server's classified offers in their default sort order |
| Approval | Post the user's answer to resume the pending permission gate |
| Confirmation | Show a fabricated reference and an explicit simulation label |
| Cancel | Update the displayed simulated receipt |

State lives in React memory and resets on page reload. Theme preference is stored locally. There are no user accounts.

## Implementation limits

The deterministic gate checks budget, stops, duration, and currency compatibility. It does not enforce departure or arrival time windows from the request.

Live impact hints, close-call signals, and direct links to individual settings remain design intent. The "Why this rank" disclosure shows classification reasons, which may be empty for an eligible offer.

See the [technical design](../HLD-Phase4-Web-UI.md) and [interaction brief](../UX-Interaction-Brief-Phase4.md) before changing the browser-to-agent contract.
