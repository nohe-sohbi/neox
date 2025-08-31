import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Category } from '../../App';
import { Movie } from '../interface/Movie.ts';
import { SearchResults } from './SearchResults';

interface SearchBarProps {
  category: Category;
}

export function SearchBar({ category }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);

  const makeSearchRequest = async (query: string) => {
    setQuery(query);

    try {
      const response = await fetch(`http://localhost:3001/search/?p=${category}&s=${query}`);
      const data = await response.json();
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder={getPlaceholder()}
          className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-6 pr-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent backdrop-blur-sm"
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full hover:shadow-lg hover:shadow-cyan-400/20 transition-shadow" onClick={() => makeSearchRequest(query)}>
          <SearchIcon className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {results.length > 0 && (
        <SearchResults results={results} />
      )}
    </div>
  );
}