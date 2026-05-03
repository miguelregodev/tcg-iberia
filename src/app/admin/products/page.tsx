'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types';
import { AdminNav } from '@/components/AdminNav';
import { ProductForm } from '@/components/ProductForm';

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/admin/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    
    try {
      await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      console.error('Failed to delete product');
    }
  };

  return (
    <>
      <AdminNav />
      <div className="min-h-screen bg-white">
        <div className="container-custom section">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-h2">Products</h1>
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowForm(!showForm);
              }}
              className="btn btn-primary"
            >
              {showForm ? 'Cancel' : 'Add Product'}
            </button>
          </div>

          {showForm && (
            <ProductForm
              product={editingProduct || undefined}
              onSuccess={() => {
                setShowForm(false);
                fetchProducts();
              }}
            />
          )}

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="grid gap-4">
              {products.map(product => (
                <div key={product.id} className="card flex justify-between items-start">
                  <div>
                    <h3 className="text-h3 mb-2">{product.name}</h3>
                    <p className="text-gray-600 mb-2">{product.price}€</p>
                    <p className="text-sm text-gray-500">Stock: {product.stock}</p>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => {
                        setEditingProduct(product);
                        setShowForm(true);
                      }}
                      className="btn btn-secondary text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="btn bg-red-600 text-white text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}