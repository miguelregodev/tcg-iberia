'use client';

import { useState } from 'react';

interface ImageUploadProps {
  onUpload: (url: string) => void;
}

export function ImageUpload({ onUpload }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      {error && <p className="text-premium-red text-sm mt-2">{error}</p>}
    </div>
  );
}
