import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Stripe checkout is deprecated. Use the Redsys payment flow.' },
    { status: 410 },
  );
}
