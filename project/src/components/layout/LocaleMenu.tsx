import { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { getLocale, setLocale } from '../../lib/api';
import { OFFERED_LOCALES } from '../../lib/locales';
import { usePreferences } from '../../context/PreferencesContext';
import { useT } from '../../lib/i18n';

export function LocaleMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getLocale();
  const { updateNow } = usePreferences();
  const { t } = useT();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const select = async (region: string, language: string) => {
    if (region === current.region && language === current.language) {
      setOpen(false);
      return;
    }
    setLocale({ region, language });
    // Awaited, not debounced: the reload below would kill an in-flight push,
    // and the point is that the choice follows the account to the next device.
    await updateNow({ region, language });
    // Hard reload guarantees every view refetches with the new locale.
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('locale.title')}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Globe className="h-5 w-5" />
      </button>
      {open && (
        <div className="card-surface absolute right-0 top-12 z-50 w-56 animate-scale-in p-2">
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/55">
            {t('locale.title')}
          </p>
          <div className="max-h-72 overflow-y-auto">
            {OFFERED_LOCALES.map((l) => {
              const active = l.region === current.region && l.language === current.language;
              return (
                <button
                  key={l.region}
                  onClick={() => void select(l.region, l.language)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <span className="text-lg">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {active && <Check className="h-4 w-4 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
