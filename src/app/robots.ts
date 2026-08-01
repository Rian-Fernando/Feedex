import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

/**
 * robots.txt
 *
 * Feedex is documentation-shaped public content plus a private application.
 * The marketing surface is open to everything, including AI crawlers, because
 * being quotable by an assistant is the point. Only the authenticated app and
 * the API are closed.
 *
 * AI user agents are enumerated explicitly rather than relying on the wildcard:
 * several of them (Google-Extended, Applebot-Extended) are opt-out signals that
 * are only meaningful when named, and being explicit documents the intent.
 */

/** Crawlers whose access is a deliberate choice, not an accident of `*`. */
const AI_USER_AGENTS = [
  // OpenAI
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  // Anthropic
  'ClaudeBot',
  'Claude-Web',
  'Claude-SearchBot',
  'Claude-User',
  'anthropic-ai',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // Google and Apple AI training signals
  'Google-Extended',
  'Applebot-Extended',
  // Others
  'CCBot',
  'Amazonbot',
  'Bytespider',
  'cohere-ai',
  'Meta-ExternalAgent',
  'DuckAssistBot',
  'YouBot',
];

/**
 * Paths that must never be indexed: the authenticated application, the API,
 * and the auth routes. Everything else is fair game.
 */
const DISALLOWED = ['/api/', '/dashboard', '/dashboard/', '/login', '/register', '/onboarding'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED,
      },
      ...AI_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOWED,
      })),
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
