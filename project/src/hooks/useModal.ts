import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Accessibility plumbing shared by every modal/dialog.
 *
 * While `open`, it:
 *   - locks background scroll,
 *   - closes on Escape,
 *   - traps Tab focus inside the dialog (so keyboard/screen-reader users can't
 *     wander behind the overlay),
 *   - moves focus into the dialog on open (unless something inside already has
 *     it, e.g. an `autoFocus` field), and
 *   - restores focus to the previously focused element on close.
 *
 * Attach the returned ref to the dialog container and give it
 * `role="dialog" aria-modal="true"` plus a label. Listeners live on that node,
 * so stacked dialogs never fight over the same keystroke — only the one holding
 * focus reacts.
 */
export function useModal<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return undefined;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = (): HTMLElement[] =>
      node
        ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null || el === document.activeElement,
          )
        : [];

    // Pull focus into the dialog unless it's already there.
    if (node && !node.contains(document.activeElement)) {
      (focusables()[0] ?? node).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node?.addEventListener('keydown', onKeyDown);
    return () => {
      node?.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return ref;
}
