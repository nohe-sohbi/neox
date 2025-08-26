import React from 'react';

interface CategorySectionProps {
  title: string;
  imageUrl: string;
  description: string;
  onClick: () => void;
}

export function CategorySection({ title, imageUrl, description, onClick }: CategorySectionProps) {
  return (
    <div 
      className="relative group cursor-pointer overflow-hidden rounded-2xl"
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
      <img
        src={imageUrl}
        alt={title}
        className="w-full h-[60vh] object-cover transform transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute bottom-0 left-0 right-0 p-8 z-20 transform transition-transform duration-500 group-hover:translate-y-[-10px]">
        <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-gray-200 max-w-lg">{description}</p>
      </div>
    </div>
  );
}