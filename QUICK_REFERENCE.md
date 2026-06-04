# TCG Iberia - Quick Reference

## 🚀 First Time Setup

```bash
# 1. Generate project files
node generate-all.js

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Initialize database
npm run prisma:migrate

# 5. Start development
npm run dev
```

Then visit:
- **Site**: http://localhost:3000
- **Admin**: http://localhost:3000/admin (password from .env.local)

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Homepage |
| `src/app/product/[slug]/page.tsx` | Product detail page |
| `src/app/admin/` | Admin panel routes |
| `src/components/` | React components |
| `src/app/api/` | API endpoints |
| `prisma/schema.prisma` | Database schema |
| `.env.example` | Environment template |
| `tailwind.config.ts` | Styling config |

---

## 🔑 Environment Variables

```env
DATABASE_URL              # Supabase PostgreSQL URL
ADMIN_PASSWORD           # Password for admin panel
JWT_SECRET               # Secret key for tokens
AWS_REGION              # e.g., eu-west-1
AWS_ACCESS_KEY_ID       # AWS IAM access key
AWS_SECRET_ACCESS_KEY   # AWS IAM secret key
AWS_BUCKET_NAME         # S3 bucket name
```

---

## 📝 Common Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open database GUI
npm run lint             # Check code quality
vercel                   # Deploy to Vercel
```

---

## 🎯 Admin Panel Workflow

1. Login: `http://localhost:3000/admin`
2. Click "Add Product"
3. Fill form:
   - Name, description, price
   - Upload image (drag-drop)
   - Set stock, visibility
4. Click "Save Product"
5. Product appears on homepage

---

## 🗄️ Database Locations

- **Local**: `postgresql://localhost/tcg_iberia_dev`
- **Supabase**: Get from project → Database → Connection string
- **View GUI**: `npm run prisma:studio`

---

## 📦 Deployment

```bash
# Push to GitHub
git add .
git commit -m "deploy: ready for production"
git push origin main

# Deploy to Vercel
vercel

# Add env vars in Vercel dashboard, then:
vercel env pull .env.production.local
npm run prisma:migrate -- --skip-generate
```

---

## 🔒 Security

- ✅ `.env.local` in `.gitignore`
- ✅ Admin password in env var
- ✅ Secure cookies (HttpOnly)
- ✅ AWS IAM user (not root)
- ✅ S3 blocks public access
- ✅ HTTPS in production

---

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| Can't login admin | Check `ADMIN_PASSWORD` in `.env.local` |
| S3 upload fails | Verify AWS credentials & CORS policy |
| Prisma error | Run `npm run prisma:generate` |
| TypeScript errors | Run `npm run build` to see all errors |
| .next cache issues | `rm -rf .next && npm run dev` |

---

## 🔗 Important Links

- **Homepage**: http://localhost:3000
- **Admin Login**: http://localhost:3000/admin
- **API Products**: http://localhost:3000/api/products
- **Prisma Studio**: http://localhost:5555 (when running)

---

## 📞 Customization

Edit these files to customize:

| File | Customizes |
|------|-----------|
| `src/components/Hero.tsx` | Homepage hero section |
| `src/components/ContactCTA.tsx` | Contact/WhatsApp button |
| `src/components/Navigation.tsx` | Navigation bar |
| `tailwind.config.ts` | Colors & theme |
| `.env.example` | Contact info URLs |

---

## ✨ Next Features (Ready for)

- [ ] User authentication
- [ ] Shopping cart
- [ ] Checkout/Payments (Stripe)
- [ ] Order management
- [ ] Email notifications
- [ ] Analytics dashboard
- [ ] Inventory sync

Architecture supports all of these without refactoring!

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| Lines of Code | ~2000 |
| Components | 10+ |
| API Routes | 8+ |
| Database Models | 1 (Product) |
| Deployment | Vercel |
| Database | Supabase/PostgreSQL |
| Image Storage | AWS S3 |

---

**Last Updated**: 2024
**Status**: Production Ready ✅
