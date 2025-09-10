import {useState} from 'react';
import { Movie } from '../interface/Movie';

// Tab Component
interface TabProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    count: number;
}

function Tab({ label, isActive, onClick, count }: TabProps) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                isActive
                    ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white shadow-lg'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white'
            }`}
        >
            {label}
            <span className={`px-2 py-1 rounded-full text-xs ${
                isActive ? 'bg-white/20' : 'bg-gray-600/50'
            }`}>
                {count}
            </span>
        </button>
    );
}

// Link Card Component
interface LinkCardProps {
    link: LinkData;
    onResolve: () => void;
}

function LinkCard({ link, onResolve }: LinkCardProps) {
    const getLinkTypeIcon = (linkType?: string) => {
        switch (linkType) {
            case 'protected': return '🔒';
            case 'premium': return '⭐';
            case 'direct': return '🔗';
            default: return '🔗';
        }
    };

    const getLinkTypeColor = (linkType?: string) => {
        switch (linkType) {
            case 'protected': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
            case 'premium': return 'text-purple-400 bg-purple-900/20 border-purple-500/30';
            case 'direct': return 'text-green-400 bg-green-900/20 border-green-500/30';
            default: return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
        }
    };

    return (
        <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-xl border border-white/10 p-5 hover:border-white/20 transition-all">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{getLinkTypeIcon(link.linkType)}</span>
                    <div>
                        <h4 className="text-white font-semibold text-lg">{link.host}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-1 text-xs rounded-full border ${getLinkTypeColor(link.linkType)}`}>
                                {link.linkType === 'protected' ? 'Lien protégé' :
                                 link.linkType === 'premium' ? 'Hébergeur premium' :
                                 'Lien direct'}
                            </span>
                            {link.needsResolver && (
                                <span className="px-2 py-1 text-xs rounded-full border border-orange-500/30 bg-orange-900/20 text-orange-400">
                                    Résolution requise
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {link.needsResolver && !link.resolvedUrl && (
                    <button
                        onClick={onResolve}
                        disabled={link.resolving}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white text-sm rounded-lg transition-all transform hover:scale-105 disabled:scale-100 shadow-lg"
                    >
                        {link.resolving ? (
                            <span className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Résolution...
                            </span>
                        ) : (
                            'Résoudre le lien'
                        )}
                    </button>
                )}
            </div>

            {/* Link URL */}
            <div className="space-y-3">
                {link.resolvedUrl ? (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                        <p className="text-green-300 text-sm mb-2 font-medium">✅ Lien résolu:</p>
                        <a
                            href={link.resolvedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:text-green-300 underline break-all text-sm transition-colors"
                        >
                            {link.resolvedUrl}
                        </a>
                    </div>
                ) : (
                    <div className="bg-gray-900/30 border border-gray-600/30 rounded-lg p-3">
                        <p className="text-gray-400 text-sm mb-2">Lien original:</p>
                        <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline break-all text-sm transition-colors"
                        >
                            {link.url}
                        </a>
                    </div>
                )}

                {/* Error display */}
                {link.error && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                        <p className="text-red-300 text-sm">
                            <span className="font-medium">❌ Erreur:</span> {link.error}
                        </p>
                    </div>
                )}

                {/* Warning for link resolver links */}
                {link.needsResolver && !link.resolvedUrl && !link.error && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                        <p className="text-yellow-300 text-sm">
                            <span className="font-medium">⚠️ Information:</span> Ce lien doit être résolu avant téléchargement.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

interface SearchResultsProps {
  results: Movie[];
}

interface LinkData {
    host: string;
    url: string;
    isProtectedLink?: boolean;
    isResolverHost?: boolean;
    needsResolver?: boolean;
    linkType?: 'protected' | 'premium' | 'direct';
    resolvedUrl?: string;
    resolving?: boolean;
    error?: string;
}

interface MovieLinksData {
    downloadLinks: LinkData[];
    streamingLinks: LinkData[];
}

export function SearchResults({results}: SearchResultsProps) {
    const [selected, setSelected] = useState<Movie | null>(null);
    const [movieLinks, setMovieLinks] = useState<MovieLinksData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'download' | 'streaming'>('download');

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

    const resolveWithProvider = async (linkIndex: number, isStreaming: boolean) => {
        if (!movieLinks) return;

        const links = isStreaming ? movieLinks.streamingLinks : movieLinks.downloadLinks;
        const link = links[linkIndex];

        if (!link || !link.needsResolver) return;

        // Mark this link as resolving
        const updatedLinks = [...links];
        updatedLinks[linkIndex] = { ...link, resolving: true };

        setMovieLinks({
            ...movieLinks,
            [isStreaming ? 'streamingLinks' : 'downloadLinks']: updatedLinks
        });

        try {
            const response = await fetch('http://localhost:3001/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: link.url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la résolution');
            }

            // Update the link with resolved URL
            updatedLinks[linkIndex] = {
                ...link,
                resolving: false,
                resolvedUrl: data.resolvedUrl
            };

            setMovieLinks({
                ...movieLinks,
                [isStreaming ? 'streamingLinks' : 'downloadLinks']: updatedLinks
            });

        } catch (err) {
            // Reset resolving state and add error to the specific link
            const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
            updatedLinks[linkIndex] = {
                ...link,
                resolving: false,
                error: errorMessage
            };
            setMovieLinks({
                ...movieLinks,
                [isStreaming ? 'streamingLinks' : 'downloadLinks']: updatedLinks
            });

            // Don't set global error, let individual link errors be displayed
            console.error('resolution failed for link:', link.url, errorMessage);
        }
    };

    const handleSelect = async (movie: Movie) => {
        setSelected(movie);
        setMovieLinks(null);
        setError(null);
        setActiveTab('download'); // Reset to download tab when selecting a new movie
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
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className="min-h-screen flex items-start justify-center p-4">
                        <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl border border-white/10 w-full max-w-4xl relative shadow-2xl">
                            {/* Header */}
                            <div className="sticky top-0 bg-gradient-to-r from-gray-900/95 to-black/95 backdrop-blur-sm rounded-t-3xl border-b border-white/10 p-6">
                                <button
                                    className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                                    onClick={() => { setSelected(null); setMovieLinks(null); setError(null); }}
                                    aria-label="Fermer"
                                >
                                    ×
                                </button>
                                <div className="flex items-start gap-6">
                                    <img
                                        src={selected.image || ''}
                                        alt={selected.title}
                                        className="w-24 h-36 rounded-xl object-cover shadow-lg"
                                    />
                                    <div className="flex-1">
                                        <h2 className="text-white text-3xl font-bold mb-2">{selected.title}</h2>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                            <span className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full border border-blue-500/30">
                                                {selected.year}
                                            </span>
                                            <span className="px-3 py-1 bg-purple-600/20 text-purple-300 rounded-full border border-purple-500/30">
                                                {selected.type}
                                            </span>
                                            <span className="px-3 py-1 bg-green-600/20 text-green-300 rounded-full border border-green-500/30">
                                                {selected.quality}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-8">
                                {loading && (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                        <span className="ml-3 text-white">Chargement des liens...</span>
                                    </div>
                                )}

                                {error && (
                                    <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                        <p className="text-red-300">{error}</p>
                                    </div>
                                )}

                                {!loading && !error && movieLinks && (
                                    <div className="space-y-6">
                                        {/* Tab Navigation */}
                                        <div className="flex gap-4 border-b border-white/10 pb-4">
                                            <Tab
                                                label="Téléchargement"
                                                isActive={activeTab === 'download'}
                                                onClick={() => setActiveTab('download')}
                                                count={movieLinks.downloadLinks.length}
                                            />
                                            <Tab
                                                label="Streaming"
                                                isActive={activeTab === 'streaming'}
                                                onClick={() => setActiveTab('streaming')}
                                                count={movieLinks.streamingLinks.length}
                                            />
                                        </div>

                                        {/* Tab Content */}
                                        <div className="min-h-[400px]">
                                            {activeTab === 'download' && (
                                                <div>
                                                    {movieLinks.downloadLinks.length > 0 ? (
                                                        <div className="grid gap-4">
                                                            {movieLinks.downloadLinks.map((link, i) => (
                                                                <LinkCard
                                                                    key={i}
                                                                    link={link}
                                                                    onResolve={() => resolveWithProvider(i, false)}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-16 text-gray-400">
                                                            <div className="text-6xl mb-4">📥</div>
                                                            <h3 className="text-xl font-medium mb-2">Aucun lien de téléchargement</h3>
                                                            <p>Aucun lien de téléchargement n'a été trouvé pour ce contenu.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {activeTab === 'streaming' && (
                                                <div>
                                                    {movieLinks.streamingLinks.length > 0 ? (
                                                        <div className="grid gap-4">
                                                            {movieLinks.streamingLinks.map((link, i) => (
                                                                <LinkCard
                                                                    key={i}
                                                                    link={link}
                                                                    onResolve={() => resolveWithProvider(i, true)}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-16 text-gray-400">
                                                            <div className="text-6xl mb-4">🎬</div>
                                                            <h3 className="text-xl font-medium mb-2">Aucun lien de streaming</h3>
                                                            <p>Aucun lien de streaming n'a été trouvé pour ce contenu.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {!loading && !error && !movieLinks && (
                                    <div className="text-center py-12 text-gray-400">
                                        <p>Aucun lien trouvé.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
