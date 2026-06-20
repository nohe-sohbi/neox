import { useCallback, useEffect, useState } from 'react';
import { Cake, MapPin, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { Person } from '../../lib/types';
import { usePersonTarget } from '../../hooks/useDetailRoute';
import { useModal } from '../../hooks/useModal';
import { ErrorState, FullSpinner } from '../ui/States';
import { MediaGrid } from './MediaGrid';
import { useT, activeLang } from '../../lib/i18n';
import { localeTag } from '../../lib/i18n/core';

function age(birthday: string | null): number | null {
  if (!birthday) return null;
  const diff = Date.now() - new Date(birthday).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return years > 0 && years < 130 ? years : null;
}

export function PersonModal() {
  const { t } = useT();
  const { personId, close } = usePersonTarget();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (id: number) => {
      setLoading(true);
      setError(null);
      try {
        setPerson(await api.person(id));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('common.load_error'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!personId) return;
    setPerson(null);
    void load(personId);
  }, [personId, load]);

  const dialogRef = useModal<HTMLDivElement>(Boolean(personId), close);

  if (!personId) return null;

  const years = person ? age(person.birthday) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-0 backdrop-blur-sm sm:p-6"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={person?.name || t('person.loading')}
        tabIndex={-1}
        className="relative w-full max-w-4xl animate-scale-in overflow-hidden bg-ink-900 p-5 shadow-2xl outline-none sm:rounded-3xl sm:border sm:border-white/10 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label={t('common.close')}
          className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-md transition-all hover:bg-black/80 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {loading && <FullSpinner label={t('person.loading')} />}
        {error && !loading && <ErrorState message={error} onRetry={() => load(personId)} />}

        {person && !loading && (
          <>
            <div className="flex flex-col gap-5 sm:flex-row">
              {person.photo ? (
                <img
                  src={person.photo}
                  alt={person.name}
                  className="h-44 w-32 shrink-0 rounded-2xl object-cover shadow-card ring-1 ring-white/10"
                />
              ) : (
                <div className="flex h-44 w-32 shrink-0 items-center justify-center rounded-2xl bg-ink-700 text-4xl font-bold text-white/30">
                  {person.name.slice(0, 1)}
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-extrabold text-white sm:text-3xl">{person.name}</h2>
                {person.knownFor && (
                  <p className="mt-1 text-sm font-medium text-brand-cyan">{person.knownFor}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60">
                  {person.birthday && (
                    <span className="inline-flex items-center gap-1.5">
                      <Cake className="h-4 w-4" />
                      {new Date(person.birthday).toLocaleDateString(localeTag(activeLang))}
                      {years ? ` (${t('person.years', { count: years })})` : ''}
                    </span>
                  )}
                  {person.placeOfBirth && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {person.placeOfBirth}
                    </span>
                  )}
                </div>
                {person.biography && (
                  <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-white/70">
                    {person.biography}
                  </p>
                )}
              </div>
            </div>

            {person.credits.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                  {t('person.known_for')}
                </h3>
                <MediaGrid items={person.credits} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
