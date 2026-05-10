'use client';

import { useState } from 'react';
import { HitCard, HitCardInput } from '@/types';
import { ImageUpload } from './ImageUpload';

interface HitCardFormProps {
  productId: string;
  hitCard?: HitCard;
  onSuccess: () => void;
  onCancel: () => void;
}

export function HitCardForm({ productId, hitCard, onSuccess, onCancel }: HitCardFormProps) {
  const [formData, setFormData] = useState({
    name: hitCard?.name || '',
    type: hitCard?.type || '',
    imageUrl: hitCard?.imageUrl || '',
    marketPrice: hitCard?.marketPrice || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      if (!formData.name || !formData.type || !formData.imageUrl || formData.marketPrice === '') {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      const marketPriceValue = parseFloat(String(formData.marketPrice));
      if (isNaN(marketPriceValue) || marketPriceValue < 0) {
        setError('Market price must be a valid positive number');
        setLoading(false);
        return;
      }

      const method = hitCard ? 'PUT' : 'POST';
      const url = hitCard
        ? `/api/admin/hit-cards/${hitCard.id}`
        : '/api/admin/hit-cards';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          name: formData.name,
          type: formData.type,
          imageUrl: formData.imageUrl,
          marketPrice: marketPriceValue,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save hit card');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
      <h4 className="font-semibold text-gray-900">
        {hitCard ? 'Edit Hit Card' : 'Add New Hit Card'}
      </h4>

      {error && (
        <div className="bg-red-50 border border-red-500 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Charizard ex"
          required
          className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus-visible"
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Type *</label>
        <select
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus-visible"
          disabled={loading}
        >
          <option value="SAR">SAR (Special Art Rare)</option>
          <option value="AR">AR (Art Rare)</option>
          <option value="SR">SR (Secret Rare)</option>
          <option value="UR">UR (Ultra Rare)</option>
          <option value="MUR">MUR (Mega Ultra Rare)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Image *</label>
        <ImageUpload onUpload={handleImageUpload} />
        {formData.imageUrl && (
          <div className="mt-2">
            <img
              src={formData.imageUrl}
              alt="Hit card preview"
              className="w-24 h-32 object-cover rounded border border-gray-300"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Market Price (€) *</label>
        <input
          type="number"
          name="marketPrice"
          value={formData.marketPrice}
          onChange={handleChange}
          step="0.01"
          min="0"
          placeholder="e.g., 50.00"
          required
          className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus-visible"
          disabled={loading}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Saving...' : hitCard ? 'Update' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 px-3 py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
