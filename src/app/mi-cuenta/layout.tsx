import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MiCuentaNav } from './MiCuentaNav';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export default async function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
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
                <MiCuentaNav userName={session.user.name ?? session.user.email ?? ''} />
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
