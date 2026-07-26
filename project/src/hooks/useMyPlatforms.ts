import { useCallback } from 'react';
import { usePreferences } from '../context/PreferencesContext';

/**
 * The user's preferred streaming platforms. Powers the "only on my platforms"
 * filter: set once, reused everywhere.
 *
 * Backed by the preferences store, so the list survives on its own on a device
 * with no account, and follows the account onto the next device when there is
 * one. The shape stays deliberately tiny (ids, has, toggle, clear) because
 * that is all the filter UI needs.
 */
export function useMyPlatforms() {
  const { preferences, update } = usePreferences();
  const ids = preferences.platforms;

  const toggle = useCallback(
    (id: number) =>
      update({ platforms: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] }),
    [ids, update],
  );

  const has = useCallback((id: number) => ids.includes(id), [ids]);
  const clear = useCallback(() => update({ platforms: [] }), [update]);

  return { ids, has, toggle, clear };
}
