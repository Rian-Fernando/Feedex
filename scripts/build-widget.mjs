import { build, context } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Bundles the embeddable widget to `public/widget.js`.
 *
 * Built separately from the Next.js application because it is a standalone
 * artefact with different constraints: it runs on third-party pages, must have
 * no runtime dependencies, and targets browsers older than the app's baseline.
 * Keeping it out of the app's bundle graph also guarantees that nothing from
 * the dashboard can accidentally be pulled into it.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const banner = `/*! Feedex widget v${pkg.version} | MIT | https://feedex.rianfernando.com */`;

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [path.join(root, 'widget/src/index.ts')],
  outfile: path.join(root, 'public/widget.js'),
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  format: 'iife',
  // The widget attaches itself to `window`; an IIFE with no global name keeps
  // it from leaving anything else behind.
  //
  // Targets are expressed as browser versions rather than an ECMAScript year:
  // the year would be the binding constraint and would force esbuild to
  // downlevel syntax these browsers already support, for no benefit.
  //
  // Safari 15 is the floor because esbuild declines to emit destructuring for
  // Safari 14, which shipped a codegen bug around it.
  target: ['chrome80', 'firefox78', 'safari15', 'edge88'],
  platform: 'browser',
  legalComments: 'none',
  banner: { js: banner },
  define: {
    'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
  },
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[widget] watching for changes...');
} else {
  const result = await build({ ...options, metafile: true });
  const output = result.metafile.outputs['public/widget.js'];

  if (output) {
    console.log(`[widget] built public/widget.js (${(output.bytes / 1024).toFixed(1)} kB)`);
  }
}
