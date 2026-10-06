import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = noIndexMetadata();

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  return children;
}
