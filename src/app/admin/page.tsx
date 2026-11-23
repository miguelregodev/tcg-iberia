/**
 * Admin home (landing page shown after login).
 *
 * Access is enforced by the middleware (signed `tcg_admin_auth` cookie) and
 * re-checked here server-side. Shows a few actionable counters and quick
 * links to every back-office section.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { verifyAdminSessionToken } from '@/lib/admin-auth';
import { AdminNav } from '@/components/AdminNav';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { href: '/admin/orders', title: 'Pedidos', description: 'Pedidos de clientes, pagos y envíos.' },
  { href: '/admin/b2b', title: 'B2B', description: 'Solicitudes, clientes y pedidos mayoristas.' },
  { href: '/admin/products', title: 'Productos', description: 'Catálogo, stock y precios.' },
  { href: '/admin/price-import', title: 'Precios', description: 'Importación e histórico de precios.' },
  { href: '/admin/parties', title: 'Parties', description: 'Aperturas compartidas y de batalla.' },
  { href: '/admin/lotteries', title: 'Sorteos', description: 'Sorteos y participaciones.' },
  { href: '/admin/media-library', title: 'Biblioteca Multimedia', description: 'Imágenes del catálogo.' },
  { href: '/admin/banners', title: 'Banners', description: 'Anuncios superiores de la tienda.' },
  { href: '/admin/hero-slides', title: 'Hero Home', description: 'Carrusel de la página de inicio.' },
] as const;

async function loadCounters() {
  try {
    const [ordersToShip, b2bPendingOrders, b2bPendingRequests, visibleProducts] = await Promise.all([
      db.order.count({ where: { status: 'PROCESSING', paymentStatus: 'PAID' } }),
      db.b2bOrder.count({ where: { status: 'PENDING' } }),
      db.b2bRequest.count({ where: { status: 'PENDING' } }),
      db.product.count({ where: { visible: true } }),
    ]);
    return [
      { label: 'Pedidos pagados pendientes de envío', value: ordersToShip, href: '/admin/orders' },
      { label: 'Pedidos B2B por confirmar', value: b2bPendingOrders, href: '/admin/b2b' },
      { label: 'Solicitudes B2B pendientes', value: b2bPendingRequests, href: '/admin/b2b' },
      { label: 'Productos visibles', value: visibleProducts, href: '/admin/products' },
    ];
  } catch {
    return null;
  }
}

export default async function AdminHome() {
  const store = await cookies();
  if (!verifyAdminSessionToken(store.get('tcg_admin_auth')?.value, process.env.ADMIN_PASSWORD)) {
    redirect('/admin/login');
  }

  const counters = await loadCounters();

  return (
    <div className="min-h-screen bg-dark-bg">
      <AdminNav />
      <main className="container-custom px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary">Panel de administración</h1>
        <p className="text-sm text-text-secondary mt-1">Resumen rápido y acceso a todas las secciones.</p>

        <section aria-labelledby="admin-counters" className="mt-6">
          <h2 id="admin-counters" className="sr-only">Resumen</h2>
          {counters ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {counters.map((c) => (
                <Link
                  key={c.label}
                  href={c.href}
                  className="rounded-2xl border border-dark-border bg-dark-surface p-5 hover:bg-dark-surfaceHover focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold"
                >
                  <div className="text-3xl font-bold text-premium-gold">{c.value}</div>
                  <div className="mt-1 text-sm text-text-secondary">{c.label}</div>
                </Link>
              ))}
            </div>
          ) : (
            <p role="status" className="text-sm text-text-muted">No se pudo cargar el resumen.</p>
          )}
        </section>

        <section aria-labelledby="admin-sections" className="mt-8">
          <h2 id="admin-sections" className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
            Secciones
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-2xl border border-dark-border bg-dark-surface p-5 hover:bg-dark-surfaceHover focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold"
              >
                <div className="font-semibold text-text-primary">{s.title}</div>
                <div className="mt-1 text-sm text-text-secondary">{s.description}</div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
