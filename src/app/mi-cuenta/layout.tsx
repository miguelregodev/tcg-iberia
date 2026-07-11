import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getB2bSessionFromCookies } from '@/lib/b2b/session';
import { MiCuentaNav } from './MiCuentaNav';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export default async function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Check if user is logged in (either customer or B2B)
  let isAuthenticated = !!session?.user;
  let userName = '';

  if (isAuthenticated && session?.user) {
    userName = session.user.name ?? session.user.email ?? '';
  } else {
    // Not a customer — check for an active B2B session
    const b2bSession = await getB2bSessionFromCookies();
    if (b2bSession) {
      isAuthenticated = true;
      userName = b2bSession.customer.contactName ?? b2bSession.customer.email ?? '';
    }
  }

  if (!isAuthenticated) {
    redirect('/?login=1');
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50">
        <div className="section">
          <div className="container-custom">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar */}
              <aside className="lg:w-64 flex-shrink-0">
                <MiCuentaNav userName={userName} />
              </aside>

              {/* Main content */}
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
