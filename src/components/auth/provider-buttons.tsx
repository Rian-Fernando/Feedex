import { GithubIcon } from '@/components/brand/github-icon';

/**
 * Sign-in buttons for the configured OAuth providers.
 *
 * Plain links, not client-side handlers: the flow is a full-page redirect to
 * the provider, so there is nothing for JavaScript to do and these work before
 * hydration.
 *
 * Renders nothing when no provider is configured, which is the default for a
 * self-hosted instance.
 */

/** Google's mark. Not in lucide, and the brand colours are required by their terms. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

const ICONS: Record<string, (props: { className?: string }) => React.ReactElement> = {
  google: GoogleIcon,
  github: GithubIcon,
};

export interface ProviderButtonsProps {
  providers: Array<{ id: string; label: string }>;
  /** Where to land after a successful sign-in. */
  next?: string;
  /** Wording differs between the sign-in and sign-up pages. */
  verb?: string;
}

export function ProviderButtons({ providers, next, verb = 'Continue with' }: ProviderButtonsProps) {
  if (providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {providers.map((provider) => {
          const Icon = ICONS[provider.id];
          const href = next
            ? `/api/auth/${provider.id}?next=${encodeURIComponent(next)}`
            : `/api/auth/${provider.id}`;

          return (
            <a
              key={provider.id}
              href={href}
              className="flex h-11 items-center justify-center gap-2.5 rounded-lg border border-line bg-surface-raised text-sm font-medium text-fg shadow-ambient transition-colors hover:border-line-strong hover:bg-surface-inset"
            >
              {Icon ? <Icon className="size-4.5" /> : null}
              {verb} {provider.label}
            </a>
          );
        })}
      </div>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line-subtle" />
        <span className="text-xs text-fg-subtle">or</span>
        <span className="h-px flex-1 bg-line-subtle" />
      </div>
    </div>
  );
}
