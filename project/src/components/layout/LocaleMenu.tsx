import { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { getLocale, setLocale } from '../../lib/api';

const LOCALES = [
  { region: 'FR', language: 'fr-FR', label: 'France', flag: '🇫🇷' },
  { region: 'BE', language: 'fr-BE', label: 'Belgique', flag: '🇧🇪' },
  { region: 'CA', language: 'fr-CA', label: 'Canada', flag: '🇨🇦' },
  { region: 'CH', language: 'fr-CH', label: 'Suisse', flag: '🇨🇭' },
  { region: 'US', language: 'en-US', label: 'United States', flag: '🇺🇸' },
  { region: 'GB', language: 'en-GB', label: 'United Kingdom', flag: '🇬🇧' },
  { region: 'ES', language: 'es-ES', label: 'España', flag: '🇪🇸' },
  { region: 'DE', language: 'de-DE', label: 'Deutschland', flag: '🇩🇪' },
  { region: 'IT', language: 'it-IT', label: 'Italia', flag: '🇮🇹' },
];

export function LocaleMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getLocale();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const select = (region: string, language: string) => {
    if (region === current.region && language === current.language) {
      setOpen(false);
      return;
    }
    setLocale({ region, language });
    // Hard reload guarantees every view refetches with the new locale.
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Région & langue"
        className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Globe className="h-5 w-5" />
      </button>
      {open && (
        <div className="card-surface absolute right-0 top-12 z-50 w-56 animate-scale-in p-2">
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
            Région & langue
          </p>
          <div className="max-h-72 overflow-y-auto">
            {LOCALES.map((l) => {
              const active = l.region === current.region && l.language === current.language;
              return (
                <button
                  key={l.region}
                  onClick={() => select(l.region, l.language)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <span className="text-lg">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {active && <Check className="h-4 w-4 text-brand-cyan" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
