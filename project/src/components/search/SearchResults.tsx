import { useState } from 'react';
import { Movie } from '../interface/Movie';

interface SearchResultsProps {
  results: Movie[];
}

export function SearchResults({ results }: SearchResultsProps) {
  const [selected, setSelected] = useState<Movie | null>(null);

  return (
    <>
      <div className="absolute top-full left-0 right-0 mt-4 bg-black/80 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 z-10">
        {results.map((result, idx) => (
          <button
            key={idx}
            className="w-full text-left p-4 hover:bg-white/5 transition-colors"
            onClick={() => setSelected(result)}
            style={{ outline: 'none', border: 'none', background: 'none' }}
          >
            <div className="flex items-center space-x-4">
              <img
                src={result.image || ''}
                alt={result.title}
                className="w-16 h-16 rounded object-cover"
              />
              <div>
                <h3 className="text-white font-medium">{result.title}</h3>
                <p className="text-gray-400 text-sm">{result.year} • {result.type} • {result.quality}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-black rounded-2xl p-8 border border-white/10 max-w-md w-full relative">
            <button
              className="absolute top-2 right-2 text-white text-xl"
              onClick={() => setSelected(null)}
              aria-label="Fermer"
            >
              ×
            </button>
            <div className="flex flex-col items-center">
              <img
                src={selected.image || ''}
                alt={selected.title}
                className="w-32 h-32 rounded object-cover mb-4"
              />
              <h2 className="text-white text-2xl font-bold mb-2">{selected.title}</h2>
              <p className="text-gray-400 mb-2">{selected.year} • {selected.type} • {selected.quality}</p>
              {/* Ajoute ici d'autres infos si besoin */}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

