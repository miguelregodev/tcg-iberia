import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { ReleasesCalendar } from '@/components/releases/ReleasesCalendar';
import { getReleasesForMonth } from '@/lib/releases';
import { groupProductsByDay, buildCalendarGrid } from '@/lib/calendar-utils';

export const metadata: Metadata = {
  title: 'Calendario de Lanzamientos Pokémon TCG | TCG Iberia',
  description:
    'Consulta todas las próximas fechas de lanzamiento de Pokémon TCG japonés y coreano.',
};

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

function parseMonthParam(
  monthParam: string | undefined,
): { year: number; month: number } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return { year: currentYear, month: currentMonth };
  }

  const [y, m] = monthParam.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    return { year: currentYear, month: currentMonth };
  }

  const min = new Date(currentYear, currentMonth - 1, 1);
  const max = new Date(currentYear, currentMonth + 11, 1);
  const requested = new Date(y, m - 1, 1);

  if (requested < min) return { year: currentYear, month: currentMonth };
  if (requested > max) {
    return { year: max.getFullYear(), month: max.getMonth() + 1 };
  }

  return { year: y, month: m };
}

export default async function ReleasesCalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);

  const products = await getReleasesForMonth(year, month);
  const productsByDay = groupProductsByDay(products);
  const calendarGrid = buildCalendarGrid(year, month, productsByDay);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gray-50">
        {/* Hero header — matches Preorders section style */}
        <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-red-900 to-black text-white">
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(220,38,38,0.4) 0%, transparent 60%)',
            }}
          />
          <div className="container-custom px-4 relative z-10 py-8 md:py-12">
            <span className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
              Próximas novedades
            </span>
            <h1 className="font-airstrike text-2xl md:text-4xl lg:text-5xl tracking-wider leading-tight">
              calendario de lanzamientos
            </h1>
            <p className="mt-2 text-gray-300 text-sm md:text-base max-w-2xl">
              Consulta todas las fechas de lanzamiento de Pokémon TCG.
            </p>
          </div>
        </section>

        <div className="container-custom section">
          <ReleasesCalendar
            calendarGrid={calendarGrid}
            year={year}
            month={month}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
