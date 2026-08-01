/**
 * Single source of truth for product metadata.
 *
 * Everything user-facing that names the product, its author, or its canonical
 * URLs reads from here so that renaming or re-hosting is a one-file change.
 */
export const siteConfig = {
  name: 'Feedex',
  title: 'Feedex — Collect feedback from every project in one place',
  tagline: 'Collect feedback from every project in one place.',
  description:
    'Feedex is a lightweight developer feedback platform. Drop one script into any web app and collect bugs, feature requests, and UI issues from every project into a single dashboard.',
  shortDescription:
    'A lightweight developer feedback platform. One widget, every project, one dashboard.',
  url: 'https://feedex.rianfernando.com',
  ogImage: '/og.png',
  locale: 'en_US',

  author: {
    name: 'Rian Fernando',
    url: 'https://rianfernando.com',
    projects: 'https://rianfernando.com/projects',
  },

  links: {
    github: 'https://github.com/Rian-Fernando/Feedex',
    portfolio: 'https://rianfernando.com',
    docs: '/docs',
  },

  keywords: [
    'feedback widget',
    'developer feedback platform',
    'bug reporting tool',
    'feature request tracking',
    'user feedback dashboard',
    'embeddable feedback widget',
    'multi-project feedback',
    'issue tracking for developers',
  ],
} as const;

export type SiteConfig = typeof siteConfig;

/** Absolute URL helper that respects the configured canonical origin. */
export function absoluteUrl(path = '/'): string {
  const base = process.env.APP_URL ?? siteConfig.url;
  return new URL(path, base).toString();
}
