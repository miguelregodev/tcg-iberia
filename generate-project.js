const fs = require('fs');
const path = require('path');

// Files to create with content
const files = {
  'src/styles/globals.css': `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  @apply transition-colors duration-300;
}

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-dark-bg text-text-primary;
  font-family: "Inter", system-ui, sans-serif;
}

.btn {
  @apply px-6 py-3 rounded-lg font-semibold transition-all duration-300;
}

.btn-primary {
  @apply bg-premium-gold text-dark-bg hover:bg-premium-gold_dark shadow-lg hover:shadow-xl;
}

.btn-secondary {
  @apply bg-dark-card border border-premium-gold text-premium-gold hover:bg-premium-gold/10;
}

.btn-ghost {
  @apply text-text-secondary hover:text-text-primary;
}

.card {
  @apply bg-dark-card border border-dark-border rounded-xl p-6 hover:border-premium-gold/50 transition-all duration-300;
}

.card-hover {
  @apply hover:shadow-2xl hover:shadow-premium-gold/20;
}

.section {
  @apply py-16 lg:py-24 px-4 sm:px-6 lg:px-8;
}

.container-custom {
  @apply max-w-7xl mx-auto;
}

.text-h1 {
  @apply text-4xl md:text-6xl font-bold tracking-tight;
}

.text-h2 {
  @apply text-3xl md:text-4xl font-bold tracking-tight;
}

.text-h3 {
  @apply text-2xl md:text-3xl font-semibold;
}

.gradient-gold {
  @apply bg-gradient-to-r from-premium-gold via-premium-gold_dark to-premium-red;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.shimmer {
  animation: shimmer 2s infinite;
  background: linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%);
  background-size: 1000px 100%;
}

.focus-visible {
  @apply focus:outline-none focus:ring-2 focus:ring-premium-gold focus:ring-offset-2 focus:ring-offset-dark-bg;
}

::-webkit-scrollbar {
  @apply w-3;
}

::-webkit-scrollbar-track {
  @apply bg-dark-card;
}

::-webkit-scrollbar-thumb {
  @apply bg-premium-gold rounded-full;
}

::-webkit-scrollbar-thumb:hover {
  @apply bg-premium-gold_dark;
}`,

  'src/types/index.ts': `export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  visible: boolean;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'available'>;

export type AuthSession = {
  isAuthenticated: boolean;
  expiresAt: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};`,

  'src/utils/cn.ts': `export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}`,

  'src/lib/db.ts': `import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;`,

  'prisma/schema.prisma': `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(255)
  slug        String   @unique @db.VarChar(255)
  description String   @db.Text
  price       Decimal  @db.Decimal(10, 2)
  stock       Int      @default(0)
  imageUrl    String?  @db.VarChar(500)
  visible     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([visible])
  @@index([slug])
}`,
};

// Create directories first
const dirsToCreate = [
  'prisma/migrations',
  'src/app/api/products',
  'src/app/api/admin/products',
  'src/app/admin/products',
  'src/app/admin/login',
  'src/app/product',
  'src/components',
  'src/lib',
  'src/services',
  'src/hooks',
  'src/types',
  'src/utils',
  'src/styles',
  'public',
];

console.log('📁 Creating directories...');
dirsToCreate.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✓ ${dir}`);
  }
});

console.log('\n📝 Creating files...');
Object.entries(files).forEach(([filePath, content]) => {
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

console.log('\n✅ Project structure created successfully!');
