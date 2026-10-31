# TCG Iberia - Pokémon TCG Premium Ecommerce

A production-ready, premium ecommerce landing page for Pokémon TCG collectors. Built with Next.js 15, TypeScript, Tailwind CSS, Prisma, and Supabase (Postgres + Storage).

## Features

✨ **Public Website**
- Premium dark luxury design
- Dynamic product catalog
- Category, search, and B2B catalogs support a two-handle price slider and ascending/descending price sorting, with separate and combined reset actions. The slider starts at the lowest and highest catalog prices; filtering applies when a handle is released (or after keyboard adjustment), without an Apply button. Prices match the cards (discounted lowest public variant, or sealed wholesale price excluding taxes for B2B); resetting sorting restores the original catalog/relevance order.
- Product detail pages
- The shopping-cart header includes "Vaciar carrito" to remove all items and persist the empty cart.
- Only the `/raw` catalog shows product-card cart buttons: beside the compact price and stock on mobile, and over the product image's bottom-right corner on desktop. Other catalogs use product-detail pages for purchasing.
- Filtered category catalogs with no results offer "Restablecer filtros" to clear price, language, and availability filters while keeping the catalog type and selected sort order.
- Trust/credibility section
- Contact CTA (WhatsApp/Email)
- Mobile-first responsive design
- SEO optimized

🚀 **Tech Stack**
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with dark theme
- **Database**: Supabase PostgreSQL + Prisma ORM
- **Storage**: Supabase Storage (product-images)
- **Deployment**: Vercel

## Quick Start

### Prerequisites
- Node.js >=18.0
- Supabase account
- Git

### 1. Setup Environment

```bash
cd tcg-iberia
npm install
cp .env.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` with your credentials:

```env
DATABASE_URL=postgresql://user:password@host/database
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
```

### 3. Setup Database

```bash
npm run prisma:migrate
```

### 4. Start Development

```bash
npm run dev
```

Visit http://localhost:3000

## Admin Panel

Navigate to http://localhost:3000/admin and log in with your `ADMIN_PASSWORD`.

### Admin Features
- Add/Edit/Delete products
- Image upload to S3
- Manage stock and pricing
- Discount previews show final Sellado and Apertura en directo prices; the optional live-opening variant is marked "No configurada" when no price is set.
- The admin product list shows discounted prices and crossed-out original prices in both Sellado and Apertura en directo columns.
- Toggle product visibility
- Auto-generated product slugs

## API Documentation

**Public Endpoints:**
- `GET /api/products` - List visible products
- `GET /api/products/[slug]` - Get product details

**Admin Endpoints (Protected):**
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/[id]` - Update product
- `DELETE /api/admin/products/[id]` - Delete product

## Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Set environment variables in Vercel dashboard, then run:
```bash
vercel env pull .env.production.local
npm run prisma:migrate
```

## Development Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run lint             # Lint code
```

## Design

- Dark luxury theme with gold accents
- Mobile-first responsive design
- Premium component library
- Smooth animations and transitions
- Optimized images with Next.js Image

## Security

- Admin password in environment variables
- Secure HttpOnly cookies
- AWS credentials with IAM roles
- CORS configured for S3
- Input validation on all endpoints

## Future Ready

Architecture supports:
- User authentication
- Shopping cart & checkout
- Payment processing (Stripe)
- Order management
- Email notifications
- Analytics dashboard