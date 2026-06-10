export function Hero() {
  return (
    <section 
      className="section py-24 md:py-32 relative"
      style={{
        backgroundImage: 'url(/images/pikachu-4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/60"></div>
      
      <div className="container-custom relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-h2 mb-6 gradient-gold">Tu tienda de Pokémon TCG en España</h1>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#catalog" className="btn btn-primary">
              Ver el catálogo
            </a>
            <a href="#contact" className="btn btn-secondary">
              Contacto
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}