# Setup

How to run FinWise AI locally, build it, and prepare it for deployment. The Astro application lives inside the [`app/`](../app/) subdirectory — all commands below are run from there unless noted.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 22.12.0 | Enforced via `engines` in [`app/package.json`](../app/package.json) |
| npm | ships with Node | Or use `pnpm` / `yarn` if you prefer |
| Git | any recent | To clone the repository |
| Groq API key | — | Required for the AI advisor — [console.groq.com/keys](https://console.groq.com/keys) |
| Google account | — | Optional — only for cloud history via Google Sheets |

---

## 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/FinWiseAI.git
cd FinWiseAI/app
```

> The project root contains docs and demo assets; the runnable app is in `app/`.

---

## 2. Install Dependencies

```bash
npm install
```

This installs Astro 7, Tailwind CSS v4, the Vercel adapter, and the Lucide icon set.

---

## 3. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | **Yes** | Groq API key for the AI advisor. Read server-side only. |
| `GOOGLE_SCRIPT_URL` | No | Deployed Apps Script Web App `/exec` URL. If unset, history stays local-only. |
| `GOOGLE_SCRIPT_TOKEN` | No | Shared secret to authenticate writes. Must match the Apps Script `SCRIPT_TOKEN` property. |

> **Security:** none of these are prefixed with `PUBLIC_`. Astro only exposes `PUBLIC_*` variables to the client bundle, so these stay server-side and never reach the browser. `.env` is git-ignored — never commit it.

---

## 4. Run Locally

```bash
npm run dev
```

Opens at **http://localhost:4321**. The `/api/advice` and `/api/history` routes run on-demand via the Vercel adapter, so streaming AI and cloud sync work in dev.

---

## 5. Build

```bash
npm run build
```

Produces the production output. Pre-rendered pages become static HTML; only the two API routes are emitted as serverless functions.

---

## 6. Preview

```bash
npm run preview
```

Serves the production build locally so you can validate it before deploying.

---

## Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start the dev server on port 4321 |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npx astro check` | Type-check all `.astro` and `.ts` files |

---

## Deployment Notes

- Deployed on **Vercel** with the `@astrojs/vercel` adapter (already configured in [`astro.config.mjs`](../app/astro.config.mjs)).
- Set the Vercel **root directory** to `app` — the Astro project is not at the repo root.
- Add `GROQ_API_KEY` (and optionally the Google variables) in the Vercel dashboard.
- For full cloud history, deploy the Apps Script in [`docs/google-apps-script.gs`](../app/docs/google-apps-script.gs) and set `GOOGLE_SCRIPT_URL`.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete deployment walkthrough.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| AI advisor returns "temporarily unavailable" | `GROQ_API_KEY` missing or invalid | Set a valid key in `.env` and restart `npm run dev` |
| Engine / Node version error on install | Node < 22.12.0 | Upgrade Node (e.g. via `nvm install 22`) |
| History not syncing to the cloud | `GOOGLE_SCRIPT_URL` unset | Records stay local — this is expected until you configure Sheets |
| History writes rejected (`Unauthorized`) | Token mismatch | Ensure `GOOGLE_SCRIPT_TOKEN` equals the Apps Script `SCRIPT_TOKEN` property |
| Port 4321 already in use | Another dev server running | Stop it, or run `npm run dev -- --port 3000` |
| Type errors after editing | Stale types | Run `npx astro check` to see the full report |
| Changes not showing on Vercel | Wrong root directory | Confirm the Vercel project root is set to `app` |
