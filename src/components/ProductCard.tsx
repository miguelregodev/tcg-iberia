import Link from 'next/link';
import { Product } from '@/types';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.slug}`}>
      <div className="card card-hover cursor-pointer group">
        {product.imageUrl && (
          <div className="mb-4 h-64 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>
        )}
        
        <h3 className="text-lg font-semibold mb-2 group-hover:text-red-600">
          {product.name}
        </h3>
        
        <div className="mb-3">
          {product.discountPercentage ? (
            <div className="flex items-center gap-2">
              <p className="text-red-600 font-bold text-lg">
                €{(product.price * (1 - product.discountPercentage / 100)).toFixed(2)}
              </p>
              <p className="text-sm text-gray-400 line-through">
                €{Number(product.price).toFixed(2)}
              </p>
            </div>
          ) : (
            <p className="text-red-600 font-bold text-lg">
              €{Number(product.price).toFixed(2)}
            </p>
          )}
        </div>
        
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {product.description}
        </p>
        
        <div className="flex justify-between items-center">
          {product.available ? (
            <span className="text-green-600 text-sm font-semibold">Available</span>
          ) : (
            <span className="text-red-600 text-sm font-semibold">Sold Out</span>
          )}
        </div>
      </div>
    </Link>
  );
}