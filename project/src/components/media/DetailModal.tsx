import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Calendar, Check, Clock, Eye, Play, Star, Trash2, Tv, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { MediaDetails, MediaType } from '../../lib/types';
import { useLibrary } from '../../context/LibraryContext';
import { useDetailTarget, useOpenDetail, useOpenPerson } from '../../hooks/useDetailRoute';
import { ErrorState, FullSpinner } from '../ui/States';
import { StarRating } from '../ui/StarRating';
import { WatchProviders } from './WatchProviders';

function runtimeLabel(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
}

export function DetailModal() {
  const { target, close } = useDetailTarget();
  const openDetail = useOpenDetail();
  const openPerson = useOpenPerson();
  const { statusOf, ratingOf, isSaved, setStatus, setRating, remove } = useLibrary();

  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);

  const load = useCallback(async (mediaType: MediaType, id: number) => {
    setLoading(true);
    setError(null);
    try {
      setDetails(await api.details(mediaType, id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!target) return;
    setDetails(null);
    setShowTrailer(false);
    void load(target.mediaType, target.id);
  }, [target, load]);

  useEffect(() => {
    if (!target) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [target, close]);

  if (!target) return null;

  const status = details ? statusOf(details) : null;
  const saved = details ? isSaved(details) : false;
  const personalRating = details ? ratingOf(details) : null;
  const runtime = details ? runtimeLabel(details.runtime) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-0 backdrop-blur-sm sm:p-6"
      onClick={close}
    >
      <div
        className="relative w-full max-w-4xl animate-scale-in overflow-hidden bg-ink-900 shadow-2xl sm:rounded-3xl sm:border sm:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Fermer"
          className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-md transition-all hover:bg-black/80 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {loading && <FullSpinner label="On récupère les infos…" />}

        {error && !loading && (
          <div className="py-10">
            <ErrorState message={error} onRetry={() => load(target.mediaType, target.id)} />
          </div>
        )}

        {details && !loading && (
          <>
            <div className="relative h-56 sm:h-80">
              {showTrailer && details.trailerKey ? (
                <iframe
                  title={`Bande-annonce de ${details.title}`}
                  src={`https://www.youtube.com/embed/${details.trailerKey}?autoplay=1&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <>
                  {details.backdrop ? (
                    <img
                      src={details.backdrop}
                      alt=""
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="h-full w-full bg-ink-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
                  {details.trailerKey && (
                    <button
                      onClick={() => setShowTrailer(true)}
                      className="group absolute inset-0 flex items-center justify-center"
                      aria-label="Lire la bande-annonce"
                    >
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient shadow-glow transition-transform group-hover:scale-110">
                        <Play className="ml-1 h-7 w-7 fill-white text-white" />
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="relative -mt-16 space-y-7 px-5 pb-8 sm:px-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                {details.poster && (
                  <img
                    src={details.poster}
                    alt={details.title}
                    className="hidden w-28 shrink-0 rounded-xl shadow-card ring-1 ring-white/10 sm:block"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-extrabold leading-tight text-white sm:text-4xl">
                    {details.title}
                  </h2>
                  {details.tagline && (
                    <p className="mt-1 text-sm italic text-white/50">{details.tagline}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/70">
                    {details.rating ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-white">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {details.rating.toFixed(1)}
                        <span className="font-normal text-white/40">
                          ({details.voteCount.toLocaleString('fr-FR')})
                        </span>
                      </span>
                    ) : null}
                    {details.releaseDate && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {new Date(details.releaseDate).getFullYear()}
                      </span>
                    )}
                    {runtime && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {runtime}
                      </span>
                    )}
                    {details.numberOfSeasons ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Tv className="h-4 w-4" />
                        {details.numberOfSeasons} saison{details.numberOfSeasons > 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>

                  {details.genres.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {details.genres.map((g) => (
                        <span key={g} className="chip">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions: trailer + library status */}
              <div className="flex flex-wrap items-center gap-3">
                {details.trailerKey && !showTrailer && (
                  <button onClick={() => setShowTrailer(true)} className="btn-primary">
                    <Play className="h-5 w-5 fill-current" />
                    Bande-annonce
                  </button>
                )}
                <button
                  onClick={() => setStatus(details, 'want')}
                  className={
                    status === 'want'
                      ? 'btn-primary'
                      : 'btn-ghost'
                  }
                >
                  <Bookmark className={`h-5 w-5 ${status === 'want' ? 'fill-current' : ''}`} />
                  À voir
                </button>
                <button
                  onClick={() => setStatus(details, 'watched')}
                  className={status === 'watched' ? 'btn-primary' : 'btn-ghost'}
                >
                  {status === 'watched' ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                  {status === 'watched' ? 'Vu' : 'Marquer comme vu'}
                </button>
                {saved && (
                  <button
                    onClick={() => remove(details)}
                    aria-label="Retirer de ma liste"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Personal rating */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-sm font-bold uppercase tracking-wider text-white/50">
                  Ta note
                </p>
                <StarRating value={personalRating} onChange={(r) => setRating(details, r)} />
              </div>

              {details.overview && (
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/50">
                    Synopsis
                  </h3>
                  <p className="leading-relaxed text-white/80">{details.overview}</p>
                </div>
              )}

              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                  Où regarder (légalement)
                </h3>
                <WatchProviders providers={details.providers} />
              </div>

              {details.cast.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                    Casting
                  </h3>
                  <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                    {details.cast.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => openPerson(member.id)}
                        className="group w-20 shrink-0 text-center"
                      >
                        {member.photo ? (
                          <img
                            src={member.photo}
                            alt={member.name}
                            loading="lazy"
                            className="mb-1.5 h-20 w-20 rounded-full object-cover ring-1 ring-white/10 transition-all group-hover:ring-brand-violet/50"
                          />
                        ) : (
                          <div className="mb-1.5 flex h-20 w-20 items-center justify-center rounded-full bg-ink-700 text-lg font-bold text-white/40 transition-all group-hover:ring-1 group-hover:ring-brand-violet/50">
                            {member.name.slice(0, 1)}
                          </div>
                        )}
                        <p className="truncate text-xs font-medium text-white/90 group-hover:text-white">
                          {member.name}
                        </p>
                        <p className="truncate text-[11px] text-white/40">{member.character}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {details.recommendations.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                    Dans le même esprit
                  </h3>
                  <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                    {details.recommendations.map((rec) => (
                      <button
                        key={`${rec.mediaType}-${rec.id}`}
                        onClick={() => openDetail(rec)}
                        className="group w-28 shrink-0 text-left"
                      >
                        <div className="aspect-[2/3] overflow-hidden rounded-lg bg-ink-700 ring-1 ring-white/5 transition-transform group-hover:scale-[1.03]">
                          {rec.poster ? (
                            <img
                              src={rec.poster}
                              alt={rec.title}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <p className="mt-1.5 truncate text-xs font-medium text-white/80">
                          {rec.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
