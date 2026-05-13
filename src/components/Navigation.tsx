'use client';

export function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container-custom px-4 py-4 flex justify-between items-center">
        <a href="/" className="flex items-center gap-2">
          <img src="/images/logo.png" alt="TCG Iberia" className="h-10 w-auto" />
          <span className="text-lg md:text-2xl font-bold text-red-600">TCG Iberia</span>
        </a>
        <div className="flex gap-6">
          <a href="/" className="text-gray-700 hover:text-red-600 font-medium">Home</a>
          <a href="#catalog" className="text-gray-700 hover:text-red-600 font-medium">Catalog</a>
          <a href="#contact" className="text-gray-700 hover:text-red-600 font-medium">Contact</a>
        </div>
      </div>
    </nav>
  );
}