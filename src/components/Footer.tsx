export function Footer() {
  return (
    <footer className="bg-dark-bgSecondary border-t border-dark-border py-12 md:py-16">
      <div className="container-custom px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold mb-4 text-premium-gold">TCG Iberia</h3>
            <p className="text-text-secondary text-sm">Productos de Pokémon TCG de alta calidad para coleccionistas y amantes del hobby</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4 text-text-primary">Contacto</h4>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li><a href="mailto:sales@tcgiberia.com" className="hover:text-premium-gold transition-colors">Email</a></li>
              <li><a href="https://wa.me/34689178762" className="hover:text-premium-gold transition-colors">WhatsApp</a></li>
              <li><a href="/contacto" className="hover:text-premium-gold transition-colors">Información de Contacto</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-text-primary">Legal</h4>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li><a href="/politica-privacidad" className="hover:text-premium-gold transition-colors">Política de Privacidad</a></li>
              <li><a href="/terminos-servicio" className="hover:text-premium-gold transition-colors">Términos del Servicio</a></li>
              <li><a href="/aviso-legal" className="hover:text-premium-gold transition-colors">Aviso Legal</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-text-primary">Políticas</h4>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li><a href="/politica-reembolso" className="hover:text-premium-gold transition-colors">Política de Reembolso</a></li>
              <li><a href="/politica-envio" className="hover:text-premium-gold transition-colors">Política de Envío</a></li>
              <li><a href="/politica-cancelacion" className="hover:text-premium-gold transition-colors">Política de Cancelación</a></li>
              <li><a href="/preferencias-cookies" className="hover:text-premium-gold transition-colors">Preferencias de Cookies</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-dark-border pt-8 text-center text-text-muted text-sm">
          <p>&copy; 2026 TCG Iberia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}