import { describe, expect, it } from 'vitest';
import { backdropImg, itemPoster, posterImg, stillImg } from './img';

describe('posterImg', () => {
  it('derives a srcset from a TMDB w500 poster URL', () => {
    const out = posterImg('https://image.tmdb.org/t/p/w500/abc.jpg');
    expect(out.srcSet).toBe(
      'https://image.tmdb.org/t/p/w185/abc.jpg 185w, ' +
        'https://image.tmdb.org/t/p/w342/abc.jpg 342w, ' +
        'https://image.tmdb.org/t/p/w500/abc.jpg 500w',
    );
    // Largest variant stays the plain-src fallback.
    expect(out.src).toBe('https://image.tmdb.org/t/p/w500/abc.jpg');
    expect(out.sizes).toContain('vw');
  });

  it('works regardless of the original size token', () => {
    const out = posterImg('https://image.tmdb.org/t/p/original/xyz.png');
    expect(out.srcSet).toContain('w185/xyz.png 185w');
    expect(out.src).toBe('https://image.tmdb.org/t/p/w500/xyz.png');
  });

  it('accepts a custom sizes string', () => {
    expect(posterImg('https://image.tmdb.org/t/p/w500/a.jpg', '120px').sizes).toBe('120px');
  });
});

describe('backdropImg / stillImg widths', () => {
  it('uses backdrop widths and full-viewport sizes by default', () => {
    const out = backdropImg('https://image.tmdb.org/t/p/w1280/bd.jpg');
    expect(out.srcSet).toBe(
      'https://image.tmdb.org/t/p/w780/bd.jpg 780w, https://image.tmdb.org/t/p/w1280/bd.jpg 1280w',
    );
    expect(out.sizes).toBe('100vw');
  });

  it('uses still widths', () => {
    const out = stillImg('https://image.tmdb.org/t/p/w300/st.jpg');
    expect(out.srcSet).toBe(
      'https://image.tmdb.org/t/p/w185/st.jpg 185w, https://image.tmdb.org/t/p/w300/st.jpg 300w',
    );
  });
});

describe('non-TMDB / passthrough', () => {
  it('leaves a non-TMDB URL untouched with no srcset', () => {
    const out = posterImg('https://example.com/poster.jpg');
    expect(out).toEqual({ src: 'https://example.com/poster.jpg' });
    expect(out.srcSet).toBeUndefined();
  });
});

describe('itemPoster', () => {
  it('returns a responsive poster when present', () => {
    expect(itemPoster({ poster: 'https://image.tmdb.org/t/p/w500/a.jpg' })?.src).toBe(
      'https://image.tmdb.org/t/p/w500/a.jpg',
    );
  });

  it('returns null when the item has no poster', () => {
    expect(itemPoster({ poster: null })).toBeNull();
  });
});

describe('intrinsic dimensions', () => {
  // CSS drives the layout, so these only give the browser the aspect ratio
  // before the stylesheet applies. Wrong values would reserve the wrong box.
  it('sizes a poster to the 2:3 of its largest variant', () => {
    const out = posterImg('https://image.tmdb.org/t/p/w500/a.jpg');
    expect([out.width, out.height]).toEqual([500, 750]);
  });

  it('sizes a backdrop and a still to 16:9', () => {
    expect(backdropImg('https://image.tmdb.org/t/p/w1280/a.jpg').width).toBe(1280);
    expect(backdropImg('https://image.tmdb.org/t/p/w1280/a.jpg').height).toBe(720);
    expect(stillImg('https://image.tmdb.org/t/p/w300/a.jpg').height).toBe(169);
  });

  it('claims no dimensions for a URL it cannot resize', () => {
    const out = posterImg('https://example.com/poster.jpg');
    expect(out.width).toBeUndefined();
    expect(out.height).toBeUndefined();
  });
});
