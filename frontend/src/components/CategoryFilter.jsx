import { Button } from '@/components/ui/button.jsx';

export function CategoryFilter({ categories, selectedCategory, onCategoryChange }) {
  return (
    <div className="flex flex-nowrap md:flex-wrap items-center justify-start gap-2 mb-0 w-full max-w-full overflow-x-auto md:overflow-visible">
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={selectedCategory === category.id ? "default" : "outline"}
          onClick={() => onCategoryChange(category.id)}
          className="flex items-center gap-2 whitespace-nowrap flex-none"
        >
          {category.icon ? <span>{category.icon}</span> : null}
          {category.name}
        </Button>
      ))}
    </div>
  );
}

