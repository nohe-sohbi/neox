import {useState} from 'react';
import { Movie } from '../interface/Movie';

interface SearchResultsProps {
  results: Movie[];
}

export function SearchResults({results}: SearchResultsProps) {
    const [selected, setSelected] = useState<Movie | null>(null);
    const [movieLinks, setMovieLinks] = useState<{downloadLinks: string[], streamingLinks: string[]} | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const searchMovieLinks = async (url: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:3001/searchMovieLinks?url=${encodeURIComponent(url)}`);
            if (!response.ok) new Error('Erreur lors de la récupération des liens');
            const data = await response.json();
            setMovieLinks({
                downloadLinks: data.downloadLinks || [],
                streamingLinks: data.streamingLinks || []
            });
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Erreur inconnue');
            }
            setMovieLinks(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (movie: Movie) => {
        setSelected(movie);
        setMovieLinks(null);
        setError(null);
        if (!movie.url) {
            setError("Ce film n'a pas de lien disponible.");
            return;
        }
        await searchMovieLinks(movie.url);
    };

    return (
        <>
            <div
                className="absolute top-full left-0 right-0 mt-4 bg-black/80 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 z-10">
                {results.map((result, idx) => (
                    <button
                        key={idx}
                        className="w-full text-left p-4 hover:bg-white/5 transition-colors"
                        onClick={() => handleSelect(result)}
                        style={{outline: 'none', border: 'none', background: 'none'}}
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
                            onClick={() => { setSelected(null); setMovieLinks(null); setError(null); }}
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
                            {loading && <p className="text-white">Chargement des liens...</p>}
                            {error && <p className="text-red-500">{error}</p>}
                            {!loading && !error && movieLinks && (
                                <div className="mt-4 w-full">
                                    <h4 className="text-white font-semibold mb-2">Liens de téléchargement :</h4>
                                    {movieLinks.downloadLinks.length > 0 ? (
                                        <ul className="list-disc pl-5 mb-4">
                                            {movieLinks.downloadLinks.map((link, i) => (
                                                <li key={i}>
                                                    <span className="text-gray-300 mr-2">{link.host} :</span>
                                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{link.url}</a>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-400">Aucun lien de téléchargement trouvé.</p>
                                    )}
                                    <h4 className="text-white font-semibold mb-2">Liens de streaming :</h4>
                                    {movieLinks.streamingLinks.length > 0 ? (
                                        <ul className="list-disc pl-5">
                                            {movieLinks.streamingLinks.map((link, i) => (
                                                <li key={i}>
                                                    <span className="text-gray-300 mr-2">{link.host} :</span>
                                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{link.url}</a>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-400">Aucun lien de streaming trouvé.</p>
                                    )}
                                </div>
                            )}
                            {!loading && !error && !movieLinks && (
                                <p className="text-gray-400 mt-4">Aucun lien trouvé.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
