import { Category } from '../../App';
import { CategorySection } from './CategorySection';

interface CategoryGridProps {
  onSelectCategory: (category: Category) => void;
}

export function CategoryGrid({ onSelectCategory }: CategoryGridProps) {
  return (
    <section className="container mx-auto px-6 py-12 space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        <CategorySection
          title="Films"
          imageUrl="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1920&q=80"
          description="Découvrez notre collection de films, des classiques aux dernières sorties."
          onClick={() => onSelectCategory('films')}
        />
        <CategorySection
          title="Séries"
          imageUrl="https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=1920&q=80"
          description="Plongez dans nos séries captivantes et addictives."
          onClick={() => onSelectCategory('series')}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <CategorySection
          title="Documentaires"
          imageUrl="https://images.unsplash.com/photo-1590650153855-d9e808231d41?auto=format&fit=crop&w=1920&q=80"
          description="Explorez le monde réel à travers nos documentaires fascinants."
          onClick={() => onSelectCategory('documentaires')}
        />
        <CategorySection
          title="Anime/Manga"
          imageUrl="https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1920&q=80"
          description="Découvrez l'univers captivant de l'animation japonaise."
          onClick={() => onSelectCategory('anime')}
        />
      </div>
    </section>
  );
}