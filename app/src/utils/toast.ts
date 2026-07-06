// Reusable toast notifications — glassmorphism, dark SaaS styling.
//
// A single client utility used across the app for transient, non-blocking
// feedback (e.g. "Saved to cloud", "Offline — will sync later"). It lazily
// creates its own container so any page can `import { showToast }` and call it
// without adding markup.

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastOptions {
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Default 4000. */
  duration?: number;
}

const CONTAINER_ID = 'finwise-toast-container';

const ICONS: Record<ToastVariant, string> = {
  success:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
};

function ensureContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

/** Show a transient toast. Safe to call from anywhere on the client. */
export function showToast(message: string, options: ToastOptions = {}): void {
  const container = ensureContainer();
  if (!container) return;

  const variant = options.variant ?? 'info';
  const duration = options.duration ?? 4000;

  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${ICONS[variant]}</span>
    <p class="toast-message"></p>
    <button class="toast-close" type="button" aria-label="Dismiss">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>`;
  // Assign text safely (never innerHTML for the message).
  const messageEl = toast.querySelector('.toast-message');
  if (messageEl) messageEl.textContent = message;

  const dismiss = () => {
    toast.classList.add('toast-leaving');
    window.setTimeout(() => toast.remove(), 220);
  };

  toast.querySelector('.toast-close')?.addEventListener('click', dismiss);
  container.appendChild(toast);

  // Trigger enter animation on next frame.
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  if (duration > 0) window.setTimeout(dismiss, duration);
}
