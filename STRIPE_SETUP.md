# Stripe Checkout Integration Setup

This guide walks you through configuring Stripe Checkout for your TCG Iberia e-commerce store.

## 1. Create a Stripe Account

1. Go to [stripe.com](https://stripe.com) and create a free account
2. Complete the account verification process
3. Navigate to the [API Keys dashboard](https://dashboard.stripe.com/apikeys)

## 2. Get Your Stripe Keys

### Publishable Key (Public)
- Copy your **Publishable Key** from the dashboard
- Prefix: `pk_test_` (test mode) or `pk_live_` (production)
- This is safe to expose in frontend code

### Secret Key (Server-Side Only)
- Copy your **Secret Key** from the dashboard
- Prefix: `sk_test_` (test mode) or `sk_live_` (production)
- **NEVER commit this to version control!** Keep it secret on the server only

## 3. Configure Environment Variables

1. Create a `.env.local` file in the root directory (copy from `.env.example`):

```bash
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key

# Application URL (for redirect URLs in checkout)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

2. **Important:** Add `.env.local` to your `.gitignore` (usually already done)

## 4. Use Restricted API Keys (Recommended)

For production deployments, follow Stripe's security best practices:

1. In Stripe Dashboard: **Developers** → **API Keys** → **Restricted Keys**
2. Create a restricted key with these permissions:
   - **Write**: checkout.sessions
   - **Read**: checkout.sessions (optional, for verification)
3. Use this restricted key as your `STRIPE_SECRET_KEY`

## 5. Update Environment for Different Stages

### Development (Testing)
- Use `pk_test_*` and `sk_test_*` keys
- All transactions are test transactions
- Use test card: `4242 4242 4242 4242` with any future expiry and CVC

### Production
1. Complete Stripe account verification
2. Activate Live Mode in Stripe Dashboard
3. Update `.env` with live keys (`pk_live_*`, `sk_live_*`)
4. Update `NEXT_PUBLIC_APP_URL` to your production domain

## 6. Test the Integration

### Test Mode
1. Start your dev server: `npm run dev`
2. Navigate to a product page
3. Add items to cart
4. Click the shopping bag icon → "Proceed to Checkout"
5. You'll be redirected to Stripe's test checkout
6. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/26)
   - CVC: Any 3 digits (e.g., 123)
   - Zip: Any value

### Successful Checkout Flow
1. Fill in test payment details
2. Click "Pay"
3. You'll be redirected to `/checkout/success` page
4. Order confirmation is displayed with session ID

## 7. Customize Checkout Experience

### Success/Cancel URLs
- Success: `/checkout/success` (after payment)
- Cancel: `/` (if customer cancels)

Edit these in [src/app/api/checkout/route.ts](../src/app/api/checkout/route.ts):

```typescript
success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
cancel_url: `${origin}/`,
```

### Customize Checkout Appearance
Stripe Checkout automatically matches your brand colors. Customize in Stripe Dashboard:
- **Branding**: Settings → Branding → Colors & fonts

## 8. Handle Webhooks (Optional - for advanced use)

Webhooks allow you to listen to Stripe events:

1. In Stripe Dashboard: **Developers** → **Webhooks**
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Subscribe to events: `checkout.session.completed`
4. Copy webhook secret and add to `.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_your_secret
```

## 9. Security Checklist

- ✅ Never expose `sk_*` keys in frontend code
- ✅ Never commit `.env.local` to git
- ✅ Use Restricted API Keys in production
- ✅ Validate requests on the backend
- ✅ Use HTTPS only in production
- ✅ Store sensitive keys in environment variables
- ✅ Set up webhook signing verification

## 10. Implementation Details

### Files Modified/Created
- `src/app/api/checkout/route.ts` - Backend API for creating checkout sessions
- `src/components/ShoppingCartModal.tsx` - Frontend modal with Stripe integration
- `src/app/checkout/success/page.tsx` - Success page after checkout
- `.env.example` - Environment variable template

### Key Features
- ✅ Calculates discounts automatically
- ✅ Supports multiple items in cart
- ✅ Shows product images in checkout
- ✅ Omits `payment_method_types` for dynamic payment methods
- ✅ EUR currency support
- ✅ Error handling and user feedback

## Troubleshooting

### "Stripe publishable key not configured"
- Check `.env.local` exists and has `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Restart dev server after adding env variables

### "Failed to create checkout session"
- Verify `STRIPE_SECRET_KEY` is set correctly
- Check browser console for error details
- Ensure API route is accessible at `/api/checkout`

### "Invalid API Key provided"
- Use test keys (`pk_test_*`, `sk_test_*`) for development
- Copy keys exactly from Stripe Dashboard (no extra spaces)

### Payment Declined in Live Mode
- Verify you've activated Live Mode in Stripe
- Check you're using live keys (`pk_live_*`, `sk_live_*`)
- Ensure the card being tested is valid

## Resources

- [Stripe Checkout Sessions Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Test Cards](https://stripe.com/docs/testing#test-cards)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Security Best Practices](https://stripe.com/docs/security)
