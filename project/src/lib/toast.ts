/**
 * Toast model: the pure list helpers behind the notification system.
 *
 * Most user actions in NEOX used to be silent: add to list, remove, import,
 * export, clear. A toast gives lightweight, accessible confirmation ("Added to
 * your list", "Backup saved") without stealing focus. The reducer-style helpers
 * here are framework-agnostic and tested; the React context/timers and the
 * `aria-live` viewport are thin shells over them.
 */
export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/** At most this many toasts on screen; oldest are dropped first. */
export const MAX_TOASTS = 3;

/**
 * Append a toast, collapsing an existing one with the same kind+message (so a
 * repeated action refreshes rather than stacks), and capping the queue. Pure:
 * returns a new list.
 */
export function addToast(list: Toast[], toast: Toast, max = MAX_TOASTS): Toast[] {
  const deduped = list.filter((t) => !(t.kind === toast.kind && t.message === toast.message));
  return [...deduped, toast].slice(-max);
}

export function dismissToast(list: Toast[], id: number): Toast[] {
  return list.filter((t) => t.id !== id);
}
