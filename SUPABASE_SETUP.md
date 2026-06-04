# TCG Iberia - Supabase Setup Guide

## Complete Setup with Supabase (Database + Storage)

Your MVP now uses **Supabase** for both PostgreSQL database and product image storage.

---

## Prerequisites

- Node.js 18+
- Git
- Supabase account (free at https://supabase.com)
- Code editor

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in details:
   - **Name**: tcg-iberia
   - **Database Password**: Strong password (save it!)
   - **Region**: Choose closest to you (EU recommended)
4. Wait 5-10 minutes for project creation

---

## Step 2: Get Supabase Credentials

### Database Connection String:

1. In Supabase, go to **Settings** → **Database**
2. Copy the connection string under "Connection string"
3. Format: `postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres`
4. Replace `[password]` with your database password

### API Keys:

1. In Supabase, go to **Settings** → **API**
2. Copy these three keys:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Public Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Important**: Service Role Key is secret - never expose to browser!

---

## Step 3: Update Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Admin
ADMIN_PASSWORD=your-secure-password-here
JWT_SECRET=your-jwt-secret-here
```

---

## Step 4: Setup Project Locally

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations (creates Product table)
npm run prisma:migrate

# Start development server
npm run dev
```

---

## Step 5: Create Storage Bucket

The first time you upload an image, Supabase Storage bucket will be created automatically.

To manually initialize:

1. In Supabase, go to **Storage**
2. Create new bucket named `product-images`
3. Set it to **Public**

Or run initialization:

```bash
npm run dev
# Visit admin panel and try uploading an image
# Bucket will auto-create on first upload
```

---

## Step 6: Test Everything

### Homepage:
```
http://localhost:3000
```

### Admin Panel:
```
http://localhost:3000/admin
```
Login with your `ADMIN_PASSWORD`

### Add Test Product:

1. Click "Add Product"
2. Fill in details
3. Upload an image
4. Save
5. Image should be in Supabase Storage
6. Product appears on homepage

---

## Supabase Storage Details

### Bucket: `product-images`

**Public Read**: ✅ Yes (URLs are public)
**Upload**: 🔐 Protected (requires auth)
**Max File Size**: 5MB per image
**File Path**: `products/[timestamp]-[random].ext`

### Image URLs

Public URLs look like:
```
https://your-project.supabase.co/storage/v1/object/public/product-images/products/1234567890-abc123.jpg
```

---

## Common Issues

### Database Connection Failed
- Check `DATABASE_URL` format
- Verify Supabase project is running
- Check password is correct

### Storage Upload Fails
- Verify Supabase keys in `.env.local`
- Check bucket `product-images` exists
- Check file size < 5MB

### Missing Product Table
```bash
npm run prisma:migrate
```

### Environment Variables Not Loaded
```bash
# Restart dev server
npm run dev
```

---

## Environment Variables Reference

| Variable | Source | Usage |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Public (frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Public (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Secret (server only) |
| `DATABASE_URL` | Supabase → Settings → Database | Prisma connection |
| `ADMIN_PASSWORD` | You set this | Admin login |
| `JWT_SECRET` | You set this | Token signing |

---

## Security Notes

✅ Service Role Key stored in `.env.local` (not in repo)
✅ Never expose Service Role Key to browser
✅ Anon Key can be public (it's limited)
✅ Admin password protects product management
✅ Storage bucket is public read, auth write

---

## Deployment to Vercel

When deploying:

1. Add all `.env.local` variables to Vercel
2. Supabase automatically works (same DB/storage)
3. Run migrations once: `npm run prisma:migrate`
4. That's it! 🚀

---

## Useful Commands

```bash
npm run dev              # Start dev server
npm install             # Install dependencies
npm run prisma:migrate  # Run database migrations
npm run prisma:studio   # Open database GUI
npm run build           # Build for production
npm start               # Start production server
```

---

## Documentation Files

- **COMPLETE_GUIDE.md** - Full setup guide
- **DEPLOYMENT.md** - Vercel deployment
- **DEVELOPMENT.md** - Dev workflows
- **QUICK_REFERENCE.md** - Commands

---

## Support

Everything runs on Supabase:
- **Database**: PostgreSQL
- **Storage**: Supabase Storage
- **Auth**: Cookie sessions
- **Hosting**: Vercel (optional)

No more AWS! Everything is in Supabase. ✨

---

**Your MVP is now Supabase-powered! 🚀**
