import CheckoutSuccessClient from './CheckoutSuccessClient';

export default function CheckoutSuccessPage(props: any) {
  const sessionId = props.searchParams?.session_id ?? null;
  const partyParticipationId = props.searchParams?.party_participation_id ?? null;
  const redsysMerchantParameters = props.searchParams?.Ds_MerchantParameters ?? null;
  const redsysSignature = props.searchParams?.Ds_Signature ?? null;

  return (
    <CheckoutSuccessClient
      sessionId={sessionId}
      partyParticipationId={partyParticipationId}
      redsysMerchantParameters={redsysMerchantParameters}
      redsysSignature={redsysSignature}
    />
  );
}