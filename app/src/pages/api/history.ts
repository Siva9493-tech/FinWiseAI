import type { APIRoute } from 'astro';
import {
  saveRecord,
  listRecords,
  isConfigured,
  SheetsNotConfigured,
} from '../../services/googleSheets';
import type { HistoryApiResponse } from '../../services/types';

// Runs on-demand on the server (never pre-rendered) so GOOGLE_SCRIPT_URL stays
// server-side. The browser calls this endpoint; only this endpoint calls the
// Apps Script backend.
export const prerender = false;

function json(body: HistoryApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// ---- Save a record ----------------------------------------------------------
export const POST: APIRoute = async ({ request }) => {
  let payload: { record?: unknown };
  try {
    payload = (await request.json()) as { record?: unknown };
  } catch {
    return json({ ok: false, error: 'Invalid request body.' }, 400);
  }

  // No backend configured → tell the client to keep it local (not an error).
  if (!isConfigured()) {
    return json(
      { ok: false, error: 'Cloud storage is not configured. Saved locally.' },
      503
    );
  }

  const outcome = await saveRecord(payload?.record);
  if (outcome.ok) return json({ ok: true }, 200);

  // 400 for bad data (client shouldn't retry), 502 for a retriable backend issue.
  const status = outcome.retriable ? 502 : 400;
  return json({ ok: false, error: outcome.error ?? 'Save failed.' }, status);
};

// ---- List records -----------------------------------------------------------
export const GET: APIRoute = async () => {
  if (!isConfigured()) {
    // No backend → tell the client to keep its local mirror as-is.
    return json({ ok: true, configured: false, records: [] }, 200);
  }

  try {
    const records = await listRecords();
    return json({ ok: true, configured: true, records }, 200);
  } catch (err) {
    if (err instanceof SheetsNotConfigured) {
      return json({ ok: true, configured: false, records: [] }, 200);
    }
    console.error('[history] list error:', (err as Error).message);
    return json({ ok: false, error: 'Could not load cloud history.' }, 502);
  }
};
