import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';
import { docSlugs } from '@/lib/docs';
import { listPublicRoadmapSlugs } from '@/server/services/roadmap';

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
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  /*
    Published roadmaps are real pages people link to, so they belong here. A
    database read in the sitemap is unusual, but this is the only route set
    that is not known at build time — and it fails soft: an unreachable
    database yields a sitemap without them rather than no sitemap at all.
  */
  const roadmaps = await listPublicRoadmapSlugs().catch(() => []);

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
    ...roadmaps.map((slug) => ({
      url: `${siteConfig.url}/roadmap/${slug}`,
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    {
      url: `${siteConfig.url}/llms.txt`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
