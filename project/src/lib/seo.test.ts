import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_URL,
  buildMeta,
  truncate,
} from './seo';

describe('truncate', () => {
  it('collapses whitespace', () => {
    expect(truncate('a   b\n c')).toBe('a b c');
  });

  it('leaves short text untouched', () => {
    expect(truncate('short', 100)).toBe('short');
  });

  it('clips long text with an ellipsis', () => {
    const out = truncate('x'.repeat(50), 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('buildMeta', () => {
  it('falls back to site defaults when given nothing', () => {
    const meta = buildMeta();
    expect(meta.title).toBe(DEFAULT_TITLE);
    expect(meta.description).toBe(DEFAULT_DESCRIPTION);
    expect(meta.type).toBe('website');
    expect(meta.url).toBe(SITE_URL);
  });

  it('suffixes a page title with the brand', () => {
    expect(buildMeta({ title: 'Dune' }).title).toBe('Dune · NEOX');
  });

  it('does not double-suffix when title is blank', () => {
    expect(buildMeta({ title: '   ' }).title).toBe(DEFAULT_TITLE);
  });

  it('truncates long descriptions', () => {
    const meta = buildMeta({ description: 'word '.repeat(100) });
    expect(meta.description.length).toBeLessThanOrEqual(200);
    expect(meta.description.endsWith('…')).toBe(true);
  });

  it('builds an absolute canonical url from a path', () => {
    expect(buildMeta({ path: '/movies' }).url).toBe(`${SITE_URL}/movies`);
    expect(buildMeta({ path: 'tv' }).url).toBe(`${SITE_URL}/tv`);
  });

  it('passes through type and image', () => {
    const meta = buildMeta({ type: 'video.movie', image: 'https://img/x.jpg' });
    expect(meta.type).toBe('video.movie');
    expect(meta.image).toBe('https://img/x.jpg');
  });

  it('ignores an empty image and uses the default', () => {
    expect(buildMeta({ image: '' }).image).toContain(SITE_URL);
    expect(buildMeta({ image: null }).image).toContain(SITE_URL);
  });
});

describe('buildMeta canonical', () => {
  it('resolves a path against the site origin', () => {
    expect(buildMeta({ path: '/movies' }).url).toBe(`${SITE_URL}/movies`);
  });

  // The 404 shell answers for every unknown URL. Falling back to the origin
  // would have each of them declare itself a duplicate of the home page.
  it('claims no URL at all when canonical is refused', () => {
    expect(buildMeta({ canonical: false, path: '/404' }).url).toBeNull();
  });
});
