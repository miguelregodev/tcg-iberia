'use client';

import { useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CatalogProduct {
  id: string;
  name: string;
  price?: number;
}

interface ProductAutocompleteProps {
  products: CatalogProduct[];
  value: string | null;          // currently selected product ID
  onChange: (productId: string, productName: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductAutocomplete({
  products,
  value,
  onChange,
  placeholder = 'Buscar producto…',
  disabled = false,
}: ProductAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = value ? products.find((p) => p.id === value) : null;

  // When the selected product changes externally, update the query display
  useEffect(() => {
    if (!open) setQuery('');
  }, [value, open]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = query.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 12)
    : products.slice(0, 12);

  const handleSelect = (product: CatalogProduct) => {
    onChange(product.id, product.name);
    setOpen(false);
    setQuery('');
  };

  const handleFocus = () => setOpen(true);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative min-w-[200px]">
      <input
        type="text"
        value={open ? query : (selected?.name ?? '')}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed truncate"
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click registers
                handleSelect(product);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors truncate"
            >
              {product.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
