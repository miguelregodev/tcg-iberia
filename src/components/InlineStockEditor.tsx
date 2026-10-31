'use client';

import { useState } from 'react';

interface InlineStockEditorProps {
  productId: string;
  initialStock: number;
  onStockUpdated?: (newStock: number) => void;
}

export function InlineStockEditor({
  productId,
  initialStock,
  onStockUpdated,
}: InlineStockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [stock, setStock] = useState(initialStock);
  const [newStock, setNewStock] = useState(initialStock.toString());
  const [isUpdating, setIsUpdating] = useState(false);

  const hasChanged = parseInt(newStock) !== stock;

  const handleEdit = () => {
    setIsEditing(true);
    setNewStock(stock.toString());
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewStock(stock.toString());
  };

  const handleUpdate = async () => {
    const newStockNum = parseInt(newStock, 10);

    if (isNaN(newStockNum) || newStockNum < 0) {
      alert('Por favor ingresa un número válido de stock (≥ 0)');
      return;
    }

    if (newStockNum === stock) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStockNum }),
      });

      if (response.ok) {
        setStock(newStockNum);
        setIsEditing(false);
        onStockUpdated?.(newStockNum);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'No se pudo actualizar el stock'}`);
      }
    } catch (err) {
      alert('Error al actualizar el stock');
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const lowStock = stock > 0 && stock <= 5;
  const outOfStock = stock === 0;

  if (!isEditing) {
    return (
      <div className="flex items-center justify-center gap-2">
        <span
          onClick={handleEdit}
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${
            outOfStock
              ? 'bg-danger-bg text-danger'
              : lowStock
              ? 'bg-warning-bg text-warning'
              : 'bg-success-bg text-success'
          }`}
        >
          {stock}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="number"
        min="0"
        value={newStock}
        onChange={(e) => setNewStock(e.target.value)}
        disabled={isUpdating}
        autoFocus
        className="w-12 px-2 py-1 text-xs rounded-lg border border-dark-border bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold text-center disabled:opacity-50"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleUpdate();
          if (e.key === 'Escape') handleCancel();
        }}
      />
      
      {hasChanged && (
        <>
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            title="Confirmar actualización"
            className="p-1 text-success hover:text-success/80 transition-colors disabled:opacity-50"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            disabled={isUpdating}
            title="Cancelar"
            className="p-1 text-danger hover:text-danger/80 transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
