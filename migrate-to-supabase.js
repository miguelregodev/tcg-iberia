const fs = require('fs');
const path = require('path');

// Create all necessary directories
const dirs = [
  'src/app/api/admin/upload',
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created: ${dir}`);
  }
});

// Updated upload route using Supabase
const uploadRouteContent = `import { NextRequest, NextResponse } from 'next/server';
import { uploadToSupabaseStorage } from '@/lib/supabase-storage';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function POST(request: NextRequest) {
  // Verify admin authentication
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 5MB)' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage
    const url = await uploadToSupabaseStorage(buffer, file.name);

    return NextResponse.json({ url, success: true });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}`;

// Write the upload route
const uploadPath = path.join(__dirname, 'src/app/api/admin/upload/route.ts');
if (!fs.existsSync(uploadPath)) {
  fs.writeFileSync(uploadPath, uploadRouteContent, 'utf-8');
  console.log('✓ src/app/api/admin/upload/route.ts');
}

// Updated ImageUpload component
const imageUploadContent = `'use client';

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
        const { error: errorMsg } = await response.json();
        setError(errorMsg || 'Upload failed');
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
        className={\`border-2 border-dashed \${
          dragging ? 'border-premium-gold' : 'border-dark-border'
        } rounded-lg p-8 text-center cursor-pointer transition-colors\`}
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
          <p className="text-text-secondary font-medium">
            {loading ? '⏳ Uploading...' : '📤 Drag and drop image or click to select'}
          </p>
          <p className="text-xs text-text-muted mt-1">Max 5MB • JPG, PNG, WebP</p>
        </label>
      </div>
      {error && <p className="text-premium-red text-sm mt-2">{error}</p>}
    </div>
  );
}`;

const imageUploadPath = path.join(__dirname, 'src/components/ImageUpload.tsx');
if (!fs.existsSync(imageUploadPath)) {
  fs.writeFileSync(imageUploadPath, imageUploadContent, 'utf-8');
  console.log('✓ src/components/ImageUpload.tsx');
}

console.log('\\n✅ Supabase migration files generated!');


fs.writeFileSync(
  path.join(__dirname, 'migrate-to-supabase.js'),
  moduleContent,
  'utf-8'
);

console.log('Created migrate-to-supabase.js');
