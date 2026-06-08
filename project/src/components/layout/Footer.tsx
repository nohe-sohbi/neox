export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="container mx-auto flex flex-col items-center gap-3 px-6 py-8 text-center text-sm text-white/40 sm:flex-row sm:justify-between sm:text-left">
        <p>
          <span className="font-bold text-gradient">NEOX</span> — ton radar cinéma & séries.
        </p>
        <p>
          Données & disponibilités fournies par{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            TMDB
          </a>{' '}
          &amp; JustWatch. NEOX ne stocke ni n’héberge aucun contenu.
        </p>
      </div>
    </footer>
  );
}
