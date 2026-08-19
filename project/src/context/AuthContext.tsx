import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getAuthToken, setAuthToken, UNAUTHORIZED_EVENT } from '../lib/api';
import { track } from '../lib/analytics';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Signs every other device out, keeping this one. */
  logoutEverywhere: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Validate an existing token on boot.
  useEffect(() => {
    if (!getAuthToken()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setAuthToken(null))
      .finally(() => setReady(true));
  }, []);

  // A mid-session 401 (expired/revoked token) clears the token in the API layer
  // and fires this event; drop `user` too so the UI reflects the logged-out
  // state immediately instead of waiting for a reload.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setAuthToken(res.token);
    setUser(res.user);
    track('Login');
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api.register(email, password);
    setAuthToken(res.token);
    setUser(res.user);
    track('Signup');
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    // The server revokes every previously issued token and returns a fresh
    // one; keep it so this session survives its own password change.
    const res = await api.changePassword(currentPassword, newPassword);
    setAuthToken(res.token);
  }, []);

  const logoutEverywhere = useCallback(async () => {
    // Same deal as a password change: the call invalidates this device's token
    // too, so keep the replacement it hands back.
    const res = await api.logoutEverywhere();
    setAuthToken(res.token);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await api.deleteAccount(password);
    // Dropping `user` also lets LibraryContext clear this device's copy.
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, changePassword, logoutEverywhere, deleteAccount }),
    [user, ready, login, register, logout, changePassword, logoutEverywhere, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
