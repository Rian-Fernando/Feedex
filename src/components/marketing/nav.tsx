'use client';

import * as React from 'react';
import Link from 'next/link';
import { Dialog as RadixDialog } from 'radix-ui';
import { Menu, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#tour', label: 'How it works' },
  { href: '#developers', label: 'Developers' },
  { href: '/docs', label: 'Docs' },
  { href: '#faq', label: 'FAQ' },
] as const;

/**
 * Marketing header.
 *
 * Transparent over the hero and picks up a border and blur once the page
 * scrolls, so the hero reads as full-bleed without the nav ever losing
 * legibility over content.
 */
export function MarketingNav({ authenticated }: { authenticated: boolean }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled
          ? 'border-b border-line-subtle bg-surface/80 backdrop-blur-md'
          : 'border-b border-transparent',
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 md:gap-6"
      >
        <Link href="/" aria-label="Feedex home" className="shrink-0">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
          {authenticated ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}

          <RadixDialog.Root open={open} onOpenChange={setOpen}>
            <RadixDialog.Trigger
              className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg md:hidden"
              aria-label="Open menu"
            >
              <Menu aria-hidden className="size-4.5" />
            </RadixDialog.Trigger>

            <RadixDialog.Portal>
              <RadixDialog.Overlay className="fixed inset-0 z-50 bg-plum-950/60 backdrop-blur-sm data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in md:hidden" />
              <RadixDialog.Content
                className={cn(
                  'fixed inset-x-0 top-0 z-50 border-b border-line-subtle bg-surface-raised p-6 md:hidden',
                  'data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in',
                )}
              >
                <div className="flex items-center justify-between">
                  <RadixDialog.Title asChild>
                    <span>
                      <Logo />
                    </span>
                  </RadixDialog.Title>
                  <RadixDialog.Close
                    className="inline-flex size-9 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-inset"
                    aria-label="Close menu"
                  >
                    <X aria-hidden className="size-4.5" />
                  </RadixDialog.Close>
                </div>
                <RadixDialog.Description className="sr-only">
                  Site navigation
                </RadixDialog.Description>

                <ul className="mt-6 flex flex-col gap-1">
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>

                {!authenticated ? (
                  <Button asChild variant="secondary" className="mt-4 w-full">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                ) : null}
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>
        </div>
      </nav>
    </header>
  );
}
