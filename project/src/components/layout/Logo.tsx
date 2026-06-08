import { Clapperboard } from 'lucide-react';

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 focus:outline-none"
      aria-label="NEOX — accueil"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow transition-transform group-hover:scale-105">
        <Clapperboard className="h-5 w-5 text-white" />
      </span>
      <span className="text-2xl font-extrabold tracking-tight text-gradient">NEOX</span>
    </button>
  );
}
