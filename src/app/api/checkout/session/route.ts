import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Fetch the checkout session with line items
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Format the response with line item details
    const lineItems = session.line_items?.data || [];

    const formattedLineItems = lineItems.map((item) => ({
      name: item.description || 'Product',
      quantity: item.quantity || 0,
      price: ((item.amount_subtotal || 0) / item.quantity!) / 100, // Convert from cents
      subtotal: (item.amount_subtotal || 0) / 100, // Convert from cents
      image: item.price?.product && typeof item.price.product === 'object' 
        ? (item.price.product as any).images?.[0] 
        : null,
    }));

    return NextResponse.json({
      sessionId: session.id,
      status: session.payment_status,
      totalAmount: (session.amount_total || 0) / 100, // Convert from cents
      currency: session.currency?.toUpperCase() || 'EUR',
      lineItems: formattedLineItems,
      customerEmail: session.customer_email,
      createdAt: new Date(session.created * 1000).toLocaleDateString(),
    });
  } catch (error: unknown) {
    console.error('Session retrieval error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve session';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
