# TCG Iberia MVP - Complete Setup & Deployment Guide

Welcome! This is your complete guide to getting the TCG Iberia ecommerce platform running locally and deploying to production.

---

## 📋 Table of Contents

1. **Local Development** - Get running on your machine
2. **Database Setup** - Configure Supabase PostgreSQL
3. **Supabase Storage Setup** - Configure image uploads
4. **Admin Panel** - Create and manage products
5. **Deployment** - Launch to Vercel
6. **Troubleshooting** - Common issues and fixes

---

## 🚀 LOCAL DEVELOPMENT (15 minutes)

### Prerequisites

- Node.js 18+ ([download](https://nodejs.org))
- Git ([download](https://git-scm.com))
- Code editor (VSCode recommended)
- Terminal/Command prompt

### Step 1: Generate Project Files

```bash
cd tcg-iberia

# Generate all project files and directories
node generate-all.js
```

This creates:
- All source files in `src/`
- All components
- Database schema
- API routes
- Configuration files

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
# Copy example to .env.local
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Admin
ADMIN_PASSWORD=your-admin-password-here
JWT_SECRET=your-jwt-secret-here
```

### Step 4: Setup Database

**Use Supabase** (see **Database Setup** section below for full instructions)

### Step 5: Initialize Prisma

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open database browser (optional)
npm run prisma:studio
```

### Step 6: Start Development Server

```bash
npm run dev
```

Visit:
- 🌐 **Homepage**: http://localhost:3000
- 🔐 **Admin Panel**: http://localhost:3000/admin
  - Default password: what you set in `ADMIN_PASSWORD`

---

## 🗄️ DATABASE SETUP (Supabase)

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "New project"
3. Fill in:
   - **Name**: tcg-iberia
   - **Database password**: Strong password (save it!)
   - **Region**: Choose closest to you (EU recommended)
4. Wait 5-10 minutes for setup

### Step 2: Get Connection String

1. In Supabase, go to "Settings" → "Database"
2. Copy the connection string under "Connection string"
3. Replace:
   - `[YOUR-PASSWORD]` with your database password
   - `[YOUR-PROJECT-ID]` with your project ID

Example format:
```
postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
```

### Step 3: Update Environment

Add to `.env.local`:

```env
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
```

### Step 4: Run Migrations

```bash
npm run prisma:migrate
```

✅ Your database is now ready!

---

## ☁️ AWS S3 SETUP

This stores product images and is **required for admin panel**.

### Step 1: Create S3 Bucket

1. Go to https://console.aws.amazon.com/s3
2. Click "Create bucket"
3. **Bucket name**: `tcg-iberia-products`
4. **Region**: Choose same as Supabase
5. Click "Create bucket"

### Step 2: Configure CORS

1. Select your bucket
2. Go to "Permissions" → "CORS"
3. Paste this configuration:

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

4. Click "Save"

### Step 3: Create IAM User

1. Go to https://console.aws.amazon.com/iam
2. Click "Users" → "Create user"
3. **Username**: `tcg-iberia-app`
4. Click "Next"
5. Click "Create user" (skip group)
6. Click on the user
7. Go to "Security credentials" → "Create access key"
8. Choose "Application running outside AWS"
9. Copy the Access Key ID and Secret Access Key

### Step 4: Add S3 Permissions

1. In IAM user settings, go to "Permissions"
2. Click "Add permissions" → "Create inline policy"
3. Choose "JSON" and paste:

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

4. Click "Review policy"
5. Name it `S3ProductsAccess`
6. Click "Create policy"

### Step 5: Add AWS Credentials to Environment

Update `.env.local`:

```env
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA...  (from step 3)
AWS_SECRET_ACCESS_KEY=...  (from step 3)
AWS_BUCKET_NAME=tcg-iberia-products
```

✅ AWS S3 is now configured!

---

## 🛠️ ADMIN PANEL USAGE

### Login

1. Navigate to http://localhost:3000/admin
2. Enter your `ADMIN_PASSWORD` from `.env.local`
3. Click "Login"

### Add a Product

1. Click "Add Product"
2. Fill in details:
   - **Name**: "Charizard EX"
   - **Description**: "Holographic first edition"
   - **Price**: 199.99
   - **Stock**: 5
3. **Upload Image**: Drag & drop or click to select
4. Toggle **Visible** if you want it on public site
5. Click "Save Product"

### Manage Products

- **Edit**: Click "Edit" button to update
- **Delete**: Click "Delete" to remove
- **Toggle Visibility**: Edit product, toggle "Visible"
- **Update Stock**: Edit product, change stock number

### Product Details

Each product needs:
- **Name**: Product title
- **Description**: Detailed specs/condition
- **Price**: In €
- **Stock**: Number available (0 = sold out)
- **Image**: High-quality product photo
- **Visible**: Show on public site?

---

## 🚀 DEPLOYMENT TO VERCEL

### Prerequisites

- GitHub account
- Code pushed to GitHub repository
- All environment variables configured

### Step 1: Push to GitHub

```bash
# Initialize git
git init
git branch -M main
git add .
git commit -m "feat: TCG Iberia MVP launch"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR-USERNAME/tcg-iberia.git
git push -u origin main
```

### Step 2: Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow prompts:
- Link GitHub account
- Select `tcg-iberia` repo
- Confirm settings
- Deploy

### Step 3: Add Environment Variables

1. In Vercel dashboard, go to project
2. Settings → Environment Variables
3. Add all from `.env.local`:

```
DATABASE_URL
ADMIN_PASSWORD
JWT_SECRET
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_BUCKET_NAME
```

4. Redeploy from "Deployments"

### Step 4: Initialize Production Database

```bash
vercel env pull .env.production.local
npm run prisma:migrate -- --skip-generate
```

### Step 5: Add Custom Domain (Optional)

1. Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records (Vercel will provide)
4. SSL auto-generates

✅ Your site is now live!

---

## 🔐 SECURITY CHECKLIST

Before going live:

- [ ] Change `ADMIN_PASSWORD` to strong password
- [ ] Generate random `JWT_SECRET`
- [ ] AWS user has minimal permissions
- [ ] S3 bucket blocks public access
- [ ] CORS allows only your domain
- [ ] `.env.local` in `.gitignore` ✓
- [ ] Environment variables in Vercel ✓
- [ ] HTTPS enabled (auto in Vercel) ✓
- [ ] Database backups enabled (Supabase) ✓

---

## 📱 TESTING CHECKLIST

Before launch:

### Public Site
- [ ] Homepage loads
- [ ] Product catalog shows
- [ ] Products have images
- [ ] Product detail page works
- [ ] Contact CTA buttons work
- [ ] Mobile responsive

### Admin Panel
- [ ] Can login with password
- [ ] Can add product
- [ ] Image upload to S3 works
- [ ] Can edit product
- [ ] Can delete product
- [ ] Can toggle visibility
- [ ] Cannot access without login

### API
- [ ] GET /api/products returns products
- [ ] GET /api/products/[slug] returns detail
- [ ] Admin endpoints require auth
- [ ] File uploads create S3 URLs

---

## 📊 USEFUL COMMANDS

```bash
# Development
npm run dev                 # Start dev server

# Building
npm run build              # Build for production
npm start                  # Start production server

# Database
npm run prisma:migrate     # Run migrations
npm run prisma:generate    # Update Prisma client
npm run prisma:studio      # Open database browser

# Deployment
vercel                     # Deploy to Vercel
vercel env pull            # Pull env variables
vercel logs --prod         # View production logs

# Code Quality
npm run lint               # Lint code
```

---

## 🐛 TROUBLESHOOTING

### "Database connection failed"

```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### "Admin login not working"

- Check `.env.local` has `ADMIN_PASSWORD`
- Clear browser cookies
- Try incognito mode
- Restart dev server

### "S3 upload failed"

- Check AWS credentials in `.env.local`
- Verify bucket exists with correct name
- Check CORS policy includes localhost
- Verify IAM user has S3 permissions

### "TypeScript errors"

```bash
npm run prisma:generate
npm run build
```

### "Pages not found (404)"

```bash
# Regenerate all files
node generate-all.js

# Restart dev server
npm run dev
```

---

## 📞 NEXT STEPS

1. **Customize Content**: Update hero, trust section, contact info
2. **Add Your Details**: WhatsApp, email, social links
3. **Brand Assets**: Logo, favicon, colors
4. **SEO Optimization**: Meta tags, structured data
5. **Analytics**: Google Analytics tracking
6. **Legal**: Privacy policy, terms of service

---

## 📚 RESOURCES

- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Prisma ORM**: https://www.prisma.io/docs
- **Supabase**: https://supabase.com/docs
- **AWS S3**: https://docs.aws.amazon.com/s3
- **Vercel Docs**: https://vercel.com/docs

---

## ✅ Success!

Your production-ready TCG Iberia ecommerce platform is now:

✨ Locally running with hot-reload development
🗄️ Connected to Supabase PostgreSQL
☁️ Uploading images to AWS S3
🔐 Secured with admin authentication
🚀 Ready to deploy to Vercel

Happy coding! 🚀
