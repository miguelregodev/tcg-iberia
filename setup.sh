#!/bin/bash
# Setup script for TCG Iberia project
# Run this after cloning: bash setup.sh

set -e

echo "🚀 Setting up TCG Iberia project..."

# Create directory structure
echo "📁 Creating directories..."
mkdir -p prisma/migrations
mkdir -p src/{app,components,lib,services,hooks,types,utils,styles}
mkdir -p src/app/{api,admin,product}
mkdir -p src/app/api/{products,admin}
mkdir -p src/app/api/admin/products
mkdir -p src/app/admin/{products,login}
mkdir -p public

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure .env.local with your environment variables"
echo "2. Set up Supabase database and get DATABASE_URL"
echo "3. Configure AWS S3 bucket and credentials"
echo "4. Run: npm run prisma:migrate"
echo "5. Run: npm run dev"
echo ""
echo "🌐 Visit http://localhost:3000"
echo "🔐 Admin: http://localhost:3000/admin"
