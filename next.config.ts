import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 *
 * The widget endpoint and the ingestion API deliberately opt out of some of
 * these in their own route handlers, because they are designed to be consumed
 * cross-origin by third-party sites.
 */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    // No `preload`: that directive is a commitment to the browser preload list
    // and should only be sent from an apex you have actually submitted. Sent
    // from a subdomain it buys nothing, and it makes a certificate problem
    // unrecoverable in a browser that has already cached the policy.
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // `pg` and PGlite are Node-only and must never be traced into an edge or
  // client bundle. Keeping them external also avoids bundling native bindings.
  serverExternalPackages: ['pg', '@electric-sql/pglite'],

  experimental: {
    optimizePackageImports: ['lucide-react', 'motion', '@react-three/drei'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // The embeddable widget is a public, cacheable, cross-origin asset.
        source: '/widget.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
