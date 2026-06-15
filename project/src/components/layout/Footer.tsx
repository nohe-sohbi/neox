import { useT } from '../../lib/i18n';

export function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="container mx-auto flex flex-col items-center gap-3 px-6 py-8 text-center text-sm text-white/40 sm:flex-row sm:justify-between sm:text-left">
        <p>
          <span className="font-bold text-gradient">NEOX</span> — {t('footer.tagline')}
        </p>
        <p>
          {t('footer.data_by')}{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            TMDB
          </a>{' '}
          {t('footer.data_suffix')}
        </p>
      </div>
    </footer>
  );
}
