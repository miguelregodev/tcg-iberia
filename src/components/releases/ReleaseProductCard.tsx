import type { CalendarProduct } from '@/types/releases';

interface Props {
  product: CalendarProduct;
  onClick: () => void;
}

export function ReleaseProductCard({ product, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={product.name}
      aria-label={`Ver detalles de ${product.name}`}
      className={[
        'aspect-square rounded overflow-hidden bg-gray-100',
        'hover:ring-2 hover:ring-red-400',
        'focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none',
        'transition-all group',
      ].join(' ')}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
