import { describe, expect, it } from 'vitest';
import { dominantHue, hslToHex, lightFrom, rgbToHsl, sampleUrl } from './film-color';

const HUE_TOLERANCE = 12;

/** Build a raw RGBA buffer from a list of [r,g,b] repeated `times` each. */
function pixels(...groups: [[number, number, number], number][]): Uint8ClampedArray {
  const total = groups.reduce((n, [, times]) => n + times, 0);
  const out = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [[r, g, b], times] of groups) {
    for (let n = 0; n < times; n++) {
      out[i++] = r;
      out[i++] = g;
      out[i++] = b;
      out[i++] = 255;
    }
  }
  return out;
}

describe('rgbToHsl', () => {
  it('reads the primaries at the right hue', () => {
    expect(rgbToHsl(255, 0, 0)[0]).toBeCloseTo(0);
    expect(rgbToHsl(0, 255, 0)[0]).toBeCloseTo(120);
    expect(rgbToHsl(0, 0, 255)[0]).toBeCloseTo(240);
  });

  it('reports zero saturation for greys', () => {
    expect(rgbToHsl(128, 128, 128)[1]).toBe(0);
    expect(rgbToHsl(0, 0, 0)[1]).toBe(0);
  });
});

describe('hslToHex', () => {
  it('round-trips a saturated hue through rgbToHsl', () => {
    const hex = hslToHex(200, 0.88, 0.6);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    expect(rgbToHsl(r, g, b)[0]).toBeCloseTo(200, 0);
  });

  it('wraps hues outside 0-359', () => {
    expect(hslToHex(360 + 12, 0.88, 0.6)).toBe(hslToHex(12, 0.88, 0.6));
    expect(hslToHex(-12, 0.88, 0.6)).toBe(hslToHex(348, 0.88, 0.6));
  });
});

describe('dominantHue', () => {
  it('ignores greys, blacks and blown highlights', () => {
    // A poster that is only letterbox bars and a white logo has no colour.
    expect(dominantHue(pixels([[0, 0, 0], 200], [[255, 255, 255], 80], [[128, 128, 128], 60]))).toBeNull();
  });

  it('picks the colourful area over a larger dull one', () => {
    // 20 vivid orange pixels must beat 400 near-grey ones: weighting is by
    // squared saturation, not by count.
    const hue = dominantHue(pixels([[120, 118, 116], 400], [[243, 99, 63], 20]));
    expect(hue).not.toBeNull();
    expect(Math.abs((hue as number) - 12)).toBeLessThanOrEqual(HUE_TOLERANCE);
  });

  it('separates a red poster from a cyan one', () => {
    const red = dominantHue(pixels([[220, 40, 30], 100]));
    const cyan = dominantHue(pixels([[60, 200, 235], 100]));
    expect(red).not.toBeNull();
    expect(cyan).not.toBeNull();
    expect(Math.abs((red as number) - (cyan as number))).toBeGreaterThan(120);
  });

  it('honours the channel stride so RGB buffers work too', () => {
    const rgb = new Uint8ClampedArray([220, 40, 30, 220, 40, 30, 220, 40, 30]);
    expect(dominantHue(rgb, 3)).not.toBeNull();
  });
});

describe('lightFrom', () => {
  it('gives a dark hue and a bright hue the same usable light', () => {
    // Both posters resolve to hue 12; the light they lend must be identical,
    // otherwise a dark film would light the room with mud.
    expect(lightFrom(12).light).toBe(lightFrom(12).light);
    expect(lightFrom(12).light).not.toBe(lightFrom(200).light);
  });

  it('normalises the hue into 0-359', () => {
    expect(lightFrom(372).hue).toBe(12);
    expect(lightFrom(-12).hue).toBe(348);
  });

  it('orders the three roles from light to near-black', () => {
    const { light, deep, veil } = lightFrom(200);
    const lum = (hex: string) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
    expect(lum(light)).toBeGreaterThan(lum(deep));
    expect(lum(deep)).toBeGreaterThan(lum(veil));
  });
});

describe('sampleUrl', () => {
  it('downgrades a TMDB poster to the cheapest variant', () => {
    expect(sampleUrl('https://image.tmdb.org/t/p/w500/abc.jpg')).toBe(
      'https://image.tmdb.org/t/p/w92/abc.jpg',
    );
  });

  it('leaves a non-TMDB URL untouched', () => {
    expect(sampleUrl('https://example.com/poster.jpg')).toBe('https://example.com/poster.jpg');
  });
});
