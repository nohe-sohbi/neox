import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  localeChanged,
  resolvePreferences,
  sanitizePreferences,
  type Preferences,
} from './preferences';

const prefs = (patch: Partial<Preferences> = {}): Preferences => ({
  ...DEFAULT_PREFERENCES,
  ...patch,
});

describe('sanitizePreferences', () => {
  it('returns the defaults for a junk payload', () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences('nope')).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences([1, 2])).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps valid values and drops unknown fields', () => {
    const out = sanitizePreferences({
      platforms: [8, 119],
      region: 'be',
      language: 'fr-BE',
      libraryFilter: 'watched',
      librarySort: 'title_asc',
      isAdmin: true,
    });

    expect(out).toEqual({
      platforms: [8, 119],
      region: 'BE',
      language: 'fr-BE',
      libraryFilter: 'watched',
      librarySort: 'title_asc',
      updatedAt: 0,
    });
  });

  it('folds a partial payload onto the current preferences', () => {
    const current = prefs({ platforms: [8], region: 'CA', librarySort: 'year_desc' });

    expect(sanitizePreferences({ libraryFilter: 'want' }, current)).toMatchObject({
      platforms: [8],
      region: 'CA',
      librarySort: 'year_desc',
      libraryFilter: 'want',
    });
  });

  it('keeps the previous value when a field is invalid, instead of resetting it', () => {
    const current = prefs({ region: 'DE', librarySort: 'title_asc' });

    const out = sanitizePreferences({ region: 'Deutschland', librarySort: 'by_vibes' }, current);

    expect(out.region).toBe('DE');
    expect(out.librarySort).toBe('title_asc');
  });

  it('rejects non-integer platform ids and dedupes', () => {
    const out = sanitizePreferences({ platforms: ['8', 8, 0, -3, 'netflix', 119] });

    expect(out.platforms).toEqual([8, 119]);
  });

  it('caps the platform list', () => {
    const out = sanitizePreferences({
      platforms: Array.from({ length: 100 }, (_, i) => i + 1),
    });

    expect(out.platforms).toHaveLength(40);
  });
});

describe('resolvePreferences', () => {
  it('pushes local preferences when the account has none', () => {
    const local = prefs({ platforms: [8], updatedAt: 10 });

    expect(resolvePreferences(local, null)).toEqual({ preferences: local, push: true });
  });

  it('adopts the account when this device never touched its preferences', () => {
    const server = prefs({ platforms: [119], region: 'CA', updatedAt: 5 });

    const { preferences, push } = resolvePreferences(prefs(), server);

    expect(preferences).toEqual(server);
    expect(push).toBe(false);
  });

  it('keeps the most recently touched side', () => {
    const local = prefs({ platforms: [8], updatedAt: 200 });
    const server = prefs({ platforms: [119], updatedAt: 100 });

    expect(resolvePreferences(local, server)).toEqual({ preferences: local, push: true });
    expect(resolvePreferences(prefs({ updatedAt: 50 }), server).preferences).toEqual(server);
  });

  it('lets the account win a tie, so two devices converge instead of ping-ponging', () => {
    const server = prefs({ platforms: [119], updatedAt: 100 });

    expect(resolvePreferences(prefs({ updatedAt: 100 }), server)).toEqual({
      preferences: server,
      push: false,
    });
  });
});

describe('localeChanged', () => {
  it('detects a region or language difference', () => {
    expect(localeChanged(prefs(), prefs())).toBe(false);
    expect(localeChanged(prefs(), prefs({ region: 'BE' }))).toBe(true);
    expect(localeChanged(prefs(), prefs({ language: 'en-US' }))).toBe(true);
  });
});
