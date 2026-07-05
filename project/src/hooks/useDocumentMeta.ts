import { useEffect } from 'react';
import { applyMeta, buildMeta, restoreMeta, snapshotMeta, type MetaInput } from '../lib/seo';
import { t } from '../lib/i18n';

/**
 * Drive the document head from React. On mount (and whenever the input changes)
 * it snapshots the current head, applies the resolved meta, and restores the
 * snapshot on cleanup — so a detail/person overlay that sets its own title and
 * poster cleanly hands the head back to the underlying page when it closes.
 *
 * The input is serialized for the dependency array so callers can pass a fresh
 * object literal every render without thrashing.
 */
export function useDocumentMeta(input: MetaInput): void {
  const key = JSON.stringify(input);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const snapshot = snapshotMeta();
    // Localize the site-level fallbacks (used on views without their own title,
    // e.g. Home). A language switch hard-reloads, so reading `t` here is safe.
    applyMeta(
      buildMeta(input, {
        title: t('seo.default_title'),
        description: t('seo.default_description'),
      }),
    );
    return () => restoreMeta(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * Declarative wrapper around {@link useDocumentMeta}. Renders nothing — handy
 * for components that early-return before the meta is known (e.g. modals), so
 * the hook is only mounted once the data exists and the rules of hooks hold.
 */
export function DocumentMeta(props: MetaInput): null {
  useDocumentMeta(props);
  return null;
}
