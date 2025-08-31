import { useState } from 'react';
import { Logo } from './components/layout/Logo';
import { CategoryGrid } from './components/home/CategoryGrid';
import { SearchView } from './components/search/SearchView';

export type Category = 'films' | 'series' | 'documentaires' | 'anime' | null;

function App() {
  const [selectedCategory, setSelectedCategory] = useState<Category>(null);

  return (
      <>
          <div className="min-h-screen bg-[#0A0A0F] text-white">
              <div
                  className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/20 via-transparent to-transparent pointer-events-none"/>

              <header
                  className="fixed top-0 w-full z-50 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
                  <div className="container mx-auto px-6 py-4">
                      <Logo/>
                  </div>
              </header>

              <main className="pt-20">
                  {selectedCategory ? (
                      <SearchView
                          category={selectedCategory}
                          onBack={() => setSelectedCategory(null)}/>
                  ) : (
                      <CategoryGrid onSelectCategory={setSelectedCategory}/>
                  )}
              </main>
          </div>
      </>
  );
}

export default App;