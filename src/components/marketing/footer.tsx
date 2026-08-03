import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { GithubIcon } from '@/components/brand/github-icon';
import { siteConfig } from '@/config/site';

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#tour' },
      { label: 'Developers', href: '#developers' },
      { label: 'Open source', href: '#open-source' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'GitHub', href: siteConfig.links.github, external: true },
      {
        label: 'API reference',
        href: `${siteConfig.links.github}/blob/main/docs/API.md`,
        external: true,
      },
      {
        label: 'Widget guide',
        href: `${siteConfig.links.github}/blob/main/docs/WIDGET.md`,
        external: true,
      },
      {
        label: 'Self-hosting',
        href: `${siteConfig.links.github}/blob/main/docs/SELF_HOSTING.md`,
        external: true,
      },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Create a workspace', href: '/register' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-line-subtle px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-fg-muted">
              {siteConfig.shortDescription}
            </p>
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              <GithubIcon className="size-3.5" />
              Star on GitHub
            </a>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-labelledby={`footer-${column.heading}`}>
              <h2
                id={`footer-${column.heading}`}
                className="text-xs font-semibold tracking-wide text-fg uppercase"
              >
                {column.heading}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-fg-muted transition-colors hover:text-fg"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-fg-muted transition-colors hover:text-fg"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-subtle">
            © {new Date().getFullYear()} {siteConfig.name}. MIT licensed.
          </p>

          {/*
            Portfolio backlink. Kept in the footer of every page so the
            relationship between this product and its author is explicit for
            both readers and crawlers.
          */}
          <p className="text-xs text-fg-subtle">
            Built by{' '}
            <a
              href={siteConfig.author.url}
              className="font-medium text-fg-muted underline-offset-4 transition-colors hover:text-accent-500 hover:underline"
            >
              {siteConfig.author.name}
            </a>
            {' · '}
            <a
              href={siteConfig.author.projects}
              className="text-fg-muted underline-offset-4 transition-colors hover:text-accent-500 hover:underline"
            >
              More projects
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
