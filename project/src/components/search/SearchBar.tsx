import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Category } from '../../App';

interface SearchBarProps {
  category: Category;
}

export function SearchBar({ category }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const makeSearchRequest = async (query: string) => {
    // Mettre à jour l'état de la recherche
    setQuery(query);

    // La recherche doit target l'url https://www.extrem-down.diy/?p=films&s=QUERY
    try {
      const response = await fetch(`http://localhost:3001/search/?p=${category}&s=${query}`);
      const data = await response.json();
      console.log(data);
      setResults(data);
    }
    catch (error) {
      console.error(error);
    }
  };

  const getPlaceholder = () => {
    switch (category) {
      case 'films': return 'Rechercher un film...';
      case 'series': return 'Rechercher une série...';
      case 'documentaires': return 'Rechercher un documentaire...';
      case 'anime': return 'Rechercher un anime ou manga...';
      default: return 'Rechercher...';
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => makeSearchRequest(e.target.value)}
          placeholder={getPlaceholder()}
          className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-6 pr-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent backdrop-blur-sm"
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full hover:shadow-lg hover:shadow-cyan-400/20 transition-shadow">
          <SearchIcon className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {results && (
        <div className="absolute top-full left-0 right-0 mt-4 bg-black/80 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10">
          <div className="p-4 hover:bg-white/5 transition-colors">
            <div className="flex items-center space-x-4">
              <img
                src="https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=100&h=100"
                alt="Movie thumbnail"
                className="w-16 h-16 rounded object-cover"
              />
              <div>
                <h3 className="text-white font-medium">Inception</h3>
                <p className="text-gray-400 text-sm">2010 • Science Fiction</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}