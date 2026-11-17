'use client';

import { useState } from 'react';
import { ImageLibraryModal } from '@/components/ImageLibraryModal';

interface ImageUploadProps {
  onUpload: (url: string) => void;
  /** Storage backend for the uploaded file. Defaults to Supabase. */
  provider?: 'supabase' | 'r2';
}

export function ImageUpload({ onUpload, provider = 'supabase' }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large (max 5MB)');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('provider', provider);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const { url } = await response.json();
        onUpload(url);
      } else {
        const data = await response.json();
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Upload failed - please try again');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed ${
          dragging ? 'border-red-500' : 'border-gray-300'
        } rounded-lg p-8 text-center cursor-pointer transition-colors`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
          id="file-input"
          disabled={loading}
        />
        <label htmlFor="file-input" className="cursor-pointer block">
          <p className="text-gray-600 font-medium">
            {loading ? '⏳ Uploading...' : '📤 Drag and drop image or click to select'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Max 5MB • JPG, PNG, WebP</p>
        </label>
      </div>
      <button
        type="button"
        onClick={() => setLibraryOpen(true)}
        className="mt-3 inline-flex items-center rounded-lg border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
      >
        Seleccionar de la biblioteca
      </button>
      {error && <p className="text-premium-red text-sm mt-2">{error}</p>}
      <ImageLibraryModal isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={onUpload} />
    </div>
  );
}
