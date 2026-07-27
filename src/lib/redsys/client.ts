import { redsysConfig } from './config';
import { REDSYS } from './constants';
import { MerchantParameters } from './merchant-parameters';
import { RedsysSignatureService } from './signature';

import type {
  RedsysMerchantParameters,
  RedsysPaymentSession,
} from './types';

export interface CreatePaymentOptions {

  order: string;

  amount: number;

  merchantData?: string;

  productDescription?: string;

  titular?: string;

  consumerLanguage?: string;

}

export class RedsysClient {

  private readonly signature =
    new RedsysSignatureService();

  /**
   * Creates a complete Redsys payment session.
   */
  createPayment(
    options: CreatePaymentOptions,
  ): RedsysPaymentSession {

    const merchantParameters: RedsysMerchantParameters = {

      Ds_Merchant_Amount:
        this.toAmount(options.amount),

      Ds_Merchant_Order:
        options.order,

      Ds_Merchant_MerchantCode:
        redsysConfig.merchantCode,

      Ds_Merchant_Currency:
        redsysConfig.currency,

      Ds_Merchant_TransactionType:
        REDSYS.TRANSACTION_TYPE.PAYMENT,

      Ds_Merchant_Terminal:
        redsysConfig.terminal,

      Ds_Merchant_MerchantURL:
        redsysConfig.merchantUrl,

      Ds_Merchant_UrlOK:
        redsysConfig.urlOk,

      Ds_Merchant_UrlKO:
        redsysConfig.urlKo,

      Ds_Merchant_MerchantName:
        redsysConfig.merchantName,

      Ds_Merchant_ProductDescription:
        options.productDescription,

      Ds_Merchant_Titular:
        options.titular,

      Ds_Merchant_MerchantData:
        options.merchantData,

      Ds_Merchant_ConsumerLanguage:
        options.consumerLanguage,

    };

    const encoded =
      MerchantParameters.encode(
        merchantParameters,
      );

    const signature =
      this.signature.generate(
        encoded,
        options.order,
      );

    return {

      gatewayUrl:
        redsysConfig.gatewayUrl,

      signatureVersion:
        redsysConfig.signatureVersion,

      merchantParameters:
        encoded,

      signature,

    };

  }

  /**
   * Redsys expects the amount in cents,
   * without decimal separator.
   *
   * 24.95 € -> "2495"
   */
  private toAmount(
    amount: number,
  ): string {

    return Math.round(
      amount * 100,
    ).toString();

  }

}