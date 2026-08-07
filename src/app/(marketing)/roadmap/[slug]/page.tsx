import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPublicRoadmap } from '@/server/services/roadmap';
import { absoluteUrl, siteConfig } from '@/config/site';
import { Badge } from '@/components/ui/badge';
import { asTone } from '@/lib/taxonomy';
import { formatDate } from '@/lib/format';

/**
 * A project's public roadmap.
 *
 * Rendered from curated items only — see the service for the three gates that
 * have to agree before anything appears. This exists so that a reporter can
 * watch their request move without anyone writing them an update, which is the
 * single most common reason feedback tools get abandoned.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const roadmap = await getPublicRoadmap((await params).slug);
  if (!roadmap) return { title: 'Roadmap' };

  const title = `${roadmap.projectName} roadmap`;
  const description =
    roadmap.projectDescription ??
    `What is planned, in progress, and shipped on ${roadmap.projectName}.`;

  return {
    title,
    description,
    alternates: { canonical: `/roadmap/${(await params).slug}` },
    openGraph: { title, description, url: absoluteUrl(`/roadmap/${(await params).slug}`) },
  };
}

export default async function RoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const roadmap = await getPublicRoadmap(slug);
  if (!roadmap) notFound();

  const total = roadmap.columns.reduce((sum, column) => sum + column.items.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-24 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${roadmap.projectName} roadmap`,
            description: roadmap.projectDescription ?? undefined,
            url: absoluteUrl(`/roadmap/${slug}`),
          }),
        }}
      />

      <header className="mb-10">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: roadmap.accentColor }}
          />
          <p className="label-mono text-fg-subtle">Roadmap</p>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          {roadmap.projectName}
        </h1>
        {roadmap.projectDescription ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-muted">
            {roadmap.projectDescription}
          </p>
        ) : null}
      </header>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-line-subtle px-6 py-16 text-center text-fg-muted">
          <p className="text-sm">Nothing has been published here yet.</p>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.max(roadmap.columns.length, 1)}, minmax(15rem, 1fr))`,
          }}
        >
          {roadmap.columns.map((column) => (
            <section key={column.key} aria-label={column.label} className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Badge tone={asTone(column.tone)} dot>
                  {column.label}
                </Badge>
                <span className="text-2xs text-fg-subtle tabular-nums">{column.items.length}</span>
              </div>

              <ul className="flex flex-col gap-2">
                {column.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-line-subtle bg-surface-raised/40 p-3"
                  >
                    <p className="text-sm leading-snug font-medium text-fg">{item.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge tone={asTone(item.categoryTone)} size="sm">
                        {item.category}
                      </Badge>
                      <span className="text-2xs text-fg-subtle">{formatDate(item.createdAt)}</span>
                    </div>
                  </li>
                ))}

                {column.items.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-line-subtle px-3 py-6 text-center text-xs text-fg-subtle">
                    Nothing here
                  </li>
                ) : null}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 text-center text-xs text-fg-subtle">
        Powered by{' '}
        <a href={siteConfig.url} className="font-medium transition-colors hover:text-fg-muted">
          Feedex
        </a>
      </p>
    </div>
  );
}
