import { ExternalLink } from 'lucide-react';
import type { Provider, WatchProviders as Providers } from '../../lib/types';

function ProviderGroup({ label, providers }: { label: string; providers: Provider[] }) {
  if (providers.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <div className="flex flex-wrap gap-2.5">
        {providers.map((p) => (
          <div
            key={p.id}
            title={p.name}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1.5 pr-3"
          >
            {p.logo ? (
              <img src={p.logo} alt={p.name} className="h-7 w-7 rounded-md" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-700 text-[10px] font-bold">
                {p.name.slice(0, 2)}
              </span>
            )}
            <span className="text-sm font-medium text-white/85">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WatchProviders({ providers }: { providers: Providers }) {
  const hasAny =
    providers.flatrate.length > 0 || providers.rent.length > 0 || providers.buy.length > 0;

  if (!hasAny) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
        Aucune offre légale détectée dans ta région pour le moment. Reviens bientôt — le catalogue
        évolue chaque semaine.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProviderGroup label="En streaming" providers={providers.flatrate} />
      <ProviderGroup label="En location" providers={providers.rent} />
      <ProviderGroup label="À l’achat" providers={providers.buy} />
      {providers.link && (
        <a
          href={providers.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-cyan transition-colors hover:text-white"
        >
          Voir toutes les offres sur JustWatch
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <p className="text-xs text-white/30">Disponibilité fournie par JustWatch via TMDB.</p>
    </div>
  );
}
