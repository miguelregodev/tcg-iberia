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
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-h1 mb-6 gradient-gold">Premium TCG Store</h1>
          <p className="text-text-secondary text-lg md:text-xl mb-12 leading-relaxed">
            Authenticated Pokémon cards for serious collectors. EU fast shipping, secure transactions, and premium grade authentication.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#catalog" className="btn btn-primary">
              View Catalog
            </a>
            <a href="#contact" className="btn btn-secondary">
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}