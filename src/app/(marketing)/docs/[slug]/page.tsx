import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { docSlugs, docSummaries, getDoc } from '@/lib/docs';
import { GithubIcon } from '@/components/brand/github-icon';
import { absoluteUrl, siteConfig } from '@/config/site';

/**
 * One guide.
 *
 * Statically generated: the Markdown is read and rendered at build time, so no
 * file is touched while serving a request and the parser never ships to a
 * browser. It also means these pages are plain HTML on a CDN, which is what
 * you want for the documentation a search engine or an answer engine reads.
 */
export const dynamic = 'force-static';

export function generateStaticParams() {
  return docSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const doc = getDoc((await params).slug, siteConfig.links.github);
  if (!doc) return {};

  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/docs/${doc.slug}` },
    openGraph: {
      title: `${doc.title} — ${siteConfig.name}`,
      description: doc.description,
      url: absoluteUrl(`/docs/${doc.slug}`),
      type: 'article',
    },
  };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug, siteConfig.links.github);
  if (!doc) notFound();

  const all = docSummaries();
  const previous = all[doc.order - 1];
  const next = all[doc.order + 1];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: doc.title,
            description: doc.description,
            url: absoluteUrl(`/docs/${doc.slug}`),
            isPartOf: {
              '@type': 'WebSite',
              name: siteConfig.name,
              url: siteConfig.url,
            },
            author: { '@type': 'Person', name: siteConfig.author.name, url: siteConfig.author.url },
          }),
        }}
      />

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_12rem] xl:gap-10">
        <article className="min-w-0">
          <header className="mb-8 border-b border-line-subtle pb-6">
            <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              {doc.title}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-fg-muted">{doc.description}</p>
          </header>

          {/*
            The Markdown is authored in this repository, not submitted by a
            user, so there is no untrusted input in this string. It is rendered
            at build time from a file under version control.
          */}
          <div className="doc-prose" dangerouslySetInnerHTML={{ __html: doc.html }} />

          <nav
            aria-label="Pagination"
            className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line-subtle pt-6"
          >
            {previous ? (
              <Link
                href={`/docs/${previous.slug}`}
                className="group flex items-center gap-2 text-sm text-fg-muted transition-colors hover:text-accent-500"
              >
                <ArrowLeft
                  aria-hidden
                  className="size-3.5 transition-transform group-hover:-translate-x-0.5"
                />
                {previous.title}
              </Link>
            ) : (
              <span />
            )}

            {next ? (
              <Link
                href={`/docs/${next.slug}`}
                className="group flex items-center gap-2 text-sm text-fg-muted transition-colors hover:text-accent-500"
              >
                {next.title}
                <ArrowRight
                  aria-hidden
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>

        {/*
          On-page contents, desktop only. Below xl there is no column to put it
          in that would not push the prose into a narrow gutter.
        */}
        {doc.headings.length > 1 ? (
          <aside className="hidden xl:block">
            <nav aria-label="On this page" className="sticky top-24">
              <p className="label-mono text-fg-subtle">On this page</p>
              <ul className="mt-3 flex flex-col gap-2">
                {doc.headings.map((heading) => (
                  <li key={heading.id}>
                    <a
                      href={`#${heading.id}`}
                      className="block text-sm leading-snug text-fg-muted transition-colors hover:text-accent-500"
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>

              <a
                href={`${siteConfig.links.github}/blob/main/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex items-center gap-1.5 text-xs text-fg-subtle transition-colors hover:text-fg"
              >
                <GithubIcon className="size-3" />
                Edit on GitHub
              </a>
            </nav>
          </aside>
        ) : null}
      </div>
    </>
  );
}
