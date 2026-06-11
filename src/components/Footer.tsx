export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-12 md:py-16">
      <div className="container-custom px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold mb-4 text-red-600">TCG Iberia</h3>
            <p className="text-gray-600">Cartas de Pokémon TCG de alta calidad para coleccionistas</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Enlaces Rápidos</h4>
            <ul className="space-y-2 text-gray-600">
              <li><a href="/" className="hover:text-red-600">Inicio</a></li>
              <li><a href="#catalog" className="hover:text-red-600">Catálogo</a></li>
              <li><a href="#contact" className="hover:text-red-600">Contacto</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contacto</h4>
            <ul className="space-y-2 text-gray-600">
              <li><a href="mailto:sales@tcgiberia.com" className="hover:text-red-600">Email</a></li>
              <li><a href="https://wa.me/34689178762" className="hover:text-red-600">WhatsApp</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-8 text-center text-gray-500">
          <p>&copy; 2026 TCG Iberia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}