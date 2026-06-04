const fs = require('fs');
const path = require('path');

const appFiles = {
  'src/app/layout.tsx': `import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "TCG Iberia - Premium Pokémon Trading Card Store",
  description: "Authentic, premium Pokémon TCG cards for collectors. Fast EU shipping, collector grade products.",
  keywords: "Pokémon TCG, trading cards, collectors, premium cards, authenticated",
  openGraph: {
    title: "TCG Iberia - Premium Pokémon Trading Card Store",
    description: "Authentic, premium Pokémon TCG cards for collectors.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-dark-bg text-text-primary antialiased">
        <main>{children}</main>
      </body>
    </html>
  );
}`,

  'src/app/page.tsx': `import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { ProductCatalog } from "@/components/ProductCatalog";
import { TrustSection } from "@/components/TrustSection";
import { ContactCTA } from "@/components/ContactCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navigation />
      <Hero />
      <ProductCatalog />
      <TrustSection />
      <ContactCTA />
      <Footer />
    </>
  );
}`,

  'src/app/middleware.ts': `import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const authCookie = request.cookies.get('tcg_admin_auth');
    
    if (!authCookie && request.nextUrl.pathname !== '/admin/login') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    
    if (authCookie && request.nextUrl.pathname === '/admin/login') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};`,

  'src/app/admin/login/page.tsx': `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push('/admin/products');
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-h3 mb-6 text-center">Admin Panel</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 focus-visible"
              disabled={loading}
            />
          </div>

          {error && <p className="text-premium-red text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}`,

  'src/app/admin/products/page.tsx': `'use client';

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
      await fetch(\`/api/admin/products/\${id}\`, { method: 'DELETE' });
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      console.error('Failed to delete product');
    }
  };

  return (
    <>
      <AdminNav />
      <div className="min-h-screen bg-dark-bg">
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
                    <p className="text-text-secondary mb-2">{product.price}€</p>
                    <p className="text-sm text-text-muted">Stock: {product.stock}</p>
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
                      className="btn bg-premium-red text-dark-bg text-sm"
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
}`,

  'src/app/product/[slug]/page.tsx': `import { db } from '@/lib/db';
import { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await db.product.findUnique({
    where: { slug: params.slug },
  });

  if (!product) {
    return {
      title: 'Product not found',
    };
  }

  return {
    title: \`\${product.name} | TCG Iberia\`,
    description: product.description,
  };
}

export default async function ProductDetail({
  params,
}: {
  params: { slug: string };
}) {
  const product = await db.product.findUnique({
    where: { slug: params.slug },
  });

  if (!product || !product.visible) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-dark-bg flex items-center justify-center">
          <p className="text-text-secondary">Product not found</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-dark-bg">
        <div className="container-custom section">
          <div className="grid md:grid-cols-2 gap-12">
            {product.imageUrl && (
              <div className="bg-dark-card rounded-xl overflow-hidden">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="flex flex-col justify-center">
              <h1 className="text-h1 mb-4">{product.name}</h1>
              <p className="text-3xl font-bold text-premium-gold mb-6">
                {product.price.toFixed(2)}€
              </p>
              
              <div className="mb-8">
                <p className="text-text-secondary leading-relaxed">
                  {product.description}
                </p>
              </div>

              <div className="flex gap-4">
                <a
                  href="https://wa.me/34689178762?text=Hola, estoy interesado en un producto. ¿Podrían darme más información?"
                  className="btn btn-primary"
                >
                  Contact on WhatsApp
                </a>
                <a
                  href="mailto:sales@tcgiberia.com"
                  className="btn btn-secondary"
                >
                  Email us
                </a>
              </div>

              {!product.stock && (
                <p className="text-premium-red mt-6 font-semibold">Sold Out</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}`,

  'src/app/api/products/route.ts': `import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const products = await db.product.findMany({
      where: { visible: true },
      orderBy: { createdAt: 'desc' },
    });

    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: parseFloat(p.price.toString()),
      image: p.imageUrl,
      available: p.stock > 0,
      stock: p.stock,
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}`,

  'src/app/api/products/[slug]/route.ts': `import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await db.product.findUnique({
      where: { slug: params.slug },
    });

    if (!product || !product.visible) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: parseFloat(product.price.toString()),
      image: product.imageUrl,
      available: product.stock > 0,
      stock: product.stock,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}`,

  'src/app/api/admin/auth/login/route.ts': `import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('tcg_admin_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}`,

  'src/app/api/admin/auth/logout/route.ts': `import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('tcg_admin_auth');
  return response;
}`,

  'src/app/api/admin/products/route.ts': `import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await db.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const slug = body.name
      .toLowerCase()
      .replace(/[^\\w\\s-]/g, '')
      .replace(/\\s+/g, '-');

    const product = await db.product.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        price: parseFloat(body.price),
        stock: parseInt(body.stock),
        imageUrl: body.imageUrl,
        visible: body.visible ?? true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}`,

  'src/app/api/admin/products/[id]/route.ts': `import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const product = await db.product.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description,
        price: parseFloat(body.price),
        stock: parseInt(body.stock),
        imageUrl: body.imageUrl,
        visible: body.visible,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.product.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}`,

  'src/app/api/admin/upload/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3 } from '@/lib/s3';

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get('tcg_admin_auth');
  return !!cookie;
}

export async function POST(request: NextRequest) {
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = \`\${Date.now()}-\${file.name}\`;
    const url = await uploadToS3(buffer, fileName, file.type);

    return NextResponse.json({ url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}`,
};

// Create app files
const dirsToCreate = new Set();
Object.keys(appFiles).forEach(filePath => {
  const dir = path.dirname(filePath);
  if (dir !== '.') {
    dirsToCreate.add(dir);
  }
});

console.log('📁 Creating directories...');
dirsToCreate.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✓ ${dir}`);
  }
});

console.log('\n📝 Creating app files...');
Object.entries(appFiles).forEach(([filePath, content]) => {
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

console.log('\n✅ App files created successfully!');
