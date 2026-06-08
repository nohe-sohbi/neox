import type {
  Genre,
  HomePayload,
  MediaDetails,
  MediaItem,
  MediaType,
  Paginated,
} from './types';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError('Impossible de joindre le serveur. Vérifie ta connexion.', 0);
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
    throw new ApiError(
      data?.error || `Erreur serveur (${response.status})`,
      response.status,
      data?.code,
    );
  }

  return body as T;
}

export const api = {
  home: (region?: string) =>
    request<HomePayload>(`/api/home${region ? `?region=${encodeURIComponent(region)}` : ''}`),

  search: (query: string, page = 1) =>
    request<Paginated<MediaItem>>(
      `/api/search?q=${encodeURIComponent(query)}&page=${page}`,
    ),

  genres: (mediaType: MediaType) =>
    request<{ genres: Genre[] }>(`/api/genres/${mediaType}`),

  discover: (
    mediaType: MediaType,
    opts: { genre?: number; sort?: string; page?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.genre) params.set('genre', String(opts.genre));
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.page) params.set('page', String(opts.page));
    const qs = params.toString();
    return request<Paginated<MediaItem>>(`/api/discover/${mediaType}${qs ? `?${qs}` : ''}`);
  },

  details: (mediaType: MediaType, id: number, region?: string) =>
    request<MediaDetails>(
      `/api/${mediaType}/${id}${region ? `?region=${encodeURIComponent(region)}` : ''}`,
    ),
};
