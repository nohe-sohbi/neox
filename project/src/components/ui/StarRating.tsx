import { useState } from 'react';
import { Star, X } from 'lucide-react';

interface StarRatingProps {
  value: number | null; // 1..10
  onChange: (value: number | null) => void;
  size?: 'sm' | 'md';
}

/** A 1–10 personal rating control (matches the TMDB scale). */
export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;
  const star = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-1">
      <div className="flex" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n === value ? null : n)}
            aria-label={`Noter ${n} sur 10`}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={`${star} ${
                n <= display ? 'fill-amber-400 text-amber-400' : 'text-white/25'
              }`}
            />
          </button>
        ))}
      </div>
      <span className="ml-1 w-10 text-sm font-semibold text-white/80">
        {value ? `${value}/10` : ''}
      </span>
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Effacer la note"
          className="text-white/40 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
