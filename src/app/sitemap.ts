import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

/**
 * Sitemap.
 *
 * Only genuinely indexable URLs appear here. The dashboard and auth routes are
 * excluded — listing a page that robots.txt disallows is a contradictory signal
 * and is reported as an error in Search Console.
 *
 * The marketing page is a single document with in-page anchors rather than
 * separate routes, so the sitemap is deliberately short. Adding a `/docs` route
 * later means adding an entry here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteConfig.url,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteConfig.url}/llms.txt`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
