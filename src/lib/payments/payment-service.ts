import {
  Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { db } from '@/lib/db';
import { getNextOrderNumber } from '@/lib/orders/order-number';
import { toJson } from '@/lib/db/json';

export interface CreatePaymentCustomerData {
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingLocality: string;
  shippingProvince: string;
}

export interface CreatePaymentItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number;
  imageUrl?: string;
  releaseDate?: string | null;
  isPreorder?: boolean;
}

export interface CreatePaymentRequest {
  amount: number;
  customerData: CreatePaymentCustomerData;
  items: CreatePaymentItem[];
}

export interface PaymentResult {
  id: string;
  orderNumber: string;
  amount: number;
}

export class PaymentService {
  /**
   * Creates a new pending payment before redirecting the customer
   * to the payment gateway.
   */
  async createPayment(
    request: CreatePaymentRequest,
  ): Promise<PaymentResult> {
    return db.$transaction(async (tx) => {
      const orderNumber = await getNextOrderNumber(tx);

      const payment = await tx.payment.create({
        data: {
          orderNumber,
          provider: PaymentProvider.REDSYS,
          status: PaymentStatus.PENDING,
          amount: new Prisma.Decimal(request.amount),
          customerData: toJson(request.customerData),
          items: toJson(request.items),
        },
      });

      return {
        id: payment.id,
        orderNumber: payment.orderNumber,
        amount: Number(payment.amount),
      };
    });
  }

  async getById(id: string): Promise<Payment | null> {
    return db.payment.findUnique({
      where: {
        id,
      },
    });
  }

  async getByOrderNumber(
    orderNumber: string,
  ): Promise<Payment | null> {
    return db.payment.findUnique({
      where: {
        orderNumber,
      },
    });
  }

  async markAsPaid(
    payment: Payment,
    transactionId: string,
    authorizationCode?: string,
  ): Promise<Payment> {
    return db.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        transactionId,
        authorizationCode,
      },
    });
  }

  async markAsFailed(
    payment: Payment,
  ): Promise<Payment> {
    return db.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: PaymentStatus.FAILED,
      },
    });
  }

  async markAsCancelled(
    payment: Payment,
  ): Promise<Payment> {
    return db.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: PaymentStatus.CANCELLED,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await db.payment.delete({
      where: {
        id,
      },
    });
  }

  // -----------------------------------------------------------------------
  // State helpers
  // -----------------------------------------------------------------------

  isPending(payment: Payment): boolean {
    return payment.status === PaymentStatus.PENDING;
  }

  isProcessed(payment: Payment): boolean {
    return payment.status === PaymentStatus.PAID;
  }

  isFailed(payment: Payment): boolean {
    return payment.status === PaymentStatus.FAILED;
  }

  isCancelled(payment: Payment): boolean {
    return payment.status === PaymentStatus.CANCELLED;
  }

  canBeProcessed(payment: Payment): boolean {
    return payment.status === PaymentStatus.PENDING;
  }
}

export const paymentService = new PaymentService();