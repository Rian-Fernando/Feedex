import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';

import { docSummaries } from '@/lib/docs';
import { absoluteUrl, siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Install the Feedex widget, configure it from the dashboard, call the API, or run your own instance.',
  alternates: { canonical: '/docs' },
  openGraph: {
    title: `Documentation — ${siteConfig.name}`,
    description:
      'Install the Feedex widget, configure it from the dashboard, call the API, or run your own instance.',
    url: absoluteUrl('/docs'),
  },
};

export default function DocsIndexPage() {
  const docs = docSummaries();

  return (
    <>
      {/*
        A crawler that reads this page should come away knowing the set of
        guides and what each one answers, without following four links.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `${siteConfig.name} documentation`,
            itemListElement: docs.map((doc, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: doc.title,
              description: doc.description,
              url: absoluteUrl(`/docs/${doc.slug}`),
            })),
          }),
        }}
      />

      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Documentation</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-muted">
          Feedex is one script tag. These pages cover getting it onto a site, changing how it looks
          without touching that tag again, reading your feedback back out over HTTP, and running the
          whole thing yourself.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {docs.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/docs/${doc.slug}`}
              className="group flex h-full flex-col rounded-xl border border-line-subtle bg-surface-raised/40 p-5 transition-colors hover:border-accent-500/50 hover:bg-surface-raised"
            >
              <span className="flex items-center gap-1.5 text-[0.9375rem] font-semibold text-fg">
                {doc.title}
                <ArrowRight
                  aria-hidden
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <span className="mt-2 text-sm leading-relaxed text-fg-muted">{doc.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-xl border border-dashed border-line-subtle p-5">
        <h2 className="text-sm font-semibold text-fg">In a hurry?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          Create a project, then paste one tag before{' '}
          <code className="font-mono text-xs">&lt;/body&gt;</code>. That is the whole installation —
          the widget carries its own styles, needs no build step, and is configured from your
          dashboard afterwards.
        </p>
        <pre className="mt-3 scrollbar-thin overflow-x-auto rounded-lg border border-line-subtle bg-surface-sunken p-4 text-[0.8125rem] leading-relaxed">
          <code className="font-mono text-fg-muted">{`<script
  src="${siteConfig.url}/widget.js"
  data-feedex-key="pk_fdx_your_project_key"
  defer
></script>`}</code>
        </pre>
      </div>
    </>
  );
}
