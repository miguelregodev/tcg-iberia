import CheckoutSuccessClient from './CheckoutSuccessClient';

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  return (
    <CheckoutSuccessClient
      sessionId={searchParams.session_id ?? null}
    />
  );
}