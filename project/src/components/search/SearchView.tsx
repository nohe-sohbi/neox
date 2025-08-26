import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Category } from '../../App';
import { SearchBar } from './SearchBar';

interface SearchViewProps {
  category: Category;
  onBack: () => void;
}

export function SearchView({ category, onBack }: SearchViewProps) {
  const getCategoryTitle = (category: Category) => {
    switch (category) {
      case 'films': return 'Films';
      case 'series': return 'Séries';
      case 'documentaires': return 'Documentaires';
      case 'anime': return 'Anime/Manga';
      default: return '';
    }
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <button 
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-8 group"
      >
        <ArrowLeft className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" />
        <span>Retour</span>
      </button>

      <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
        Rechercher dans {getCategoryTitle(category)}
      </h2>

      <SearchBar category={category} />
    </div>
  );
}