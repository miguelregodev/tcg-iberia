import Link from 'next/link';
import type { SeoLink, SeoSection } from '@/lib/seo/catalogPages';

interface SeoContentProps {
  sections: SeoSection[];
  related?: SeoLink[];
  relatedHeading?: string;
}

/** Server-rendered explanatory copy and contextual internal links shown under product grids. */
export function SeoContent({ sections, related = [], relatedHeading = 'Sigue explorando' }: SeoContentProps) {
  if (sections.length === 0 && related.length === 0) return null;

  return (
    <section className="bg-dark-bgSecondary border-t border-dark-border">
      <div className="container-custom px-4 py-10 md:py-14">
        <div className="max-w-3xl space-y-8">
          {sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">{section.heading}</h2>
              <div className="space-y-3 text-text-secondary leading-relaxed">
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}

          {related.length > 0 && (
            <nav aria-label={relatedHeading}>
              <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">{relatedHeading}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {related.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-premium-gold hover:underline underline-offset-4"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
