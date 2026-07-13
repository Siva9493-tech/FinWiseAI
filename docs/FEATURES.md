# Features

A complete, implementation-accurate list of what FinWise AI does. Every item below maps to actual code in this repository — no roadmap items are listed here as if they were shipped (those live under [Future-Ready Architecture](#future-ready-architecture)).

---

## Design Principle: Deterministic Numbers, AI Reasoning

FinWise AI draws a hard line between **calculation** and **advice**:

- All financial figures (loan eligibility, EMI, credit health, approval odds) are computed **locally** by pure functions in [`src/utils/`](../app/src/utils/) using standard, auditable formulas.
- The AI layer only **explains and recommends**. It receives the already-computed results as read-only facts and is explicitly instructed never to recalculate or contradict them.

This makes every number reproducible and every AI response grounded.

---

## Core Modules

| Module | Route | Engine | What it produces |
|---|---|---|---|
| Loan Eligibility Checker | `/loan-eligibility` | [`utils/loan.ts`](../app/src/utils/loan.ts) | Eligible amount, risk band, DTI, indicative EMI, decision + reasons |
| Credit Score Analyzer | `/credit-score` | [`utils/credit.ts`](../app/src/utils/credit.ts) | Rating band, 0–100 financial-health index, approval probability, factors, tips |
| EMI Calculator | `/emi-calculator` | [`utils/emi.ts`](../app/src/utils/emi.ts) | Monthly EMI, total interest, total payment, principal/interest split |
| AI Financial Advisor | `/ai-advisor` | [`services/ai.ts`](../app/src/services/ai.ts) | Streamed, structured Markdown advice grounded in the above results |
| Financial Dashboard | `/dashboard` | [`pages/dashboard.astro`](../app/src/pages/dashboard.astro) | KPI overview, quick actions, recent activity, AI insights preview |
| Analysis History | `/history` | [`services/history.ts`](../app/src/services/history.ts) | Cloud-synced record list with search, filter, and detail modal |

### Loan Eligibility Checker

- Reducing-balance EMI formula: `EMI = P·r·(1+r)^n / ((1+r)^n − 1)`.
- Risk banding by credit score: `≥750 low`, `≥700 medium`, `≥650 borderline`, `<650 high`.
- Interest rate = base rate per purpose (home 8.5% → business 14%) adjusted by risk band, floored at 8%.
- Eligible amount derived by inverting the EMI formula against a FOIR ceiling of 50% of income minus existing EMIs.
- Three-way decision — **Eligible**, **Eligible with Conditions**, or **Not Eligible** — each with human-readable reasons and a concrete next action.
- Hard rejection rules: age outside 21–60, income below ₹20,000/month, credit score below 650, or existing EMIs already consuming available capacity.

### Credit Score Analyzer

- Five rating bands: Excellent (≥800), Very Good (≥740), Good (≥670), Fair (≥580), Poor (≥300).
- Composite **financial-health index (0–100)** — a weighted blend: credit score 50%, utilization 20%, DTI 20%, recent enquiries 5%, active loans 5%.
- **Approval probability** from a band baseline adjusted by utilization, DTI, enquiry count, and active-loan count (clamped 3–98%).
- Generates positive factors, negative factors, and specific improvement tips.
- Estimated time-to-improve message per band.

### EMI Calculator

- Shares the exact same `calculateEmi()` core as the Loan module, so the two can never disagree on a value.
- Accepts tenure in months or years; supports five loan types.
- Returns monthly EMI, total payment, total interest, and the principal-vs-interest percentage split for visualization.

---

## AI Features

- **Single entry point** — the whole app calls only `generateFinancialAdvice()` in [`services/ai.ts`](../app/src/services/ai.ts).
- **Provider abstraction** — the active provider is selected in one line in [`services/provider.ts`](../app/src/services/provider.ts); the current implementation is Groq (`llama-3.3-70b-versatile`).
- **Server-side streaming** — advice streams token-by-token over `text/plain` from `/api/advice`, parsed from Groq's SSE stream, and rendered progressively in the browser.
- **Grounded prompting** — [`advisor-prompt.ts`](../app/src/services/advisor-prompt.ts) injects the user's deterministic results as authoritative facts and enforces a fixed four-heading output: **Financial Advice / Risks / Suggestions / Action Plan**.
- **Bounded input** — questions are capped at 500 characters and validated server-side.
- **Graceful interruption** — a disconnected request aborts the upstream stream via `AbortSignal`; interrupted responses append a readable warning instead of throwing.
- **Session history** — the current session's Q&A turns are kept in memory for the advisor UI.

---

## Dashboard Features

- KPI cards, welcome header, quick-action shortcuts to each tool, a recent-activity feed, and an AI-insights preview panel.
- Built from dedicated components under [`components/dashboard/`](../app/src/components/dashboard/) inside a shared `DashboardLayout`.

---

## History Features

- **Offline-first**: every completed analysis is written to `localStorage` first, then pushed to the cloud.
- **Search & filter** over the record list, with a detail modal showing the full stored result.
- **Automatic reconciliation**: when online with a configured backend, Google Sheets is treated as the source of truth — the local mirror is replaced with cloud records plus any still-pending offline records.
- **Sync status tracking** per record (`synced` / `pending` / `error`) with retry accounting.
- Local mirror is capped at 100 records to stay within storage limits.

---

## Google Sheets Integration

- A Google Apps Script Web App ([`docs/google-apps-script.gs`](../app/docs/google-apps-script.gs)) acts as a serverless CRUD backend over a Google Sheet.
- The browser never sees the script URL — it calls the app's own `/api/history` endpoint, which proxies to Apps Script server-side.
- **Upsert by `id`** so re-saving a record updates its row rather than duplicating it.
- Records carry both denormalized summary columns (for quick listing) and a full JSON snapshot column.
- **Automatic background sync** on `window.online`, plus an opportunistic flush ~1.5s after load if a queue exists.
- Fully optional: with no `GOOGLE_SCRIPT_URL`, history works entirely locally.

---

## Security

- **No secrets in the client bundle** — `GROQ_API_KEY`, `GOOGLE_SCRIPT_URL`, and `GOOGLE_SCRIPT_TOKEN` are read only in server-only modules and are never prefixed with `PUBLIC_`.
- **Server-only API routes** — `/api/advice` and `/api/history` set `export const prerender = false` so keys never ship to the browser.
- **Server-side sanitization** — every incoming history record is validated in [`googleSheets.ts`](../app/src/services/googleSheets.ts): control characters stripped, string lengths capped (2000 chars; advice 8000), unknown fields dropped, `source` validated against a union, and `id` required.
- **Optional shared secret** — `GOOGLE_SCRIPT_TOKEN` authenticates writes to the Apps Script backend.
- **No detail leakage** — provider/config errors are logged server-side but returned to the client as generic messages.
- Response headers `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` on API responses.

---

## Accessibility

- Semantic HTML from Astro components with labeled form fields via the shared [`Field.astro`](../app/src/components/Field.astro).
- Inline SVG icons through a single [`Icon.astro`](../app/src/components/Icon.astro) registry (Lucide), keeping icons crisp and screen-reader friendly.
- Progressive enhancement: pages are fully pre-rendered HTML; interactivity is layered on with small `<script>` blocks.
- Toast notifications and loading skeletons provide clear, non-blocking status feedback.

---

## Responsive Design

- Tailwind CSS v4 with `@theme` design tokens defined in [`global.css`](../app/src/styles/global.css).
- Dark-first, glassmorphic SaaS aesthetic that adapts from mobile to desktop (see [`docs/screenshots/mobile_view.png`](screenshots/mobile_view.png)).

---

## Future-Ready Architecture

These are intentional extension points, not yet-shipped features:

- **Swap AI providers in one line** — implement the `AiProvider` interface (e.g. a Claude provider) and repoint `provider.ts`.
- **Rich result contracts** — each engine returns a deliberately detailed result object so future advisors (e.g. EMI optimization) can consume it without recomputation.
- **Versioned records** — every history record is stamped with `RECORD_VERSION` to support schema migrations.
- Planned next steps (auth, charts, PWA, Playwright E2E) are tracked in the project [README](../README.md#future-improvements).
