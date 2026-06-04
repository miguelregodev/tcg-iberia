# TCG Iberia - Development Guide

## ⚡ Quick Start (5 minutes)

### 1. Run Project Generator

```bash
# This creates all necessary files and directories
node generate-all.js
```

or run individually:

```bash
node generate-project.js      # Base project files
node generate-app-files.js    # API routes and pages
node generate-components.js   # React components
```

### 2. Setup Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres
ADMIN_PASSWORD=your-very-secure-password-here
JWT_SECRET=your-jwt-secret-key
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=tcg-iberia-products
```

### 3. Install & Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Visit http://localhost:3000

## 🗄️ Database Setup (Supabase)

### Create Supabase Project

1. Go to https://supabase.com
2. Create a new project
3. Copy the PostgreSQL connection string
4. Update `DATABASE_URL` in `.env.local`

Example:
```
postgresql://postgres:password@db.supabase.co:5432/postgres
```

### Run Migrations

```bash
npm run prisma:migrate
```

### View Database

```bash
npm run prisma:studio
```

This opens Prisma Studio to view and manage data in the browser.

## ☁️ AWS S3 Setup

### 1. Create S3 Bucket

1. Go to AWS S3 console
2. Create bucket named `tcg-iberia-products` (or your choice)
3. Set region (e.g., `eu-west-1`)
4. Block public access (images accessed via signed URLs)

### 2. Set CORS Policy

In S3 bucket > Permissions > CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://yourdomain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 3. Create IAM User

1. AWS IAM Console > Users > Create User
2. Attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::tcg-iberia-products/*"
    }
  ]
}
```

3. Generate Access Key
4. Add to `.env.local`

## 🔐 Admin Authentication

### Set Password

```env
ADMIN_PASSWORD=your-secure-password
```

### Access Admin Panel

1. Navigate to http://localhost:3000/admin
2. Enter your password
3. Manage products

### Authentication Flow

- Simple password authentication
- Sets HTTP-only cookie valid for 24 hours
- Cookie checked on admin routes via middleware
- Auto-redirect to login if cookie expires

## 📦 Development Commands

```bash
# Start dev server (auto-reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Generate/update Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Open Prisma Studio (DB browser)
npm run prisma:studio

# Lint code
npm run lint
```

## 📁 Project Structure

```
.
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Homepage
│   │   ├── middleware.ts            # Auth middleware
│   │   ├── api/
│   │   │   ├── products/            # Public endpoints
│   │   │   │   └── [slug]/
│   │   │   └── admin/               # Admin endpoints
│   │   │       ├── auth/
│   │   │       ├── products/
│   │   │       └── upload/
│   │   ├── admin/
│   │   │   ├── login/               # Admin login
│   │   │   └── products/            # Admin dashboard
│   │   └── product/
│   │       └── [slug]/              # Product detail
│   ├── components/                  # React components
│   │   ├── Navigation.tsx
│   │   ├── Hero.tsx
│   │   ├── ProductCatalog.tsx
│   │   ├── ProductCard.tsx
│   │   ├── TrustSection.tsx
│   │   ├── ContactCTA.tsx
│   │   ├── Footer.tsx
│   │   ├── AdminNav.tsx
│   │   ├── ProductForm.tsx
│   │   └── ImageUpload.tsx
│   ├── lib/                         # Utilities
│   │   ├── db.ts                   # Prisma client
│   │   └── s3.ts                   # S3 upload
│   ├── hooks/                       # Custom hooks
│   │   ├── useAuth.ts
│   │   └── useProducts.ts
│   ├── types/                       # TypeScript types
│   ├── utils/                       # Helpers
│   └── styles/
│       └── globals.css
├── prisma/
│   ├── schema.prisma                # Database schema
│   └── migrations/                  # Migration history
├── public/                          # Static files
├── .env.example                     # Environment template
├── tsconfig.json                    # TypeScript config
├── next.config.js                   # Next.js config
├── tailwind.config.ts               # Tailwind config
├── postcss.config.js                # PostCSS config
└── package.json
```

## 🎨 Styling

- **Framework**: Tailwind CSS with custom dark theme
- **Colors**: Dark luxury palette with gold accents
- **Animations**: Smooth transitions and hover effects
- **Responsive**: Mobile-first design
- **Custom CSS**: `src/styles/globals.css` for utilities

### Custom Tailwind Classes

```css
.btn                 /* Premium button base */
.btn-primary         /* Gold button */
.btn-secondary       /* Ghost button with border */
.card                /* Premium card component */
.section             /* Padded section */
.container-custom    /* Max-width container */
.text-h1/h2/h3       /* Heading sizes */
.gradient-gold       /* Text gradient */
```

## 📊 API Routes

### Public Routes

**GET** `/api/products`
```json
[
  {
    "id": "...",
    "name": "Charizard EX",
    "slug": "charizard-ex",
    "price": 199.99,
    "image": "https://...",
    "available": true,
    "description": "..."
  }
]
```

**GET** `/api/products/[slug]`
```json
{
  "id": "...",
  "name": "...",
  "slug": "...",
  "price": 199.99,
  "image": "https://...",
  "available": true,
  "description": "..."
}
```

### Admin Routes (Requires Auth Cookie)

**POST** `/api/admin/products`
Create new product

**PUT** `/api/admin/products/[id]`
Update product

**DELETE** `/api/admin/products/[id]`
Delete product

**POST** `/api/admin/upload`
Upload image to S3

**POST** `/api/admin/auth/login`
Admin login

**POST** `/api/admin/auth/logout`
Admin logout

## 🚀 Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: TCG Iberia MVP"
git branch -M main
git remote add origin https://github.com/yourusername/tcg-iberia.git
git push -u origin main
```

### 2. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow the prompts to connect GitHub repo.

### 3. Set Environment Variables in Vercel

In Vercel Dashboard > Project Settings > Environment Variables:

```
DATABASE_URL          postgresql://...
ADMIN_PASSWORD        your-password
JWT_SECRET            your-secret
AWS_REGION            eu-west-1
AWS_ACCESS_KEY_ID     AKIA...
AWS_SECRET_ACCESS_KEY ...
AWS_BUCKET_NAME       tcg-iberia-products
```

### 4. Deploy Database

After first deploy, run:

```bash
vercel env pull .env.production.local
npm run prisma:migrate -- --skip-generate
```

Or run in Vercel Build Settings as post-deployment hook.

### 5. Custom Domain

In Vercel Dashboard:
1. Add custom domain
2. Update DNS records
3. SSL certificate auto-generated

## 🔒 Security Checklist

- [ ] Change `ADMIN_PASSWORD` to strong password
- [ ] Change `JWT_SECRET` to random string
- [ ] AWS credentials use IAM user (not root)
- [ ] S3 bucket blocks public access
- [ ] CORS only allows your domain
- [ ] DATABASE_URL never committed to git
- [ ] `.env.local` in `.gitignore`
- [ ] All credentials in Vercel environment
- [ ] HTTPS enforced in production
- [ ] Cookies marked HttpOnly and Secure

## 🐛 Troubleshooting

### Prisma Client Not Found

```bash
npm run prisma:generate
```

### Database Connection Failed

- Check `DATABASE_URL` in `.env.local`
- Verify Supabase project is running
- Check network connectivity
- Try: `psql <DATABASE_URL>` to test connection

### S3 Upload Failed

- Verify AWS credentials
- Check bucket exists and region matches
- Verify CORS policy on bucket
- Check IAM permissions

### Middleware Not Protecting Routes

- Verify `src/app/middleware.ts` exists
- Check Next.js version is 13+
- Clear `.next` cache: `rm -rf .next && npm run dev`

### Tailwind Classes Not Applied

- Restart dev server
- Verify Tailwind config includes `src/` paths
- Check `globals.css` imported in `layout.tsx`

## 📚 Resources

- **Next.js**: https://nextjs.org/docs
- **Prisma**: https://www.prisma.io/docs
- **Tailwind**: https://tailwindcss.com/docs
- **Supabase**: https://supabase.com/docs
- **AWS S3**: https://docs.aws.amazon.com/s3
- **Vercel**: https://vercel.com/docs

## 🤝 Support

For issues:

1. Check this guide
2. Check GitHub Issues
3. Contact: info@tcgiberia.com
4. WhatsApp: +34 689 17 87 62

## 📄 License

Private project. All rights reserved.
