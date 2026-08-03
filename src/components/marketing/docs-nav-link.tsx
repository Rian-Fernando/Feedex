'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

/**
 * Sidebar link that marks the page you are on.
 *
 * A client component only because the active state depends on the current
 * route; the rest of the docs shell stays on the server.
 */
export function DocsNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-ml-px block border-l py-1.5 pl-4 text-sm transition-colors',
        active
          ? 'border-accent-500 font-medium text-accent-500'
          : 'border-transparent text-fg-muted hover:text-fg',
      )}
    >
      {children}
    </Link>
  );
}
