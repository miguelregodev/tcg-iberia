import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { captureServerError } from '@/lib/observability/sentry';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

interface CheckoutItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number;
  imageUrl?: string;
}

interface CustomerData {
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingLocality: string;
  shippingProvince: string;
}

interface CheckoutBody {
  items: CheckoutItem[];
  customerData?: CustomerData;
  shippingCost?: number;
}

interface LineItem {
  price_data: {
    currency: string;
    product_data: {
      name: string;
      images?: string[];
    };
    unit_amount: number;
  };
  quantity: number;
}

export async function POST(request: NextRequest) {
  let customerEmail: string | undefined;

  try {
    const body = await request.json();
    const { items, customerData, shippingCost } = body as CheckoutBody;
    customerEmail = customerData?.email;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items in cart' },
        { status: 400 }
      );
    }

    // Build line items for Stripe
    const lineItems: LineItem[] = items.map((item) => {
      // Calculate final price considering discounts
      const finalPrice = item.discountPercentage
        ? item.price * (1 - item.discountPercentage / 100)
        : item.price;

      // Convert to cents for Stripe (assuming EUR currency)
      const amountInCents = Math.round(finalPrice * 100);

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
            ...(item.imageUrl && { images: [item.imageUrl] }),
          },
          unit_amount: amountInCents,
        },
        quantity: item.quantity,
      };
    });

    // Get the origin for redirect URLs
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Build a Stripe shipping rate so the cost is added to the session total
    // and shown to the customer on Stripe Checkout.
    const shippingAmountCents = Math.max(
      0,
      Math.round(((shippingCost ?? 0) as number) * 100)
    );
    const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] =
      [
        {
          shipping_rate_data: {
            display_name: shippingAmountCents === 0 ? 'Envío gratis' : 'Envío estándar',
            type: 'fixed_amount',
            fixed_amount: {
              amount: shippingAmountCents,
              currency: 'eur',
            },
          },
        },
      ];

    // Create Stripe checkout session with metadata for order tracking
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: lineItems as Stripe.Checkout.SessionCreateParams.LineItem[],
      mode: 'payment',
      shipping_options: shippingOptions,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      payment_intent_data: {
        metadata: customerData ? {
          fullName: customerData.fullName,
          email: customerData.email,
          phone: customerData.phone,
          shippingAddress: customerData.shippingAddress,
          shippingPostalCode: customerData.shippingPostalCode,
          shippingCity: customerData.shippingCity,
          shippingLocality: customerData.shippingLocality,
          shippingProvince: customerData.shippingProvince,
        } : undefined,
      },
    };

    // Add customer email if provided
    if (customerData?.email) {
      sessionParams.customer_email = customerData.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store cart items and customer data in session metadata for webhook processing
    const sessionMetadata = {
      items: JSON.stringify(items),
      ...(customerData && { customerData: JSON.stringify(customerData) }),
    };

    return Response.json({ 
      url: session.url,
      sessionId: session.id,
      metadata: sessionMetadata,
    });
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    captureServerError({
      error,
      module: 'checkout_api',
      request,
      userEmail: customerEmail,
    });
    const errorMessage = error instanceof Error ? error.message : 'Checkout failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
