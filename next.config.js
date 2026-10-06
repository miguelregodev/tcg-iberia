/** @type {import('next').NextConfig} */
// NOTE: Next.js loads this file in preference to next.config.ts, so SEO-critical
// settings must live here.

const NOINDEX_PATHS = [
  '/admin/:path*',
  '/mi-cuenta/:path*',
  '/checkout/:path*',
  '/api/:path*',
  '/b2b/:path*',
  '/b2b-catalog',
  '/return',
  '/registro',
];

const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      // Single canonical host: www -> apex.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.tcgiberia.com' }],
        destination: 'https://tcgiberia.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      ...NOINDEX_PATHS.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }],
      },
    ];
  },
};

module.exports = nextConfig;
