import { CategoryCard } from './CategoryCard';

interface CategoryDef {
  key: string;
  label: string;
  href: string;
  /** Image from /public/images to display for this category */
  image: string;
}

// Mirrors the real category routes/filters used by DesktopNavMenu + the category pages.
// Each category displays its respective icon from /public/images.
const CATEGORIES: CategoryDef[] = [
  { key: 'booster-boxes', label: 'Cajas Selladas', href: '/booster-boxes', image: '/images/cajas-selladas.webp' },
  { key: 'booster-packs', label: 'Sobres', href: '/booster-packs', image: '/images/booster-pack.webp' },
  { key: 'booster-bundles', label: 'Booster Bundles', href: '/booster-bundles', image: '/images/booster-bundle.webp' },
  { key: 'etbs', label: 'Elite Trainer Boxes', href: '/etbs', image: '/images/etb.webp' },
  { key: 'mystery-packs', label: 'Mystery Packs', href: '/mystery-packs', image: '/images/mistery-pack.png' },
  { key: 'psa', label: 'PSA', href: '/psa', image: '/images/psa.png' },
];

/** "Shop by Category" — displays category icons from /public/images. */
export async function CategoryGrid() {
  return (
    <section id="shop-by-category" className="bg-dark-bg">
      <div className="container-custom px-4 py-16 md:py-24">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-bold text-2xl md:text-4xl tracking-tight text-text-primary">
            Compra por categoría
          </h2>
          <p className="mt-2 text-text-secondary text-sm md:text-base max-w-xl mx-auto">
            Explora nuestro catálogo por tipo de producto.
          </p>
        </div>

        {/* Mobile: horizontal snap-scroll strip so tiles stay large and readable */}
        <div className="flex sm:hidden gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-1">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.key}
              href={category.href}
              label={category.label}
              imageUrl={category.image}
              className="snap-start shrink-0 w-[42vw] max-w-[200px]"
            />
          ))}
        </div>

        {/* Tablet/desktop: grid */}
        <div className="hidden sm:grid grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.key}
              href={category.href}
              label={category.label}
              imageUrl={category.image}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
