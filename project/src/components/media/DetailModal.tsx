import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bookmark, Calendar, Check, Clock, Eye, Film, Play, PlayCircle, Share2, Star, Trash2, Tv, X } from 'lucide-react';
import { api, ApiError, getLocale } from '../../lib/api';
import { DEFAULT_TTL, queryCache } from '../../lib/query';
import { track } from '../../lib/analytics';
import { SITE_URL } from '../../lib/seo';
import { detailPath, personPath } from '../../lib/routes';
import { buildMediaSchema } from '../../lib/structured-data';
import { useFilmColor } from '../../hooks/useFilmColor';
import type { CrewMember, MediaDetails, MediaType } from '../../lib/types';
import { MAX_NOTE_LENGTH } from '../../lib/library-utils';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import {
  isModifiedClick,
  useDetailTarget,
  useOpenDetail,
  useOpenPerson,
} from '../../hooks/useDetailRoute';
import { useModal } from '../../hooks/useModal';
import { rememberViewed } from '../../lib/recently-viewed';
import { shareUrl } from '../../lib/share';
import { DocumentMeta } from '../../hooks/useDocumentMeta';
import { ErrorState, FullSpinner } from '../ui/States';
import { StarRating } from '../ui/StarRating';
import { WatchProviders } from './WatchProviders';
import { SeasonBrowser } from './SeasonBrowser';
import { backdropImg, posterImg } from '../../lib/img';
import { useT } from '../../lib/i18n';

/**
 * One crew role and the people credited with it, each a real link to their
 * profile — same contract as a cast credit: plain click opens the overlay,
 * anything else follows the canonical URL. Renders nothing when unattributed.
 */
function CrewLine({
  label,
  people,
  onOpen,
}: {
  label: string;
  people: CrewMember[];
  onOpen: (id: number) => void;
}) {
  if (people.length === 0) return null;
  return (
    <p className="text-sm text-white/60">
      <span className="font-semibold uppercase tracking-wider text-white/40">{label}</span>{' '}
      {people.map((person, i) => (
        <span key={person.id}>
          {i > 0 && <span className="text-white/30">, </span>}
          <a
            href={personPath(person.id)}
            onClick={(e) => {
              if (isModifiedClick(e)) return;
              e.preventDefault();
              onOpen(person.id);
            }}
            className="font-medium text-white/90 underline-offset-2 transition-colors hover:text-[var(--film,theme(colors.white))] hover:underline"
          >
            {person.name}
          </a>
        </span>
      ))}
    </p>
  );
}

/**
 * Free-text note about a title, autosaved.
 *
 * No save button: a note you have to remember to commit is a note you lose by
 * closing the fiche. Typing schedules a write, and the pending draft is
 * flushed on unmount, so closing the overlay mid-sentence keeps the sentence.
 */
const NOTE_SAVE_DELAY_MS = 600;

function NoteEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (note: string) => void;
}) {
  const { t } = useT();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<string | null>(null);

  // The latest saver, without making the flush effect depend on it: the
  // cleanup must run on unmount only, never on a re-render.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current !== null) saveRef.current(pending.current);
    },
    [],
  );

  const onChange = (next: string) => {
    setValue(next);
    setSaved(false);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveRef.current(next);
      pending.current = null;
      setSaved(true);
    }, NOTE_SAVE_DELAY_MS);
  };

  return (
    <div>
      <label
        htmlFor="neox-note"
        className="mb-2 block text-sm font-bold uppercase tracking-wider text-white/50"
      >
        {t('detail.your_note')}
      </label>
      <textarea
        id="neox-note"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_NOTE_LENGTH}
        rows={2}
        placeholder={t('detail.note_placeholder')}
        className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-relaxed text-white placeholder-white/35 outline-none transition-colors focus:border-white/40 focus:bg-white/[0.07]"
      />
      <p className="mt-1 flex items-center justify-between text-[11px] text-white/35">
        <span aria-live="polite">{saved ? t('detail.note_saved') : ''}</span>
        <span>
          {value.length}/{MAX_NOTE_LENGTH}
        </span>
      </p>
    </div>
  );
}

function runtimeLabel(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
}

export function DetailModal() {
  const { t, tn, formatNumber } = useT();
  const { target, close } = useDetailTarget();
  const openDetail = useOpenDetail();
  const openPerson = useOpenPerson();
  const {
    statusOf,
    ratingOf,
    isSaved,
    setStatus,
    setRating,
    noteOf,
    setNote,
    rememberRuntime,
    remove,
  } = useLibrary();
  const toast = useToast();

  const [details, setDetails] = useState<MediaDetails | null>(null);

  const film = useFilmColor(details?.poster);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);

  // Cached per title + locale: reopening a fiche within the TTL paints
  // instantly with zero network, instead of refetching on every open.
  const load = useCallback(async (mediaType: MediaType, id: number) => {
    const locale = getLocale();
    const key = `details:${mediaType}:${id}:${locale.region}:${locale.language}`;
    const cached = queryCache.getFresh<MediaDetails>(key, DEFAULT_TTL);
    if (cached) {
      setDetails(cached);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDetails(await queryCache.fetch(key, () => api.details(mediaType, id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!target) return;
    setDetails(null);
    setShowTrailer(false);
    void load(target.mediaType, target.id);
  }, [target, load]);

  // Two controls start the trailer (the play overlay and the action button), so
  // the handler lives here: one place to set the state, one place to count it.
  const playTrailer = useCallback(() => {
    setShowTrailer(true);
    if (details) track('Trailer Play', { mediaType: details.mediaType });
  }, [details]);

  // The card URL is already canonical and shareable; this finally hands it to
  // the user. System share sheet where there is one, clipboard elsewhere.
  const handleShare = useCallback(async () => {
    if (!details) return;
    const url = `${SITE_URL}${detailPath(details.mediaType, details.id)}`;
    const outcome = await shareUrl(details.title, url);
    if (outcome === 'copied') toast.success(t('toast.link_copied'));
    else if (outcome === 'failed') toast.error(t('toast.link_copy_failed'));
    if (outcome === 'shared' || outcome === 'copied') {
      track('Share', { mediaType: details.mediaType });
    }
  }, [details, toast, t]);

  // The fiche is the only place a runtime is known, so it is the only place
  // that can teach the library one. Backfills silently, and only for titles
  // already saved: opening a fiche is not saving it.
  useEffect(() => {
    if (!details?.runtime) return;
    rememberRuntime(details, details.runtime);
  }, [details, rememberRuntime]);

  // Record successful opens so Home + ⌘K can resurface them.
  useEffect(() => {
    if (!details) return;
    rememberViewed({
      id: details.id,
      mediaType: details.mediaType,
      title: details.title,
      poster: details.poster,
      year: details.year,
      rating: details.rating,
    });
  }, [details]);

  const dialogRef = useModal<HTMLDivElement>(Boolean(target), close);

  if (!target) return null;

  const status = details ? statusOf(details) : null;
  const saved = details ? isSaved(details) : false;
  const personalRating = details ? ratingOf(details) : null;
  const runtime = details ? runtimeLabel(details.runtime) : null;
  const backdrop = details?.backdrop ? backdropImg(details.backdrop) : null;
  const poster = details?.poster ? posterImg(details.poster, '112px') : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-0 backdrop-blur-sm sm:p-6"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={details?.title || t('detail.loading')}
        tabIndex={-1}
        className="relative w-full max-w-4xl animate-scale-in overflow-hidden bg-ink-900 shadow-2xl outline-none sm:rounded-3xl sm:border sm:border-white/10"
        style={film ? ({ '--film': film.light } as CSSProperties) : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label={t('common.close')}
          className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-md transition-all hover:bg-black/80 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {loading && <FullSpinner label={t('detail.loading')} />}

        {error && !loading && (
          <div className="py-10">
            <ErrorState message={error} onRetry={() => load(target.mediaType, target.id)} />
          </div>
        )}

        {details && !loading && (
          <>
            <DocumentMeta
              title={details.year ? `${details.title} (${details.year})` : details.title}
              description={details.overview || details.tagline}
              image={details.backdrop || details.poster}
              type={details.mediaType === 'tv' ? 'video.tv_show' : 'video.movie'}
              path={detailPath(details.mediaType, details.id)}
              jsonLd={buildMediaSchema(
                details,
                `${SITE_URL}${detailPath(details.mediaType, details.id)}`,
              )}
            />
            <div className="relative h-56 sm:h-80">
              {showTrailer && details.trailerKey ? (
                <iframe
                  title={`${t('detail.trailer')} : ${details.title}`}
                  src={`https://www.youtube.com/embed/${details.trailerKey}?autoplay=1&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <>
                  {backdrop ? (
                    <img
                      src={backdrop.src}
                      srcSet={backdrop.srcSet}
                      sizes={backdrop.sizes}
                      width={backdrop.width}
                      height={backdrop.height}
                      alt=""
                      decoding="async"
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="h-full w-full bg-ink-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
                  {details.trailerKey && (
                    <button
                      onClick={playTrailer}
                      className="group absolute inset-0 flex items-center justify-center"
                      aria-label={t('detail.play_trailer')}
                    >
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--film,theme(colors.white))] text-ink-950 transition-transform group-hover:scale-110">
                        <Play className="ml-1 h-7 w-7 fill-white text-white" />
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="relative -mt-16 space-y-7 px-5 pb-8 sm:px-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                {poster && (
                  <img
                    src={poster.src}
                    srcSet={poster.srcSet}
                    sizes={poster.sizes}
                    width={poster.width}
                    height={poster.height}
                    alt={details.title}
                    decoding="async"
                    className="hidden w-28 shrink-0 rounded-xl shadow-card ring-1 ring-white/10 sm:block"
                  />
                )}
                <div className="flex-1">
                  <h2 className="font-display text-2xl font-extrabold leading-[1.08] tracking-tight text-balance text-white sm:text-4xl">
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
                          ({formatNumber(details.voteCount)})
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
                        {tn('detail.seasons', details.numberOfSeasons)}
                      </span>
                    ) : null}
                    {/* The rating issued where the viewer is, or nothing at
                        all: a US "PG-13" shown to a French viewer would be a
                        confident answer to a question nobody asked. */}
                    {details.certification && (
                      <span
                        className="rounded border border-white/25 px-1.5 py-0.5 text-xs font-bold text-white/80"
                        title={t('detail.certification')}
                      >
                        {details.certification}
                      </span>
                    )}
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
                  <button onClick={playTrailer} className="btn-primary">
                    <Play className="h-5 w-5 fill-current" />
                    {t('detail.trailer')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setStatus(details, 'want');
                    toast.success(t('toast.marked_want'));
                  }}
                  className={
                    status === 'want'
                      ? 'btn-primary'
                      : 'btn-ghost'
                  }
                >
                  <Bookmark className={`h-5 w-5 ${status === 'want' ? 'fill-current' : ''}`} />
                  {t('filter.want')}
                </button>
                <button
                  onClick={() => {
                    setStatus(details, 'watching');
                    toast.success(t('toast.marked_watching'));
                  }}
                  className={status === 'watching' ? 'btn-primary' : 'btn-ghost'}
                >
                  <PlayCircle className="h-5 w-5" />
                  {t('filter.watching')}
                </button>
                <button
                  onClick={() => {
                    setStatus(details, 'watched');
                    toast.success(t('toast.marked_watched'));
                  }}
                  className={status === 'watched' ? 'btn-primary' : 'btn-ghost'}
                >
                  {status === 'watched' ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                  {status === 'watched' ? t('filter.watched') : t('detail.mark_watched')}
                </button>
                <button onClick={() => void handleShare()} className="btn-ghost">
                  <Share2 className="h-5 w-5" />
                  {t('detail.share')}
                </button>
                {saved && (
                  <button
                    onClick={() => {
                      remove(details);
                      toast.success(t('toast.removed'));
                    }}
                    aria-label={t('detail.remove')}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Personal rating + note */}
              <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <p className="mb-2 text-sm font-bold uppercase tracking-wider text-white/50">
                    {t('detail.your_rating')}
                  </p>
                  <StarRating
                    value={personalRating}
                    onChange={(r) => {
                      setRating(details, r);
                      // Rating implies "watched", so give the same feedback the
                      // other library mutations do instead of a silent status flip.
                      toast.success(r != null ? t('toast.rated') : t('toast.rating_cleared'));
                    }}
                  />
                </div>
                {/* A number says how much you liked it; only a sentence says
                    why. Remounted per fiche so the draft never leaks from one
                    title to the next. */}
                <NoteEditor
                  key={`note-${details.mediaType}-${details.id}`}
                  initial={noteOf(details)}
                  onSave={(note) => setNote(details, note)}
                />
              </div>

              {details.overview && (
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/50">
                    {t('detail.synopsis')}
                  </h3>
                  <p className="leading-relaxed text-white/80">{details.overview}</p>
                </div>
              )}

              {/* Who made it. The fiche listed twelve actors and not one
                  director: the first question anyone asks about a film had no
                  answer on the page that exists to answer it. */}
              {(details.crew.directors.length > 0 ||
                details.crew.creators.length > 0 ||
                details.crew.writers.length > 0) && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-10">
                  <CrewLine
                    label={t('detail.directed_by')}
                    people={details.crew.directors}
                    onOpen={openPerson}
                  />
                  <CrewLine
                    label={t('detail.created_by')}
                    people={details.crew.creators}
                    onOpen={openPerson}
                  />
                  <CrewLine
                    label={t('detail.written_by')}
                    people={details.crew.writers}
                    onOpen={openPerson}
                  />
                </div>
              )}

              {/* The saga this film belongs to. Chronological, current film
                  excluded: what you want here is the one you haven't seen. */}
              {details.collection && details.collection.items.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                    {t('detail.collection', { name: details.collection.name })}
                  </h3>
                  <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                    {details.collection.items.map((part) => {
                      const partImg = part.poster ? posterImg(part.poster, '112px') : null;
                      return (
                        <a
                          key={part.id}
                          href={detailPath(part.mediaType, part.id)}
                          onClick={(e) => {
                            if (isModifiedClick(e)) return;
                            e.preventDefault();
                            openDetail(part);
                          }}
                          className="group w-28 shrink-0 text-left"
                        >
                          <div className="flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg bg-ink-700 text-white/30 ring-1 ring-white/5 transition-transform group-hover:scale-[1.03]">
                            {partImg ? (
                              <img
                                src={partImg.src}
                                srcSet={partImg.srcSet}
                                sizes={partImg.sizes}
                                width={partImg.width}
                                height={partImg.height}
                                alt={part.title}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Film className="h-8 w-8" />
                            )}
                          </div>
                          <p className="mt-1.5 truncate text-xs font-medium text-white/80">
                            {part.title}
                          </p>
                          <p className="truncate text-[11px] text-white/40">{part.year || '—'}</p>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {details.mediaType === 'tv' && details.seasons.length > 0 && (
                <SeasonBrowser
                  key={details.id}
                  tvId={details.id}
                  seasons={details.seasons}
                  item={details}
                />
              )}

              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                  {t('detail.where_watch')}
                </h3>
                <WatchProviders providers={details.providers} />
              </div>

              {details.cast.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                    {t('detail.cast')}
                  </h3>
                  <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                    {details.cast.map((member) => (
                      <a
                        key={member.id}
                        href={personPath(member.id)}
                        onClick={(e) => {
                          if (isModifiedClick(e)) return;
                          e.preventDefault();
                          openPerson(member.id);
                        }}
                        className="group w-20 shrink-0 text-center"
                      >
                        {member.photo ? (
                          <img
                            src={member.photo}
                            alt={member.name}
                            width={80}
                            height={80}
                            loading="lazy"
                            className="mb-1.5 h-20 w-20 rounded-full object-cover ring-1 ring-white/10 transition-all group-hover:ring-[color-mix(in_srgb,var(--film,#ffffff)_55%,transparent)]"
                          />
                        ) : (
                          <div className="mb-1.5 flex h-20 w-20 items-center justify-center rounded-full bg-ink-700 text-lg font-bold text-white/40 transition-all group-hover:ring-1 group-hover:ring-[color-mix(in_srgb,var(--film,#ffffff)_55%,transparent)]">
                            {member.name.slice(0, 1)}
                          </div>
                        )}
                        <p className="truncate text-xs font-medium text-white/90 group-hover:text-white">
                          {member.name}
                        </p>
                        <p className="truncate text-[11px] text-white/40">{member.character}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {details.recommendations.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                    {t('detail.similar')}
                  </h3>
                  <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                    {details.recommendations.map((rec) => {
                      const recImg = rec.poster ? posterImg(rec.poster, '112px') : null;
                      return (
                      <a
                        key={`${rec.mediaType}-${rec.id}`}
                        href={detailPath(rec.mediaType, rec.id)}
                        onClick={(e) => {
                          if (isModifiedClick(e)) return;
                          e.preventDefault();
                          openDetail(rec);
                        }}
                        className="group w-28 shrink-0 text-left"
                      >
                        <div className="flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg bg-ink-700 text-white/30 ring-1 ring-white/5 transition-transform group-hover:scale-[1.03]">
                          {recImg ? (
                            <img
                              src={recImg.src}
                              srcSet={recImg.srcSet}
                              sizes={recImg.sizes}
                              width={recImg.width}
                              height={recImg.height}
                              alt={rec.title}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          ) : rec.mediaType === 'tv' ? (
                            <Tv className="h-8 w-8" />
                          ) : (
                            <Film className="h-8 w-8" />
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-xs font-medium text-white/80">
                          {rec.title}
                        </p>
                      </a>
                      );
                    })}
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
