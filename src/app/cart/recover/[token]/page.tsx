import { Navigation } from '@/components/Navigation';
import { RecoverCartClient } from './RecoverCartClient';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RecoverCartPage({ params }: Props) {
  const { token } = await params;
  return (
    <>
      <Navigation />
      <RecoverCartClient token={token} />
    </>
  );
}
