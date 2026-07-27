import { MerchantParameters } from './merchant-parameters';
import { RedsysSignatureService } from './signature';

import type {
  RedsysNotification,
  RedsysMerchantResponse,
} from './types';

export class RedsysVerificationService {

  private readonly signature =
    new RedsysSignatureService();

  /**
   * Verifies a Redsys notification and returns
   * the decoded merchant parameters.
   *
   * Throws if the notification has been modified.
   */
  verify(
    notification: RedsysNotification,
  ): RedsysMerchantResponse {

    this.signature.verify(
      notification.Ds_MerchantParameters,
      notification.Ds_Signature,
    );

    return MerchantParameters.decode<RedsysMerchantResponse>(
      notification.Ds_MerchantParameters,
    );

  }

}