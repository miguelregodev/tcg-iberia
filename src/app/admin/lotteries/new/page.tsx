'use client';

import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import LotteryForm from '../LotteryForm';

export default function NewLotteryPage() {
  return (
    <div className="min-h-screen bg-dark-bg text-text-primary">
      <AdminNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/admin/lotteries" className="text-sm text-premium-gold underline-offset-4 hover:underline">
          Volver a sorteos
        </Link>
        <h1 className="mb-6 mt-3 text-2xl font-bold">Nuevo sorteo</h1>
        <LotteryForm
          initialValues={{
            title: '',
            prize: '',
            description: '',
            prizeImageUrl: '',
            startDate: '',
            endDate: '',
            minimumOrderAmount: '',
          }}
        />
      </main>
    </div>
  );
}
