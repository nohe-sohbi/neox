export type MediaType = 'movie' | 'tv';

export interface MediaItem {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: string;
  rating: number | null;
  voteCount: number;
  popularity: number;
}

export interface Provider {
  id: number;
  name: string;
  logo: string | null;
}

export interface WatchProviders {
  link: string | null;
  flatrate: Provider[];
  rent: Provider[];
  buy: Provider[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  photo: string | null;
}

export interface MediaDetails extends MediaItem {
  tagline: string;
  runtime: number | null;
  status: string;
  genres: string[];
  releaseDate: string;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  trailerKey: string | null;
  cast: CastMember[];
  providers: WatchProviders;
  recommendations: MediaItem[];
}

export interface Paginated<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}

export interface HomeRow {
  id: string;
  title: string;
  items: MediaItem[];
}

export interface HomePayload {
  hero: MediaItem[];
  rows: HomeRow[];
  region: string;
}

export interface Genre {
  id: number;
  name: string;
}
