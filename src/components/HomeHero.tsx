import { Hero } from '@/components/Hero';
import { HeroSlideshow } from '@/components/HeroSlideshow';
import { getActiveHeroSlides } from '@/lib/hero-slides/service';

/**
 * Homepage top section. Renders the admin-managed slider when active slides exist,
 * otherwise the existing static hero so the layout is unchanged.
 */
export async function HomeHero() {
  const slides = await getActiveHeroSlides();
  if (slides.length === 0) {
    return <Hero />;
  }
  return <HeroSlideshow slides={slides} />;
}
