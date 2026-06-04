const fs = require('fs');
const path = require('path');

const componentFiles = {
  'src/components/Navigation.tsx': `'use client';

export function Navigation() {
  return (
    <nav className="bg-dark-card border-b border-dark-border sticky top-0 z-50">
      <div className="container-custom px-4 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold gradient-gold">TCG Iberia</div>
        <div className="flex gap-4">
          <a href="/" className="text-text-secondary hover:text-premium-gold">Home</a>
          <a href="#catalog" className="text-text-secondary hover:text-premium-gold">Catalog</a>
          <a href="#contact" className="text-text-secondary hover:text-premium-gold">Contact</a>
          <a href="/admin" className="text-text-secondary hover:text-premium-gold">Admin</a>
        </div>
      </div>
    </nav>
  );
}`,

  'src/components/Hero.tsx': `export function Hero() {
  return (
    <section className="section bg-gradient-to-br from-dark-bg via-dark-bg to-dark-card py-24 md:py-32">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-h1 mb-6 gradient-gold">Premium TCG Store</h1>
          <p className="text-text-secondary text-lg md:text-xl mb-12 leading-relaxed">
            Authenticated Pokémon cards for serious collectors. EU fast shipping, secure transactions, and premium grade authentication.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#catalog" className="btn btn-primary">
              View Catalog
            </a>
            <a href="#contact" className="btn btn-secondary">
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}`,

  'src/components/ProductCatalog.tsx': `'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types';
import { ProductCard } from './ProductCard';

export function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        }
      } catch (error) {
        console.error('Failed to fetch products');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  return (
    <section id="catalog" className="section">
      <div className="container-custom">
        <h2 className="text-h2 mb-12 text-center">Latest Drops</h2>
        
        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="bg-dark-border rounded h-64 mb-4" />
                <div className="bg-dark-border rounded h-6 mb-2" />
                <div className="bg-dark-border rounded h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-text-secondary">No products available</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}`,

  'src/components/ProductCard.tsx': `import Link from 'next/link';
import { Product } from '@/types';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={\`/product/\${product.slug}\`}>
      <div className="card card-hover cursor-pointer group">
        {product.image && (
          <div className="mb-4 h-64 bg-dark-bg rounded-lg overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>
        )}
        
        <h3 className="text-lg font-semibold mb-2 group-hover:text-premium-gold">
          {product.name}
        </h3>
        
        <p className="text-premium-gold font-bold text-lg mb-3">
          {product.price.toFixed(2)}€
        </p>
        
        <p className="text-sm text-text-muted mb-4 line-clamp-2">
          {product.description}
        </p>
        
        <div className="flex justify-between items-center">
          {product.available ? (
            <span className="text-green-400 text-sm font-semibold">Available Now</span>
          ) : (
            <span className="text-premium-red text-sm font-semibold">Sold Out</span>
          )}
          <span className="text-text-secondary text-sm">Collector Grade</span>
        </div>
      </div>
    </Link>
  );
}`,

  'src/components/TrustSection.tsx': `export function TrustSection() {
  const features = [
    {
      title: 'Authentic Products',
      description: 'Every card verified and authenticated by certified professionals',
      icon: '✓',
    },
    {
      title: 'Fast EU Shipping',
      description: 'Secure packaging with 2-3 business day delivery across EU',
      icon: '🚚',
    },
    {
      title: 'Premium Support',
      description: '24/7 customer support via WhatsApp and email',
      icon: '💬',
    },
  ];

  return (
    <section className="section bg-dark-card">
      <div className="container-custom">
        <h2 className="text-h2 mb-12 text-center">Why TCG Iberia</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="text-center">
              <div className="text-5xl mb-4">{feature.icon}</div>
              <h3 className="text-h3 mb-3">{feature.title}</h3>
              <p className="text-text-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,

  'src/components/ContactCTA.tsx': `export function ContactCTA() {
  return (
    <section id="contact" className="section bg-gradient-to-r from-premium-gold/10 to-premium-red/10">
      <div className="container-custom text-center">
        <h2 className="text-h2 mb-6">Ready to Collect?</h2>
        <p className="text-text-secondary text-lg mb-8 max-w-2xl mx-auto">
          Contact us for special requests, bulk orders, or to discuss rare finds.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://wa.me/34XXXXXXXXX"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Chat on WhatsApp
          </a>
          <a
            href="mailto:info@tcgiberia.com"
            className="btn btn-secondary"
          >
            Email Us
          </a>
        </div>
      </div>
    </section>
  );
}`,

  'src/components/Footer.tsx': `export function Footer() {
  return (
    <footer className="bg-dark-card border-t border-dark-border py-8">
      <div className="container-custom">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold mb-4 text-premium-gold">TCG Iberia</h3>
            <p className="text-text-secondary">Premium Pokémon TCG cards for collectors</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-text-secondary">
              <li><a href="/" className="hover:text-premium-gold">Home</a></li>
              <li><a href="#catalog" className="hover:text-premium-gold">Catalog</a></li>
              <li><a href="#contact" className="hover:text-premium-gold">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-text-secondary">
              <li><a href="mailto:info@tcgiberia.com" className="hover:text-premium-gold">Email</a></li>
              <li><a href="https://wa.me/34XXXXXXXXX" className="hover:text-premium-gold">WhatsApp</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-dark-border pt-8 text-center text-text-secondary">
          <p>&copy; 2024 TCG Iberia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}`,

  'src/components/AdminNav.tsx': `'use client';

import { useRouter } from 'next/navigation';

export function AdminNav() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <nav className="bg-dark-card border-b border-dark-border">
      <div className="container-custom px-4 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold text-premium-gold">Admin Panel</div>
        <button
          onClick={handleLogout}
          className="btn btn-secondary text-sm"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}`,

  'src/components/ProductForm.tsx': `'use client';

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
    stock: product?.stock || '',
    imageUrl: product?.imageUrl || '',
    visible: product?.visible ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (url: string) => {
    setFormData(prev => ({ ...prev, imageUrl: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = product ? 'PUT' : 'POST';
      const url = product
        ? \`/api/admin/products/\${product.id}\`
        : '/api/admin/products';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-8 space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Name</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 focus-visible"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          rows={4}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 focus-visible"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Price (€)</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            step="0.01"
            required
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 focus-visible"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Stock</label>
          <input
            type="number"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            required
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 focus-visible"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Image</label>
        <ImageUpload onUpload={handleImageUpload} />
        {formData.imageUrl && (
          <div className="mt-4">
            <img
              src={formData.imageUrl}
              alt="Preview"
              className="w-full h-64 object-cover rounded-lg"
            />
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.visible}
            onChange={(e) =>
              setFormData(prev => ({ ...prev, visible: e.target.checked }))
            }
          />
          <span className="text-sm">Visible</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full btn btn-primary"
      >
        {loading ? 'Saving...' : 'Save Product'}
      </button>
    </form>
  );
}`,

  'src/components/ImageUpload.tsx': `'use client';

import { useState } from 'react';

interface ImageUploadProps {
  onUpload: (url: string) => void;
}

export function ImageUpload({ onUpload }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image');
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
      }
    } catch (error) {
      console.error('Upload failed');
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
      <label htmlFor="file-input" className="cursor-pointer">
        <p className="text-text-secondary">
          {loading ? 'Uploading...' : 'Drag and drop image or click to select'}
        </p>
      </label>
    </div>
  );
}`,

  'src/lib/s3.ts': `import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: \`products/\${fileName}\`,
    Body: buffer,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    const url = \`https://\${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/products/\${fileName}\`;
    return url;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
}`,

  'src/hooks/useAuth.ts': `'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth/check');
        setIsAuthenticated(response.ok);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return { isAuthenticated, loading };
}`,

  'src/hooks/useProducts.ts': `'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        } else {
          setError('Failed to fetch products');
        }
      } catch (err) {
        setError('Failed to fetch products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return { products, loading, error };
}`,
};

const dirsToCreate = new Set();
Object.keys(componentFiles).forEach(filePath => {
  const dir = path.dirname(filePath);
  if (dir !== '.') {
    dirsToCreate.add(dir);
  }
});

console.log('📁 Creating component directories...');
dirsToCreate.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✓ ${dir}`);
  }
});

console.log('\n📝 Creating component files...');
Object.entries(componentFiles).forEach(([filePath, content]) => {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✓ ${filePath}`);
  } else {
    console.log(`⊘ ${filePath} (already exists)`);
  }
});

console.log('\n✅ Component files created successfully!');
