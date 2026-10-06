import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { SeoContent } from '@/components/SeoContent';
import { GUIDES, getGuide } from '@/lib/seo/guides';
import { articleJsonLd } from '@/lib/seo/jsonld';
import { buildPageMetadata, noIndexMetadata } from '@/lib/seo/metadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return noIndexMetadata('Guía no encontrada');

  return buildPageMetadata({
    title: guide.metaTitle,
    description: guide.description,
    path: `/guias/${guide.slug}`,
    ogType: 'article',
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const path = `/guias/${guide.slug}`;

  return (
    <>
      <JsonLd
        data={articleJsonLd({
          title: guide.title,
          description: guide.description,
          path,
          datePublished: guide.datePublished,
          dateModified: guide.dateModified,
        })}
      />
      <Navigation />
      <Breadcrumbs
        items={[{ label: 'Inicio', href: '/' }, { label: 'Guías', href: '/guias' }, { label: guide.title }]}
      />
      <article className="bg-dark-bg">
        <div className="container-custom px-4 py-12 md:py-16">
          <div className="max-w-3xl">
            <h1 className="text-h2 mb-4 text-text-primary">{guide.title}</h1>
            <p className="text-text-secondary leading-relaxed mb-10">{guide.intro}</p>

            <div className="space-y-8">
              {guide.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">{section.heading}</h2>
                  <div className="space-y-3 text-text-secondary leading-relaxed">
                    {section.paragraphs.map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </article>
      <SeoContent sections={[]} related={guide.related} />
      <Footer />
    </>
  );
}
