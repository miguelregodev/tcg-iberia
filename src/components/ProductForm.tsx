'use client';

import { useState } from 'react';
import { Product } from '@/types';
import { ImageUpload } from './ImageUpload';

interface ProductFormProps {
  product?: Product;
  onSuccess: () => void;
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    discountPercentage: product?.discountPercentage || '',
    notes: product?.notes || '',
    stock: product?.stock || '',
    imageUrl: product?.imageUrl || '',
    visible: product?.visible ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (url: string) => {
    setFormData(prev => ({ ...prev, imageUrl: url }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate form
      if (!formData.name || !formData.description || !formData.price || !formData.stock) {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      const method = product ? 'PUT' : 'POST';
      const url = product
        ? `/api/admin/products/${product.id}`
        : '/api/admin/products';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(String(formData.price)),
          discountPercentage: formData.discountPercentage ? parseFloat(String(formData.discountPercentage)) : null,
          notes: formData.notes || null,
          stock: parseInt(String(formData.stock)),
          imageUrl: formData.imageUrl || null,
          visible: formData.visible,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save product');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-8 space-y-6">
      <h2 className="text-h3">{product ? 'Edit Product' : 'Add New Product'}</h2>

      {error && (
        <div className="bg-red-50 border border-red-500 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Product Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Charizard EX Holographic"
          required
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus-visible"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description *</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Detailed product description, condition, edition, etc."
          required
          rows={4}
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus-visible"
          disabled={loading}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Price (€) *</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            step="0.01"
            min="0"
            placeholder="199.99"
            required
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus-visible"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Discount (%) <span className="text-gray-500">optional</span></label>
          <input
            type="number"
            name="discountPercentage"
            value={formData.discountPercentage}
            onChange={handleChange}
            step="0.01"
            min="0"
            max="100"
            placeholder="e.g., 20 for 20% off"
            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus-visible"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Stock Quantity *</label>
        <input
          type="number"
          name="stock"
          value={formData.stock}
          onChange={handleChange}
          min="0"
          placeholder="0"
          required
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus-visible"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-3">Product Image</label>
        <ImageUpload onUpload={handleImageUpload} />
        {formData.imageUrl && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Preview:</p>
            <img
              src={formData.imageUrl}
              alt="Product preview"
              className="w-full h-64 object-cover rounded-lg border border-gray-300"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Product Notes <span className="text-gray-500">optional</span></label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="e.g., Limited edition, First print, Holographic, Japanese version"
          rows={3}
          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 focus-visible"
          disabled={loading}
        />
        <p className="text-xs text-gray-500 mt-1">Separate notes with commas. Each will appear as a bullet point on the product page.</p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="visible"
          checked={formData.visible}
          onChange={(e) =>
            setFormData(prev => ({ ...prev, visible: e.target.checked }))
          }
          disabled={loading}
          className="rounded"
        />
        <label htmlFor="visible" className="text-sm font-medium cursor-pointer">
          Make visible on public catalog
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 btn btn-primary"
        >
          {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </form>
  );
}
