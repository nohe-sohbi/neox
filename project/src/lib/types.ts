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

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  overview: string;
  poster: string | null;
  episodeCount: number;
  airYear: string;
}

export interface Episode {
  episodeNumber: number;
  name: string;
  overview: string;
  still: string | null;
  airDate: string;
  runtime: number | null;
  rating: number | null;
  voteCount: number;
}

export interface SeasonDetail {
  seasonNumber: number;
  name: string;
  overview: string;
  poster: string | null;
  airDate: string;
  episodes: Episode[];
}

/** A crew member as credited on a fiche (director, writer, show creator). */
export interface CrewMember {
  id: number;
  name: string;
  photo: string | null;
}

/**
 * The three crew roles a viewer actually asks about. A film fills
 * `directors`/`writers`, a show fills `creators` (TMDB keeps showrunners out
 * of the crew list); any of them can be empty.
 */
export interface Crew {
  directors: CrewMember[];
  writers: CrewMember[];
  creators: CrewMember[];
}

/** A movie saga: the collection a film belongs to, minus the film itself. */
export interface Collection {
  id: number;
  name: string;
  poster: string | null;
  items: MediaItem[];
}

export interface MediaDetails extends MediaItem {
  tagline: string;
  runtime: number | null;
  status: string;
  genres: string[];
  releaseDate: string;
  /** Age rating issued for the active region, empty when that region has none. */
  certification: string;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  seasons: SeasonSummary[];
  trailerKey: string | null;
  cast: CastMember[];
  crew: Crew;
  providers: WatchProviders;
  recommendations: MediaItem[];
  collection: Collection | null;
}

export interface Paginated<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}

/** Compact person as returned inside search results. */
export interface SearchPerson {
  id: number;
  name: string;
  photo: string | null;
  knownFor: string;
}

export interface SearchResults extends Paginated<MediaItem> {
  people: SearchPerson[];
}

export interface HomeRow {
  id: string;
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

export type LibraryStatus = 'want' | 'watching' | 'watched';

export interface LibraryEntry {
  id: number;
  mediaType: MediaType;
  title: string;
  poster: string | null;
  year: string;
  rating: number | null;
  status: LibraryStatus;
  personalRating: number | null;
  /** Episodes ticked as watched, as "season:episode" codes. TV only, absent when empty. */
  seenEpisodes?: string[];
  /** Free-text note the user wrote about this title. Absent when never written. */
  note?: string;
  /**
   * Minutes: a film's runtime, or one episode's for a show. Captured when the
   * fiche is open (a card never carries it), so it is present on the titles
   * you actually looked at and absent on the rest — which is exactly how the
   * watch-time estimate reports its own coverage.
   */
  runtime?: number;
  addedAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  email: string;
  createdAt: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PersonCredit extends MediaItem {
  character: string;
}

export interface Person {
  id: number;
  name: string;
  biography: string;
  photo: string | null;
  knownFor: string;
  birthday: string | null;
  placeOfBirth: string;
  credits: PersonCredit[];
}

export interface Locale {
  region: string;
  language: string;
}

