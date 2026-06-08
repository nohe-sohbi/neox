import { Star } from 'lucide-react';

interface RatingBadgeProps {
  rating: number | null;
  className?: string;
}

function colorFor(rating: number) {
  if (rating >= 7.5) return 'text-emerald-400';
  if (rating >= 6) return 'text-amber-400';
  return 'text-orange-400';
}

export function RatingBadge({ rating, className = '' }: RatingBadgeProps) {
  if (rating == null || rating === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold backdrop-blur-sm ${className}`}
    >
      <Star className={`h-3 w-3 fill-current ${colorFor(rating)}`} />
      <span className="text-white">{rating.toFixed(1)}</span>
    </span>
  );
}
