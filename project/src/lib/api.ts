import type {
  AuthResponse,
  Genre,
  HomePayload,
  LibraryEntry,
  Locale,
  MediaDetails,
  MediaItem,
  MediaType,
  Paginated,
  Person,
  Provider,
  SearchResults,
  SeasonDetail,
  User,
} from './types';
import { createTranslator, langFromLocale } from './i18n/core';
import { DEFAULT_LOCALE, detectLocale } from './locales';

// `??`, not `||`: an explicitly empty VITE_API_URL means "same origin", the
// production image serves the API under /api behind the same host, so requests
// stay relative and never need CORS. Unset still falls back to the dev API.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

// Catalogue locale (region + language), initialized from storage so the very
// first request already uses the user's preference.
const LOCALE_KEY = 'neox.locale.v1';

function readLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    if (raw) return { ...DEFAULT_LOCALE, ...(JSON.parse(raw) as Partial<Locale>) };
  } catch {
    // No usable storage (private mode…): don't try to persist a guess either.
    return DEFAULT_LOCALE;
  }
  // First visit: follow the browser's language instead of imposing French on
  // everyone. Persisted immediately so the choice stays stable even if the
  // browser's language list changes later.
  const detected = detectLocale(
    typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [],
  );
  try {
    localStorage.setItem(LOCALE_KEY, JSON.stringify(detected));
  } catch {
    /* stateless session still gets the right language for now */
  }
  return detected;
}

let locale: Locale = readLocale();

// Local translator for transport-level error messages. Built from `core` (which
// does not import this module) to avoid an import cycle with lib/i18n.
const tApi = createTranslator(langFromLocale(locale.language));

export function getLocale() {
  return locale;
}

export function setLocale(next: Locale) {
  locale = next;
  localStorage.setItem(LOCALE_KEY, JSON.stringify(next));
}

/** Appends the active region + language to a path's query string. */
function withLocale(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}region=${encodeURIComponent(locale.region)}&lang=${encodeURIComponent(
    locale.language,
  )}`;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// Dispatched when an authenticated request comes back 401 (token expired or
// revoked). AuthContext listens for it to clear `user` and stop background
// syncs, so the UI doesn't stay "logged in" until the next reload.
export const UNAUTHORIZED_EVENT = 'neox:unauthorized';

// Auth token is held in module scope and mirrored to localStorage so every
// request picks it up without prop drilling.
const TOKEN_KEY = 'neox.token';
let authToken: string | null = localStorage.getItem(TOKEN_KEY);

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return authToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(tApi('api.network'), 0);
  }

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const data = body as { error?: string; code?: string } | null;
    if (response.status === 401) {
      // A 401 on a login attempt (no token yet) is not a session drop, so only
      // broadcast when we actually had a token that just became invalid.
      const wasAuthed = Boolean(authToken);
      setAuthToken(null);
      if (wasAuthed && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
    }
    throw new ApiError(
      data?.error || tApi('api.server', { status: response.status }),
      response.status,
      data?.code,
    );
  }

  return body as T;
}

export interface DiscoverOpts {
  genre?: number;
  sort?: string;
  page?: number;
  providers?: number[];
  region?: string;
  year?: number;
  minRating?: number;
}

export const api = {
  home: () => request<HomePayload>(withLocale('/api/home')),

  search: (query: string, page = 1) =>
    request<SearchResults>(withLocale(`/api/search?q=${encodeURIComponent(query)}&page=${page}`)),

  trending: (mediaType: 'all' | MediaType, window: 'day' | 'week' = 'week') =>
    request<Paginated<MediaItem>>(withLocale(`/api/trending/${mediaType}?window=${window}`)),

  genres: (mediaType: MediaType) =>
    request<{ genres: Genre[] }>(withLocale(`/api/genres/${mediaType}`)),

  providers: (mediaType: MediaType) =>
    request<{ providers: Provider[] }>(withLocale(`/api/providers/${mediaType}`)),

  discover: (mediaType: MediaType, opts: DiscoverOpts = {}) => {
    const params = new URLSearchParams();
    if (opts.genre) params.set('genre', String(opts.genre));
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.providers?.length) params.set('providers', opts.providers.join(','));
    if (opts.year) params.set('year', String(opts.year));
    if (opts.minRating) params.set('minRating', String(opts.minRating));
    const qs = params.toString();
    return request<Paginated<MediaItem>>(withLocale(`/api/discover/${mediaType}${qs ? `?${qs}` : ''}`));
  },

  details: (mediaType: MediaType, id: number) =>
    request<MediaDetails>(withLocale(`/api/${mediaType}/${id}`)),

  season: (tvId: number, seasonNumber: number) =>
    request<SeasonDetail>(withLocale(`/api/tv/${tvId}/season/${seasonNumber}`)),

  person: (id: number) => request<Person>(withLocale(`/api/person/${id}`)),

  recommendations: (seeds: { id: number; mediaType: MediaType }[]) =>
    request<{ results: MediaItem[] }>(withLocale('/api/recommendations'), {
      method: 'POST',
      body: JSON.stringify({ seeds }),
    }),

  // ── Auth ──
  register: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<AuthResponse>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: (password: string) =>
    request<{ ok: boolean }>('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  // ── Library sync ──
  getLibrary: () => request<{ entries: LibraryEntry[] }>('/api/library'),

  putLibrary: (entries: LibraryEntry[]) =>
    request<{ entries: LibraryEntry[] }>('/api/library', {
      method: 'PUT',
      body: JSON.stringify({ entries }),
    }),

  mergeLibrary: (entries: LibraryEntry[]) =>
    request<{ entries: LibraryEntry[] }>('/api/library/merge', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    }),
};
