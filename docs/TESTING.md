# Testing

FinWise AI is verified through **manual, scenario-based testing** across functional flows, API behavior, responsiveness, browsers, AI streaming, cloud sync, and deployment. This document lists the test cases, the exact inputs used, and the expected outputs — all derived from the deterministic logic in [`src/utils/`](../app/src/utils/) and the endpoints in [`src/pages/api/`](../app/src/pages/api/).

> The calculators are pure functions, so every numeric expectation below is reproducible: the same input always yields the same output.

---

## Functional Testing

| # | Module | Scenario | Expected Output |
|---|---|---|---|
| F1 | Loan Eligibility | Age 30, income ₹80,000, score 780, purpose home, amount within limit, low existing EMI | **Eligible** (green), Low Risk, positive reasons, "You can proceed" |
| F2 | Loan Eligibility | Age 30, income ₹80,000, score 710 (medium), amount within limit | **Eligible with Conditions** (yellow), medium-band reason |
| F3 | Loan Eligibility | Age 18 | **Not Eligible** (red) — age must be 21–60 |
| F4 | Loan Eligibility | Income ₹15,000 | **Not Eligible** — below ₹20,000 minimum |
| F5 | Loan Eligibility | Credit score 600 | **Not Eligible** — High Risk (score < 650) |
| F6 | Credit Analyzer | Score 810, utilization 15%, low DTI | Rating **Excellent**, Very Low Risk, high health index & approval probability |
| F7 | Credit Analyzer | Score 640 | Rating **Fair**, High Risk, improvement tips generated |
| F8 | EMI Calculator | ₹10,00,000 @ 9% for 20 years | Monthly EMI ≈ **₹8,997**, principal + interest split shown |
| F9 | AI Advisor | Ask a question after running a calculator | Streamed Markdown with four headings, referencing the actual figures |
| F10 | AI Advisor | Submit empty question | Blocked with validation message (no request sent / `400`) |
| F11 | History | Complete an analysis | Record appears in History; status `pending` → `synced` (if cloud configured) |
| F12 | Notifications | Any auto-save | Toast confirms save / sync status |

---

## API Testing

### `POST /api/advice`

| Input | Expected |
|---|---|
| Valid `{ question, context }` | `200`, streamed `text/plain` Markdown |
| Invalid JSON body | `400 { "error": "Invalid request body." }` |
| Missing question | `400 { "error": "A question is required." }` |
| Question > 500 chars | `400` length error |
| Missing/invalid `GROQ_API_KEY` | `503` "temporarily unavailable" |

```bash
curl -N -X POST http://localhost:4321/api/advice \
  -H "Content-Type: application/json" \
  -d '{"question":"Is this loan affordable?","context":{}}'
```

### `GET /api/history`

| Condition | Expected |
|---|---|
| Backend configured | `200 { ok:true, configured:true, records:[...] }` (newest first) |
| No backend configured | `200 { ok:true, configured:false, records:[] }` |
| Apps Script unreachable | `502 { ok:false, error:"Could not load cloud history." }` |

### `POST /api/history`

| Input | Expected |
|---|---|
| Valid `{ record }` | `200 { ok:true }` (upsert by id) |
| Record missing `id` | `400 { ok:false, ... }` (not retriable) |
| Backend 5xx / timeout | `502` (retriable) |
| No `GOOGLE_SCRIPT_URL` | `503` "Saved locally." |

---

## Responsive Testing

| Breakpoint | Target | Checks |
|---|---|---|
| Mobile (~375px) | Phones | Stacked layout, tappable controls, readable text (see [`mobile_view.png`](screenshots/mobile_view.png)) |
| Tablet (~768px) | iPad | Two-column grids reflow cleanly |
| Desktop (≥1280px) | Laptop/monitor | Full dashboard + sidebar layout |

---

## Browser Testing

| Browser | Status |
|---|---|
| Chrome | ✅ Verified |
| Edge | ✅ Verified |
| Firefox | ✅ Streaming + localStorage work |

Streaming (`ReadableStream`), `localStorage`, and `navigator.onLine` are all standard and behave consistently across modern evergreen browsers.

---

## AI Testing

- **Grounding**: advice references the exact figures from the user's results and never recalculates them.
- **Structure**: output always uses the four headings (Financial Advice / Risks / Suggestions / Action Plan).
- **Streaming**: text appears progressively, not in one block.
- **Abort**: navigating away mid-stream cancels the upstream Groq request (via `AbortSignal`).
- **Interruption**: an upstream failure after streaming begins appends the ⚠️ warning line instead of crashing.

---

## Google Sheets Testing

| Scenario | Expected |
|---|---|
| Save with cloud configured | New row appended (or existing row updated) in the sheet |
| Re-save same record `id` | Row is **updated**, not duplicated (upsert) |
| Delete a row in the sheet | On next `loadHistory()`, the record is dropped from the local mirror |
| Save while offline | Record stays `pending`; syncs automatically on reconnect (`window.online`) |
| Malicious/oversized field | Sanitized server-side (stripped/capped) before reaching the sheet |

---

## Deployment Testing

| Check | Expected |
|---|---|
| Vercel build | Completes with no errors; root directory set to `app` |
| Pre-rendered pages | Served as static HTML |
| API routes | `/api/advice` and `/api/history` run as serverless functions |
| Environment variables | `GROQ_API_KEY` present → advisor works in production |
| Secret exposure | No `GROQ_API_KEY` / `GOOGLE_SCRIPT_URL` in the client bundle |

---

## Summary of Expected Outputs

- No build or type errors (`npm run build`, `npx astro check`).
- Deterministic calculators produce identical results for identical inputs.
- AI advisor streams grounded, structured Markdown.
- Cloud sync is idempotent (upsert) and offline-resilient.
- No secrets leak to the client.
