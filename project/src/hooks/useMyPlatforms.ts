import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'neox.platforms.v1';

function read(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

/**
 * The user's preferred streaming platforms, persisted locally. Powers the
 * "only on my platforms" filter — set once, reused everywhere.
 */
export function useMyPlatforms() {
  const [ids, setIds] = useState<number[]>(read);

  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const persist = useCallback((next: number[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setIds(next);
  }, []);

  const toggle = useCallback(
    (id: number) =>
      persist(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
    [ids, persist],
  );

  const has = useCallback((id: number) => ids.includes(id), [ids]);
  const clear = useCallback(() => persist([]), [persist]);

  return { ids, has, toggle, clear };
}
