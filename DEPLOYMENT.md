# Vercel Deployment Guide

## Prerequisites

- Node.js installed locally
- Git repository with code
- Vercel account (free at vercel.com)
- Supabase PostgreSQL database
- Supabase Storage bucket (product-images)

## Step 1: Prepare GitHub Repository

```bash
# Initialize git (if not already done)
git init
git branch -M main

# Add all files
git add .

# Create initial commit
git commit -m "feat: TCG Iberia MVP - Next.js ecommerce with Prisma and S3"

# Add GitHub remote
git remote add origin https://github.com/yourusername/tcg-iberia.git

# Push to GitHub
git push -u origin main
```

## Step 2: Connect Vercel to GitHub

1. Go to https://vercel.com
2. Click "Add New Project"
3. Select "Import Git Repository"
4. Connect your GitHub account (if not connected)
5. Select `tcg-iberia` repository
6. Click "Import"

## Step 3: Configure Environment Variables

### In Vercel Dashboard:

1. After importing project, you'll be on settings page
2. Go to "Settings" → "Environment Variables"
3. Add each variable:

```
DATABASE_URL=postgresql://user:pass@host:5432/db
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key
ADMIN_PASSWORD=your-very-secure-password
JWT_SECRET=random-secret-string-here
```

**Environment**: Select "Production", "Preview", "Development" as needed.

### B2B access emails

- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` for your SMTP provider.
- Set `ADMIN_EMAIL` to the inbox that should receive new B2B access requests; it defaults to `sales@tcgiberia.com`.
- Set `NEXT_PUBLIC_APP_URL` to the public website origin. Approval, activation resend, and request notification links use this URL, or the incoming request's origin when unset. Production rejects loopback URLs.
- New requests wait for both the applicant's documentation email and the admin notification before responding. Delivery failures are captured in Sentry under `b2b` / `docs_email` or `admin_email`. Existing pending requests do not resend notifications on repeat submissions.
- Approval and activation resend wait for SMTP completion. If approval succeeds but email fails, the admin panel reports the failure; use the resend action under **Clientes** after resolving SMTP configuration.
- Activation links expire after 72 hours. Resending invalidates older unused links, so customers must use the newest email. Opening a link does not consume it; setting a password does.
- Redeploy after changing Vercel environment variables. Verify a fresh request reaches `ADMIN_EMAIL`, then approve it and open the newest activation email on the public site.

## Step 4: Deploy

### First Deploy:

1. After setting env vars, click "Deploy"
2. Vercel builds and deploys (takes ~3-5 minutes)
3. Get deployment URL

### Important: Redsys Payment Processing

**This project uses Redsys for payment processing, which requires DES encryption support.**

The codebase automatically handles this via a wrapper script (`node-with-legacy-provider.js`) that enables OpenSSL legacy algorithms.

**Vercel Configuration Required:**

Vercel should auto-detect and use the build/start commands from `package.json`, which include the wrapper. However, **verify the following in Vercel Dashboard**:

1. Go to Settings → Build & Development Settings
2. Ensure **Build Command** is: `npm run build`
3. Ensure **Start Command** is: `npm run start`
4. These commands use the wrapper script that enables `--openssl-legacy-provider`

**If payment processing fails with `error:0308010C`:**
- Check Vercel build/start commands above
- Ensure `node-with-legacy-provider.js` file exists in repository root
- Verify `package.json` scripts reference the wrapper

**Local Development:**
Always use `npm run dev` (not `next dev` directly) to enable legacy OpenSSL algorithms.

### Subsequent Deploys:

Automatic on every `git push` to main branch:

```bash
git add .
git commit -m "Fix: Update hero styling"
git push origin main
# Vercel auto-deploys
```

## Step 5: Initialize Database

After first successful deploy:

```bash
# In your local terminal:
vercel env pull .env.production.local

# Run migrations on production database
npm run prisma:migrate -- --skip-generate
```

Or, run via Vercel CLI:

```bash
vercel env pull
npm run prisma:migrate
vercel --prod
```

## Step 6: Custom Domain (Optional)

1. In Vercel Dashboard > Project Settings
2. Click "Domains"
3. Add your domain (e.g., tcgiberia.com)
4. Update your domain's DNS records:
   - CNAME: `cname.vercel.com`
   - Or use Vercel's provided nameservers
5. SSL certificate auto-generates in 24 hours

## Step 7: Admin Panel Access

1. Visit https://yourvercel.app/admin
2. Login with your `ADMIN_PASSWORD`
3. Add products with S3 image uploads

## Monitoring & Logs

### View Deployment Logs:

```bash
vercel logs --prod
```

### View Function Logs:

In Vercel Dashboard > Project > "Deployments" > Click deployment > "Logs"

### Monitor Performance:

In Vercel Dashboard > "Analytics"

## Rollback Deployment

```bash
# View deployment history
vercel ls

# Rollback to previous deployment
vercel rollback
```

## Environment-Specific Configuration

### Add Preview Environment Variables:

```
NEXT_PUBLIC_APP_URL=https://preview-app.vercel.app
```

Then in code:

```typescript
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
```

## Automatic Deployments

Vercel auto-deploys on:
- Every push to `main` (Production)
- Every push to other branches (Preview)
- Pull requests (Preview + auto-comment)

### Disable Auto-Deploy:

Settings → Git → toggle "Deploy on push"

## Database Deployment Notes

### First Time:

```bash
npm run prisma:migrate
```

This:
- Creates tables
- Runs all migration files
- Safe to run multiple times

### After Schema Changes:

```bash
# Locally
npx prisma migrate dev --name add_field

# Then push to GitHub
git push origin main

# Vercel will deploy
# Then run migration:
npm run prisma:migrate
```

## Troubleshooting Deployments

### Build Failed

Check Vercel logs:
```bash
vercel logs --prod
```

Common issues:
- Missing environment variables
- TypeScript errors
- Prisma client not generated

**Fix:**
```bash
git push origin main  # Retry deploy
```

### Database Connection Error

1. Verify `DATABASE_URL` is correct
2. Check Supabase project status
3. Ensure whitelist allows Vercel IPs (usually auto)

### Supabase Storage Upload Failing

1. Verify SUPABASE_SERVICE_ROLE_KEY is set in Vercel server env (do not expose it client-side)
2. Check the storage bucket `product-images` exists in your Supabase project
3. Ensure file size/type limits are respected (5MB max by default)
4. Check Supabase project logs for storage errors

### Redsys Payment Processing Error: `error:0308010C:digital envelope routines::unsupported`

This error occurs when trying to process payments through Redsys.

**Root Cause**: Redsys uses DES encryption which is disabled by default in Node.js 17+ with OpenSSL 3.x.

**Solution**:
1. Verify Vercel build/start commands are using the wrapper:
   - Build: `npm run build` (uses `node-with-legacy-provider.js`)
   - Start: `npm run start` (uses `node-with-legacy-provider.js`)
2. Ensure `node-with-legacy-provider.js` is in the repository root
3. Verify `package.json` contains the wrapper script configuration
4. In Vercel Settings → Build & Development Settings, ensure build/start commands are set to defaults (or explicitly: `npm run build` and `npm run start`)

**For Local Testing:**
```bash
npm run dev    # Uses wrapper (correct)
next dev       # Does NOT use wrapper (will fail with DES error)
```

### Admin Login Not Working

1. Verify `ADMIN_PASSWORD` env var set
2. Check cookies not blocked in browser
3. Clear browser cache
4. Check middleware.ts exists

## Performance Optimization

### Image Optimization:

Already configured in `next.config.js`:
```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '**.amazonaws.com',
    },
  ],
}
```

### Database Query Optimization:

Use Prisma Studio to analyze queries:
```bash
npm run prisma:studio
```

### Build Size:

```bash
npm run build
# Check .next/static folder
```

## Scaling for Production

### Current Limits:
- Vercel: 25 concurrent functions
- Supabase: Depends on plan
- S3: Unlimited (pay per GB)

### Upgrade When Needed:

1. **Vercel Pro**: $20/month for more features
2. **Supabase Paid**: Scale database
3. **AWS**: Increase S3 transfer quota

## Security in Production

✅ Already Configured:
- HTTPS/SSL auto-enabled
- Secure cookies (httpOnly)
- Admin auth required for API
- Database queries parameterized

⚠️ Additional Steps:

1. Enable Vercel "Security Headers":
   - Settings → "Security" → Enable options

2. Add rate limiting (optional):
   ```typescript
   // Add in API route handler
   const rateLimit = require('express-rate-limit');
   ```

3. Monitor for 404s and errors:
   - Dashboard → "Analytics"

## Backup & Disaster Recovery

### Database Backup:

Supabase auto-backups daily (7-30 days retention)

Manual backup:
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Code Recovery:

Always in GitHub - no action needed

### S3 Versioning:

Enable in AWS S3:
- Bucket > Properties > Versioning

## Cost Estimation

Monthly costs (rough estimates):

| Service | Free Tier | Cost |
|---------|-----------|------|
| Vercel | 100 GB bandwidth | $20 Pro |
| Supabase | 500 MB DB | $5/month + |
| AWS S3 | 5 GB storage | $0.50-1 per GB + transfer |
| **Total** | | **$25-30/month** |

## Maintenance

### Weekly:
- Check Vercel Analytics for errors
- Monitor database performance

### Monthly:
- Review cost usage
- Update dependencies: `npm update`
- Check security advisories: `npm audit`

### Quarterly:
- Review and optimize slow queries
- Archive old orders/data if needed
- Update SSL certificates (auto)

## Support

- Vercel Help: https://vercel.com/help
- Supabase Support: https://supabase.com/support
- AWS Support: https://console.aws.amazon.com/support

---

Your production MVP is now live! 🎉
