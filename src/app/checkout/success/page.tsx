import CheckoutSuccessClient from './CheckoutSuccessClient';

export default function CheckoutSuccessPage(props: any) {
  const sessionId = props.searchParams?.session_id ?? null;

  return <CheckoutSuccessClient sessionId={sessionId} />;
}