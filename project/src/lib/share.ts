/**
 * Shares a URL through the system share sheet when available, falling back to
 * copying it to the clipboard. Returns how the URL was delivered so the caller
 * can word its feedback: 'shared' needs no toast (the sheet was the feedback),
 * 'dismissed' means the user changed their mind and wants no feedback at all.
 */
export async function shareUrl(
  title: string,
  url: string,
): Promise<'shared' | 'copied' | 'dismissed' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'dismissed';
      // Any other share failure: fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
