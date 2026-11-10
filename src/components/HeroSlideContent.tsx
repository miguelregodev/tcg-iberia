import Link from 'next/link';
import { isExternalDestination } from '@/lib/hero-slides/destination';

export const HERO_DEFAULT_BUTTON_LABEL = 'Explorar colección';

interface HeroSlideContentProps {
  headline: string | null;
  buttonLabel: string | null;
  subtitle: string | null;
  destinationUrl: string;
  /** False removes the button from the tab order (used for inactive carousel slides). */
  tabbable: boolean;
}

/** Overlay shared by the homepage slideshow and the admin preview; mirrors the static Hero layout. */
export function HeroSlideContent({ headline, buttonLabel, subtitle, destinationUrl, tabbable }: HeroSlideContentProps) {
  const buttonClass = 'btn btn-primary mt-3 px-4 py-2 text-sm sm:mt-6 sm:px-6 sm:py-3 sm:text-base';
  const tabIndex = tabbable ? 0 : -1;
  const label = buttonLabel || HERO_DEFAULT_BUTTON_LABEL;

  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/30 to-transparent" />
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4 pb-10 md:pb-20">
        {headline && (
          <h1 className="font-bold text-xl min-[360px]:text-2xl sm:text-3xl md:text-6xl tracking-tight leading-tight text-text-primary max-w-3xl [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
            {headline}
          </h1>
        )}
        {subtitle && (
          <p className="mt-1 sm:mt-3 text-white text-xs sm:text-sm md:text-lg max-w-xl [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">{subtitle}</p>
        )}
        {isExternalDestination(destinationUrl) ? (
          <a
            href={destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={tabIndex}
            className={buttonClass}
          >
            {label}
          </a>
        ) : (
          <Link href={destinationUrl} tabIndex={tabIndex} className={buttonClass}>
            {label}
          </Link>
        )}
      </div>
    </>
  );
}
