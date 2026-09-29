import Link from 'next/link';

interface CategoryCardProps {
  href: string;
  label: string;
  imageUrl: string;
  className?: string;
}

/** Image-driven category tile — entire card is a single clickable link. */
export function CategoryCard({ href, label, imageUrl, className = '' }: CategoryCardProps) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 focus-visible ${className}`}
      aria-label={`Ver categoría ${label}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card bg-dark-surface border border-dark-border">
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
      <span className="text-center text-sm md:text-base font-semibold tracking-wide uppercase text-text-primary group-hover:text-premium-gold transition-colors">
        {label}
      </span>
    </Link>
  );
}
