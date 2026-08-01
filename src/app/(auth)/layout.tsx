import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { siteConfig } from '@/config/site';

/**
 * Shell for sign-in and registration.
 *
 * Deliberately quiet: a single centred column, no navigation, nothing to click
 * except the form and the way back to the marketing site.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Decorative backdrop; masked so it never competes with the form. */}
      <div
        aria-hidden
        className="bg-grid mask-radial-fade pointer-events-none absolute inset-0 opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-12rem] left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent-600/12 blur-[120px]"
      />

      <header className="relative z-10 px-6 py-6">
        <Link href="/" className="inline-flex" aria-label={`${siteConfig.name} home`}>
          <Logo />
        </Link>
      </header>

      <main id="main" className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="relative z-10 px-6 py-6 text-center text-xs text-fg-subtle">
        <p>
          Built by{' '}
          <a
            href={siteConfig.author.url}
            className="underline underline-offset-4 transition-colors hover:text-fg-muted"
          >
            {siteConfig.author.name}
          </a>
        </p>
      </footer>
    </div>
  );
}
