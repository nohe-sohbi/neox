import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, getLocale, setLocale } from '../lib/api';
import {
  DEFAULT_PREFERENCES,
  localeChanged,
  readPreferences,
  resolvePreferences,
  sanitizePreferences,
  writePreferences,
  type Preferences,
} from '../lib/preferences';
import { useAuth } from './AuthContext';

interface PreferencesContextValue {
  preferences: Preferences;
  /** Applies a patch locally and pushes it to the account, debounced. */
  update: (patch: Partial<Preferences>) => void;
  /** Same, but resolves once the account has it: for callers about to reload. */
  updateNow: (patch: Partial<Preferences>) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 800;

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);

  // The debounced push reads from a ref: it fires after the state that
  // scheduled it has already been replaced by a newer patch.
  const latest = useRef(preferences);
  const pushTimer = useRef<ReturnType<typeof setTimeout>>();
  const prevUserId = useRef<string | null>(null);

  const commit = useCallback((next: Preferences) => {
    latest.current = next;
    setPreferences(next);
    writePreferences(next);
  }, []);

  const push = useCallback(async () => {
    if (!user) return;
    const sent = latest.current;
    try {
      const { preferences: saved } = await api.putPreferences(sent);
      // Adopt the server's timestamp so both sides agree on "when". Without it,
      // local time and server time drift apart: a change that never made it up
      // (offline) would look older than an untouched server copy at the next
      // login, and be dropped instead of pushed. Skipped when a newer edit
      // landed while this push was in flight, which would otherwise echo the
      // server's now-stale copy back over it.
      if (latest.current === sent) commit(sanitizePreferences(saved));
    } catch {
      /* offline-tolerant: the local copy stays authoritative and the next
         change (or the next login) pushes it up */
    }
  }, [user, commit]);

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      commit(sanitizePreferences({ ...latest.current, ...patch, updatedAt: Date.now() }));
      clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => void push(), PUSH_DEBOUNCE_MS);
    },
    [commit, push],
  );

  const updateNow = useCallback(
    async (patch: Partial<Preferences>) => {
      commit(sanitizePreferences({ ...latest.current, ...patch, updatedAt: Date.now() }));
      clearTimeout(pushTimer.current);
      await push();
    },
    [commit, push],
  );

  // On login (or user switch), reconcile this device with the account: most
  // recently touched wins, an account that never saved anything adopts what is
  // on this device. On logout, drop the account's settings from this device so
  // the next person doesn't inherit them (and doesn't push them into their own
  // account), keeping only the active locale: switching someone's UI language
  // as a side effect of signing out would be its own bug.
  useEffect(() => {
    const uid = user?.id ?? null;
    const previous = prevUserId.current;
    prevUserId.current = uid;

    if (uid && uid !== previous) {
      void (async () => {
        try {
          const { preferences: remote } = await api.getPreferences();
          const server = remote ? sanitizePreferences(remote) : null;
          const { preferences: winner, push: shouldPush } = resolvePreferences(latest.current, server);

          commit(winner);
          if (shouldPush) await push();

          // The catalogue locale is read once at boot (see lib/i18n), so adopting
          // the account's region/language means reloading, exactly like the
          // locale switcher does. Local storage already holds the winner, so the
          // reloaded app agrees with the account and does not loop.
          if (localeChanged(winner, getLocale())) {
            setLocale({ region: winner.region, language: winner.language });
            window.location.reload();
          }
        } catch {
          /* keep local preferences on failure */
        }
      })();
    } else if (!uid && previous) {
      clearTimeout(pushTimer.current);
      commit({
        ...DEFAULT_PREFERENCES,
        region: latest.current.region,
        language: latest.current.language,
      });
    }
  }, [user, commit, push]);

  // Another tab changed the preferences: adopt them, without pushing back.
  useEffect(() => {
    const onStorage = () => commit(readPreferences());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [commit]);

  useEffect(() => () => clearTimeout(pushTimer.current), []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ preferences, update, updateNow }),
    [preferences, update, updateNow],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
