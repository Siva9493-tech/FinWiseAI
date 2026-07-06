// Shared auto-save trigger for the tool pages.
//
// Every calculator/advisor calls persistAnalysis() after producing a result.
// It builds + saves the latest snapshot (locally first, then cloud) and shows a
// single, consistent toast — so the save behavior lives in ONE place, not
// copy-pasted into four forms.

import { autoSave, registerAutoSync } from '../services/history';
import type { AnalysisSource } from '../services/types';
import { showToast } from './toast';

let autoSyncRegistered = false;

/**
 * Persist the current analysis snapshot and notify the user.
 * Never throws — a storage/network failure must not disturb the on-screen
 * results the user just produced.
 */
export async function persistAnalysis(source: AnalysisSource): Promise<void> {
  // Wire up background reconnection sync once per page.
  if (!autoSyncRegistered) {
    registerAutoSync();
    autoSyncRegistered = true;
  }

  try {
    const { savedLocally, synced } = await autoSave(source);
    if (!savedLocally) return; // nothing worth saving yet

    if (synced) {
      showToast('Analysis saved to your cloud history.', { variant: 'success' });
    } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast('You’re offline — saved locally, will sync automatically.', {
        variant: 'info',
      });
    } else {
      showToast('Saved locally. Cloud sync will retry shortly.', { variant: 'info' });
    }
  } catch {
    showToast('Saved locally. We’ll sync it when the connection is back.', {
      variant: 'error',
    });
  }
}
