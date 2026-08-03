import Link from 'next/link';

import { docSummaries } from '@/lib/docs';
import { siteConfig } from '@/config/site';
import { DocsNavLink } from '@/components/marketing/docs-nav-link';

/**
 * Shell shared by the docs index and every guide.
 *
 * The sidebar is rendered on the server and the same on every page, so the
 * whole set of guides is one click away and — more to the point for a product
 * that cares about being found — every page links to every other, which is
 * what makes them worth crawling.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = docSummaries();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-24 pb-16 lg:pt-28">
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="mb-10 lg:mb-0">
          {/*
            Sticky on desktop so the guide list stays reachable through a long
            API reference; static on mobile, where a sticky sidebar would eat
            the viewport.
          */}
          <nav aria-label="Documentation" className="lg:sticky lg:top-24">
            <Link
              href="/docs"
              className="label-mono text-fg-subtle transition-colors hover:text-fg"
            >
              Documentation
            </Link>

            <ul className="mt-4 flex flex-col gap-0.5 border-l border-line-subtle">
              {docs.map((doc) => (
                <li key={doc.slug}>
                  <DocsNavLink href={`/docs/${doc.slug}`}>{doc.title}</DocsNavLink>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-line-subtle pt-5">
              <a
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-fg-muted transition-colors hover:text-accent-500"
              >
                Source on GitHub
              </a>
            </div>
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
