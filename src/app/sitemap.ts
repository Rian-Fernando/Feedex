import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';
import { docSlugs } from '@/lib/docs';

/**
 * Sitemap.
 *
 * Only genuinely indexable URLs appear here. The dashboard and auth routes are
 * excluded — listing a page that robots.txt disallows is a contradictory signal
 * and is reported as an error in Search Console.
 *
 * The marketing page is a single document with in-page anchors rather than
 * separate routes, so its own entry is one URL. The documentation is real
 * routes, and each is listed — they are the pages that answer a search, and the
 * ones an answer engine has any reason to cite.
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
      url: `${siteConfig.url}/docs`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...docSlugs().map((slug) => ({
      url: `${siteConfig.url}/docs/${slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    {
      url: `${siteConfig.url}/llms.txt`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
