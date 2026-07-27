import { Payment } from '@prisma/client';

import { RedsysClient } from './client';
import { REDSYS } from './constants';
import { RedsysVerificationService } from './verify';

import type {
  RedsysMerchantResponse,
  RedsysNotification,
  RedsysPaymentSession,
} from './types';

export class RedsysPaymentService {

  private readonly client = new RedsysClient();

  private readonly verificationService =
    new RedsysVerificationService();

  /**
   * Generates the HTML POST parameters required to redirect the customer
   * to the Redsys payment gateway.
   *
   * The Payment entity must already exist in the database.
   */
  async createRedirectForm(
    payment: Payment,
  ): Promise<RedsysPaymentSession> {

    return this.client.createPayment({
      order: payment.orderNumber,
      amount: Number(payment.amount),
      merchantData: payment.id,
      titular: this.extractCustomerName(payment),
      productDescription: this.buildProductDescription(payment),
      consumerLanguage: REDSYS.DEFAULT_CONSUMER_LANGUAGE,
    });

  }

  /**
   * Validates the Redsys notification signature and decodes
   * the merchant parameters.
   *
   * Throws if the signature is invalid.
   */
  verifyNotification(
    merchantParameters: string,
    signature: string,
  ): RedsysMerchantResponse {

    return this.verificationService.verifyNotification({
      merchantParameters,
      signature,
    });

  }

  /**
   * Returns true when Redsys considers the transaction successful.
   *
   * Response codes:
   *
   * 0000 - 0099  => Approved
   * >=0100       => Declined
   */
  isSuccessfulPayment(
    notification: RedsysNotification,
  ): boolean {

    const response =
      Number(notification.Ds_Response);

    return response >= 0 &&
      response <= 99;

  }

  /**
   * Extracts the internal Payment identifier stored in
   * Ds_MerchantData.
   */
  getPaymentId(
    notification: RedsysNotification,
  ): string {

    if (!notification.Ds_MerchantData) {
      throw new Error(
        'Ds_MerchantData is missing.',
      );
    }

    return notification.Ds_MerchantData;

  }

  /**
   * Returns the Redsys order number.
   */
  getOrderNumber(
    notification: RedsysNotification,
  ): string {

    return notification.Ds_Order;

  }

  /**
   * Returns the authorization code assigned by the bank.
   */
  getAuthorizationCode(
    notification: RedsysNotification,
  ): string | null {

    return notification.Ds_AuthorisationCode ??
      null;

  }

  /**
   * Amount paid in euros.
   */
  getAmount(
    notification: RedsysNotification,
  ): number {

    return Number(notification.Ds_Amount) / 100;

  }

  private extractCustomerName(
    payment: Payment,
  ): string | undefined {

    if (
      !payment.customerData ||
      typeof payment.customerData !== 'object'
    ) {
      return undefined;
    }

    const customer =
      payment.customerData as Record<string, unknown>;

    const fullName =
      customer.fullName;

    return typeof fullName === 'string'
      ? fullName
      : undefined;

  }

  private buildProductDescription(
    payment: Payment,
  ): string {

    if (
      !payment.items ||
      !Array.isArray(payment.items)
    ) {
      return 'Pedido TCG Iberia';
    }

    const items =
      payment.items as Array<Record<string, unknown>>;

    const names = items
      .map((item) => item.name)
      .filter(
        (value): value is string =>
          typeof value === 'string',
      );

    if (names.length === 0) {
      return 'Pedido TCG Iberia';
    }

    const description =
      names.join(', ');

    return description.length <= 125
      ? description
      : `${description.substring(0, 122)}...`;

  }

}

export const redsysPaymentService =
  new RedsysPaymentService();