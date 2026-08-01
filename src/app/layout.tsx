import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { siteConfig } from '@/config/site';
import { ThemeProvider, ThemeScript } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/misc';
import '@/styles/globals.css';

/**
 * Brand typefaces, per the handoff: Space Grotesk for display and UI, Space
 * Mono for uppercase labels and code. Both are self-hosted by next/font, so
 * there is no render-blocking request to Google and no layout shift.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-mono',
  weight: ['400', '700'],
});

/**
 * Root metadata.
 *
 * `metadataBase` makes every relative OG and canonical URL resolve against the
 * production origin, which is what stops preview deployments from advertising
 * themselves as canonical. Individual routes override `title` and `description`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.author.name, url: siteConfig.author.url }],
  creator: siteConfig.author.name,
  publisher: siteConfig.author.name,
  applicationName: siteConfig.name,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — ${siteConfig.tagline}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: '@rianfernando',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
  category: 'technology',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F1EA' },
    { media: '(prefers-color-scheme: dark)', color: '#17101F' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript defaultTheme="dark" />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider initial="dark">
          <TooltipProvider delayDuration={300} skipDelayDuration={200}>
            {/* Skip link: the first focusable element on every page. */}
            <a
              href="#main"
              className="sr-only rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-plum-900 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-100"
            >
              Skip to content
            </a>
            {children}
            {/*
              Vercel Web Analytics and Speed Insights. Both are cookieless and
              collect no personal data, so they need no consent banner. They
              load after hydration and never block a paint.
            */}
            <Analytics />
            <SpeedInsights />
            <Toaster
              position="bottom-right"
              toastOptions={{
                className:
                  'bg-surface-overlay border border-line text-fg text-sm shadow-overlay rounded-lg',
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
