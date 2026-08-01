'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { CopyButton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';

/**
 * Installation instructions.
 *
 * Three variants because the three ways a developer will reach for this are
 * genuinely different shapes: a script tag for a plain site, a component for
 * React/Next, and a raw HTTP call for anything else (mobile, server-side,
 * a CLI).
 */
export interface InstallSnippetProps {
  publicKey: string;
  host: string;
  projectName: string;
}

function snippets({ publicKey, host, projectName }: InstallSnippetProps) {
  const script = `<script
  src="${host}/widget.js"
  data-feedex-key="${publicKey}"
  defer
></script>`;

  const react = `// app/layout.tsx — loads the widget once, after hydration.
import Script from 'next/script';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="${host}/widget.js"
          data-feedex-key="${publicKey}"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}`;

  const api = `curl -X POST ${host}/api/v1/feedback \\
  -H "Content-Type: application/json" \\
  -d '{
    "publicKey": "${publicKey}",
    "category": "bug",
    "description": "The export button does nothing on ${projectName}.",
    "email": "user@example.com",
    "context": { "url": "https://example.com/reports" }
  }'`;

  return { script, react, api };
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative">
      <pre
        className={cn(
          'scrollbar-thin overflow-x-auto rounded-lg border border-line-subtle bg-surface-sunken',
          'p-4 pr-12 text-[0.8125rem] leading-relaxed',
        )}
      >
        <code className="font-mono text-fg-muted">{code}</code>
      </pre>
      <CopyButton
        value={code}
        label={`Copy ${language} snippet`}
        className="absolute top-2.5 right-2.5 border border-line-subtle bg-surface-raised"
      />
    </div>
  );
}

export function InstallSnippet(props: InstallSnippetProps) {
  const { script, react, api } = React.useMemo(() => snippets(props), [props]);

  return (
    <Tabs defaultValue="html">
      <TabsList>
        <TabsTrigger value="html">HTML</TabsTrigger>
        <TabsTrigger value="react">Next.js</TabsTrigger>
        <TabsTrigger value="api">HTTP</TabsTrigger>
      </TabsList>

      <TabsContent value="html" className="pt-4">
        <p className="mb-3 text-sm text-fg-muted">
          Paste this before the closing <code className="font-mono text-xs">&lt;/body&gt;</code>{' '}
          tag. The widget appears in the corner and needs no further setup.
        </p>
        <CodeBlock code={script} language="HTML" />
      </TabsContent>

      <TabsContent value="react" className="pt-4">
        <p className="mb-3 text-sm text-fg-muted">
          Uses <code className="font-mono text-xs">next/script</code> so the widget never blocks
          hydration.
        </p>
        <CodeBlock code={react} language="Next.js" />
      </TabsContent>

      <TabsContent value="api" className="pt-4">
        <p className="mb-3 text-sm text-fg-muted">
          Submit feedback directly from any client — mobile apps, CLIs, or your own UI.
        </p>
        <CodeBlock code={api} language="HTTP" />
      </TabsContent>
    </Tabs>
  );
}
