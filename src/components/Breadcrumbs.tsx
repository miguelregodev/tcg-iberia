import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current page — rendered as plain, non-clickable text. */
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Site-wide breadcrumb trail. Renders directly below `<Navigation />` (and
 * any banners it includes) and above page content — see call sites in
 * `ProductListPage` and `product/[slug]/page.tsx`.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={`bg-dark-bg border-b border-dark-border ${className ?? ''}`}>
      <div className="container-custom px-4 py-2.5 overflow-x-auto">
        <ol className="flex flex-nowrap items-center gap-x-1.5 whitespace-nowrap text-xs sm:text-sm">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isCurrent = isLast || !item.href;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-1.5 min-w-0">
                {index > 0 && (
                  <span aria-hidden="true" className="text-text-muted">
                    /
                  </span>
                )}
                {isCurrent ? (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className="text-text-muted truncate max-w-[45vw] sm:max-w-xs"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href!}
                    className="text-text-secondary hover:text-premium-gold transition-colors truncate max-w-[45vw] sm:max-w-xs"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </nav>
  );
}
