import { siteConfig } from '@/config/site';
import { FAQ_ITEMS } from '@/components/marketing/sections';

/**
 * JSON-LD structured data.
 *
 * Serialised server-side into a single `application/ld+json` block. The FAQ
 * entries are imported from the same constant the page renders, so the markup
 * and the visible answers cannot drift — which is exactly the mismatch that
 * gets rich results disqualified.
 */

function jsonLd(data: object): string {
  // `<` is escaped so a stray sequence in the data cannot terminate the script
  // element early.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function HomeStructuredData() {
  const person = {
    '@type': 'Person',
    name: siteConfig.author.name,
    url: siteConfig.author.url,
  };

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${siteConfig.url}/#application`,
        name: siteConfig.name,
        alternateName: 'Feedex Feedback Platform',
        url: siteConfig.url,
        description: siteConfig.description,
        applicationCategory: 'DeveloperApplication',
        applicationSubCategory: 'Feedback Management',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
        softwareVersion: '0.1.0',
        license: 'https://opensource.org/licenses/MIT',
        author: person,
        creator: person,
        publisher: person,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          description:
            'Free to use. Self-hosting is free under the MIT licence. There is no paid tier.',
        },
        featureList: [
          'Embeddable feedback widget',
          'Multi-project dashboard',
          'Automatic browser and page context capture',
          'Bug, feature request, and UI issue categorisation',
          'Status and priority triage workflow',
          'REST API with per-project keys',
          'Multi-tenant workspaces',
          'Self-hostable',
        ],
        screenshot: `${siteConfig.url}${siteConfig.ogImage}`,
        codeRepository: siteConfig.links.github,
        isAccessibleForFree: true,
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${siteConfig.url}/#source`,
        name: siteConfig.name,
        codeRepository: siteConfig.links.github,
        programmingLanguage: ['TypeScript', 'SQL'],
        runtimePlatform: 'Node.js',
        license: 'https://opensource.org/licenses/MIT',
        author: person,
      },
      {
        '@type': 'WebSite',
        '@id': `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
        publisher: person,
        inLanguage: 'en-US',
      },
      {
        '@type': 'FAQPage',
        '@id': `${siteConfig.url}/#faq`,
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${siteConfig.url}/#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteConfig.url,
          },
        ],
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />;
}
