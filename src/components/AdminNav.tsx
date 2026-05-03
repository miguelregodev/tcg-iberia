'use client';

import { useRouter } from 'next/navigation';

export function AdminNav() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container-custom px-4 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold text-red-600">Admin Panel</div>
        <button
          onClick={handleLogout}
          className="btn btn-secondary text-sm"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}