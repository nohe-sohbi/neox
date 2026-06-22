import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, addToast, dismissToast, type Toast } from './toast';

const toast = (id: number, message: string, kind: Toast['kind'] = 'info'): Toast => ({
  id,
  kind,
  message,
});

describe('addToast', () => {
  it('appends a toast to the end (newest last)', () => {
    const next = addToast([toast(1, 'a')], toast(2, 'b'));
    expect(next.map((t) => t.id)).toEqual([1, 2]);
  });

  it('collapses a duplicate kind+message, keeping the newest', () => {
    const next = addToast([toast(1, 'Added', 'success')], toast(2, 'Added', 'success'));
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(2);
  });

  it('treats same message with different kind as distinct', () => {
    const next = addToast([toast(1, 'Oops', 'success')], toast(2, 'Oops', 'error'));
    expect(next).toHaveLength(2);
  });

  it('caps the queue at the max, dropping the oldest', () => {
    let list: Toast[] = [];
    for (let i = 1; i <= MAX_TOASTS + 2; i++) list = addToast(list, toast(i, `m${i}`));
    expect(list).toHaveLength(MAX_TOASTS);
    expect(list[0].id).toBe(3); // first two dropped
  });

  it('does not mutate the input list', () => {
    const input = [toast(1, 'a')];
    addToast(input, toast(2, 'b'));
    expect(input).toHaveLength(1);
  });
});

describe('dismissToast', () => {
  it('removes the toast with the matching id', () => {
    const next = dismissToast([toast(1, 'a'), toast(2, 'b')], 1);
    expect(next.map((t) => t.id)).toEqual([2]);
  });

  it('is a no-op for an unknown id', () => {
    const next = dismissToast([toast(1, 'a')], 99);
    expect(next).toHaveLength(1);
  });
});
