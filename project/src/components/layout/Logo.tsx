import { Clapperboard } from 'lucide-react';
import { useT } from '../../lib/i18n';

export function Logo({ onClick }: { onClick?: () => void }) {
  const { t } = useT();
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 focus:outline-none"
      aria-label={t('nav.home_aria')}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow transition-transform group-hover:scale-105">
        <Clapperboard className="h-5 w-5 text-white" />
      </span>
      <span className="font-display text-2xl font-extrabold tracking-tight text-gradient">NEOX</span>
    </button>
  );
}
