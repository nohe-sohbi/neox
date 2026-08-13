import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareUrl } from './share';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shareUrl', () => {
  it('prefers the system share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });

    expect(await shareUrl('Fight Club', 'https://neox.app/?watch=movie-550')).toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: 'Fight Club',
      url: 'https://neox.app/?watch=movie-550',
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('treats a dismissed share sheet as a non-event, not a copy', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('user aborted', 'AbortError'));
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });

    expect(await shareUrl('T', 'https://x')).toBe('dismissed');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies to the clipboard when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    expect(await shareUrl('T', 'https://x')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://x');
  });

  it('falls back to the clipboard when sharing fails for real reasons', async () => {
    const share = vi.fn().mockRejectedValue(new Error('no targets'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });

    expect(await shareUrl('T', 'https://x')).toBe('copied');
  });

  it('reports failure when neither channel works', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    expect(await shareUrl('T', 'https://x')).toBe('failed');
  });
});
