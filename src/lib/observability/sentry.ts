import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';

type CaptureServerErrorArgs = {
  error: unknown;
  module: string;
  request?: NextRequest | Request;
  orderId?: string;
  productId?: string;
  userEmail?: string;
  extra?: Record<string, unknown>;
};

export function captureServerError({
  error,
  module,
  request,
  orderId,
  productId,
  userEmail,
  extra,
}: CaptureServerErrorArgs) {
  Sentry.withScope((scope) => {
    scope.setTag('module', module);

    if (request) {
      const url = request instanceof NextRequest ? request.nextUrl.pathname : new URL(request.url).pathname;
      scope.setTag('request_path', url);
      scope.setContext('request', { path: url, method: request.method });
    }

    if (orderId) scope.setTag('order_id', orderId);
    if (productId) scope.setTag('product_id', productId);

    if (userEmail) {
      scope.setUser({ email: userEmail });
    }

    if (extra) {
      scope.setContext('extra', extra);
    }

    Sentry.captureException(error);
  });
}
