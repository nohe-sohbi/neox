import React from 'react';
import { Search } from 'lucide-react';
import { Link } from './Link';

export function Header() {
  return (
    <header className="fixed top-0 w-full z-50 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
      <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
            NEOX
          </h1>
          <div className="hidden md:flex space-x-6">
            <Link href="/movies">Films</Link>
            <Link href="/series">Séries</Link>
            <Link href="/documentaries">Documentaires</Link>
            <Link href="/anime">Anime/Manga</Link>
            <Link href="/search">Rechercher</Link>
          </div>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <Search className="w-6 h-6 text-cyan-400" />
        </button>
      </nav>
    </header>
  );
}