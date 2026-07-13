# API Reference

FinWise AI exposes exactly two HTTP endpoints. Both are **server-only** (`export const prerender = false`) so that secret keys never reach the browser. The client always talks to these routes, never to Groq or Google directly.

| Route | Methods | Purpose | Source |
|---|---|---|---|
| `/api/advice` | `POST` | Stream AI financial advice | [`pages/api/advice.ts`](../app/src/pages/api/advice.ts) |
| `/api/history` | `GET`, `POST` | Read / save analysis records via Google Sheets | [`pages/api/history.ts`](../app/src/pages/api/history.ts) |

---

## `POST /api/advice`

### Purpose

Generate personalized financial advice as a **stream of Markdown text chunks**, grounded in the user's locally-computed results.

### Request

`Content-Type: application/json`

```json
{
  "question": "Should I take this home loan?",
  "context": {
    "loan":   { "...EligibilityResult" },
    "credit": { "...CreditAnalysis" },
    "emi":    { "...EmiResult" }
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `question` | string | Yes | Trimmed; **max 500 characters**. Empty or non-string is rejected. |
| `context` | object | No | Any subset of `loan` / `credit` / `emi` results. Defaults to `{}`. |

The `context` fields are the deterministic result objects produced by the calculators. They are passed as read-only facts to the model — never recomputed.

### Response

`200 OK` — a streamed `text/plain; charset=utf-8` body. Chunks are Markdown fragments emitted as the model generates them, structured under four headings: **Financial Advice**, **Risks**, **Suggestions**, **Action Plan**.

Response headers:

```
Content-Type: text/plain; charset=utf-8
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

If the stream is interrupted mid-flight (e.g. upstream error after streaming began), the body is gracefully terminated with:

```
> ⚠️ The AI response was interrupted. Please try again.
```

### Error Responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{ "error": "Invalid request body." }` | Body is not valid JSON |
| `400` | `{ "error": "A question is required." }` | `question` missing / not a string |
| `400` | `{ "error": "Your question cannot be empty." }` | `question` is blank after trim |
| `400` | `{ "error": "Your question is too long (max 500 characters)." }` | Over the length cap |
| `503` | `{ "error": "The AI advisor is temporarily unavailable. Please try again shortly." }` | Missing/invalid `GROQ_API_KEY` or provider failure |

Configuration and provider errors are logged server-side but never surfaced in detail to the client.

### Streaming Architecture

```
Browser ──POST──▶ /api/advice
                    │  validateQuestion()  (ai.ts)
                    │  buildMessages()     (advisor-prompt.ts)
                    ▼
              activeProvider.streamChat()  (provider.ts → groq.ts)
                    │  fetch Groq  (stream: true, SSE)
                    ▼
              parse SSE  →  yield delta.content chunks
                    ▼
   ReadableStream re-emits chunks ──▶ Browser renders Markdown progressively
```

The browser's `AbortSignal` is wired through to the Groq request, so a disconnect stops upstream generation immediately.

---

## `GET /api/history`

### Purpose

List all analysis records from the cloud (Google Sheets), newest first.

### Response

`200 OK`

```json
{ "ok": true, "configured": true, "records": [ { "...AnalysisRecord" } ] }
```

| Field | Type | Meaning |
|---|---|---|
| `ok` | boolean | Request succeeded |
| `configured` | boolean | Whether a Sheets backend is configured. `false` → client keeps its local mirror as-is |
| `records` | array | Sanitized `AnalysisRecord` objects, newest first |

When no backend is configured, the endpoint returns `{ "ok": true, "configured": false, "records": [] }` so the client knows to preserve local history.

### Error Responses

| Status | Body | Cause |
|---|---|---|
| `502` | `{ "ok": false, "error": "Could not load cloud history." }` | Apps Script unreachable / returned an error |

---

## `POST /api/history`

### Purpose

Persist one analysis record to the cloud (**upsert by `id`**).

### Request

`Content-Type: application/json`

```json
{ "record": { "...AnalysisRecord" } }
```

The `AnalysisRecord` shape (see [`services/types.ts`](../app/src/services/types.ts)) carries denormalized summary columns (`name`, `age`, `income`, `loanAmount`, `creditScore`, `monthlyEMI`, …) plus the full result objects and provenance (`source`, `device`, `version`).

### Response

| Status | Body | Meaning |
|---|---|---|
| `200` | `{ "ok": true }` | Saved to Sheets |
| `400` | `{ "ok": false, "error": "..." }` | Bad data — client should **not** retry (e.g. missing `id`) |
| `502` | `{ "ok": false, "error": "..." }` | Retriable backend failure (5xx / 429 / network / timeout) |
| `503` | `{ "ok": false, "error": "Cloud storage is not configured. Saved locally." }` | No `GOOGLE_SCRIPT_URL` — client keeps the record local |

### Security

- **Server-side sanitization** ([`googleSheets.ts`](../app/src/services/googleSheets.ts)) runs on every incoming record before it is forwarded:
  - `id` is required (else `400`).
  - ASCII control characters are stripped (tab/newline preserved).
  - String lengths are capped (2000 chars; `aiAdviceSummary` 8000; `id` 64).
  - Numbers are coerced and validated (`NaN`/`Infinity` → `null`).
  - Nested result objects are round-tripped through JSON; non-objects become `null`.
  - Unknown fields are dropped; `source` is validated against `'loan' | 'credit' | 'emi' | 'advisor'`.
- **Timeout**: the outbound Apps Script call aborts after 10 seconds.
- **Optional shared secret**: if `GOOGLE_SCRIPT_TOKEN` is set, it is forwarded as a `?token=` query param and checked by the Apps Script.
- Requests to Apps Script use `Content-Type: text/plain` to avoid a CORS preflight.

---

## Server-Side Environment Variables

These are read **only** in server-only modules and are never bundled into client code.

| Variable | Read in | Purpose |
|---|---|---|
| `GROQ_API_KEY` | [`groq.ts`](../app/src/services/groq.ts) | Authenticates the Groq chat-completions request |
| `GOOGLE_SCRIPT_URL` | [`googleSheets.ts`](../app/src/services/googleSheets.ts) | Apps Script Web App `/exec` endpoint |
| `GOOGLE_SCRIPT_TOKEN` | [`googleSheets.ts`](../app/src/services/googleSheets.ts) | Optional shared secret for authenticating writes |

> None are prefixed with `PUBLIC_`, so Astro keeps them off the client. The AI model is fixed to `llama-3.3-70b-versatile` (temperature `0.6`, `max_tokens` `1400`).
