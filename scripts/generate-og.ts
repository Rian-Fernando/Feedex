import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Generates the static brand assets that have to be real image files: the Open
 * Graph card, the apple-touch icon, and the favicon.
 *
 * Rasterised at build time from SVG rather than generated per request with
 * `ImageResponse`, because an Open Graph card is fetched by crawlers that do not
 * always follow redirects or wait for a render — a plain PNG at a stable URL is
 * the most reliable thing to hand them.
 *
 * The mark's path data is transcribed from the brand handoff and matches
 * `src/components/brand/logo.tsx` exactly. If the mark ever changes, both must
 * change together.
 *
 * Run with: npm run og:generate
 */

const WIDTH = 1200;
const HEIGHT = 630;

/* Brand palette, from the handoff. */
const GOLD = '#F7B83D';
const VIOLET = '#B58BF9';
const PLUM = '#17101F';
const PLUM_ELEVATED = '#1E1529';
const TEXT_ON_DARK = '#F6F2F8';
const TEXT_MUTED_DARK = '#8B7F99';

/**
 * The Feedex mark, at an arbitrary position and height.
 *
 * `maskId` is a parameter because a single document may contain several marks,
 * and duplicate mask ids silently break all but the first.
 */
function mark(x: number, y: number, height: number, maskId: string): string {
  const scale = height / 132;

  return `
    <defs>
      <mask id="${maskId}">
        <rect x="0" y="0" width="200" height="132" fill="#fff"/>
        <g fill="none" stroke="#000" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
          <path d="M46 40 H152"/>
          <path d="M130 27 L152 40 L130 53"/>
          <path d="M154 70 H48"/>
          <path d="M70 57 L48 70 L70 83"/>
        </g>
      </mask>
    </defs>
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <g mask="url(#${maskId})">
        <path d="M100 12 H53 A43 43 0 0 0 53 98 H100 Z" fill="${GOLD}"/>
        <polygon points="62,90 36,120 84,99" fill="${GOLD}"/>
        <path d="M100 12 H147 A43 43 0 0 1 147 98 H100 Z" fill="${VIOLET}"/>
        <polygon points="138,90 164,120 116,99" fill="${VIOLET}"/>
      </g>
    </g>`;
}

/**
 * Decorative feedback network on the right of the card.
 *
 * Alternates gold and violet nodes converging on a violet core, mirroring the
 * hero scene so the card and the site read as one system.
 */
function network(cx: number, cy: number): string {
  const nodes = [
    { x: -158, y: -104 },
    { x: 14, y: -150 },
    { x: 172, y: -66 },
    { x: 158, y: 92 },
    { x: -14, y: 150 },
    { x: -170, y: 76 },
  ];

  const edges = nodes
    .map(
      (node) =>
        `<line x1="${cx + node.x}" y1="${cy + node.y}" x2="${cx}" y2="${cy}"
               stroke="${TEXT_MUTED_DARK}" stroke-opacity="0.32" stroke-width="1.5"/>`,
    )
    .join('');

  const points = nodes
    .map((node, index) => {
      const fill = index % 2 === 0 ? GOLD : VIOLET;
      return `<circle cx="${cx + node.x}" cy="${cy + node.y}" r="7.5" fill="${fill}"/>`;
    })
    .join('');

  // Pulses caught mid-flight, to imply motion in a still image.
  const pulses = nodes
    .map((node, index) => {
      const t = 0.42;
      const fill = index % 2 === 0 ? GOLD : VIOLET;
      return `<circle cx="${cx + node.x * (1 - t)}" cy="${cy + node.y * (1 - t)}" r="3.5"
                      fill="${fill}" fill-opacity="0.85"/>`;
    })
    .join('');

  return `
    ${edges}
    ${points}
    ${pulses}
    <circle cx="${cx}" cy="${cy}" r="28" fill="${GOLD}" fill-opacity="0.16"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="${VIOLET}"/>`;
}

function card(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"
               viewBox="0 0 ${WIDTH} ${HEIGHT}"
               font-family="'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">
    <defs>
      <radialGradient id="glowViolet" cx="72%" cy="18%" r="62%">
        <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glowGold" cx="8%" cy="88%" r="58%">
        <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M48 0H0v48" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>
      </pattern>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <mask id="gridMask">
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fade)"/>
      </mask>
      <linearGradient id="headline" x1="0" y1="0" x2="1" y2="0.35">
        <stop offset="0%" stop-color="${GOLD}"/>
        <stop offset="100%" stop-color="${VIOLET}"/>
      </linearGradient>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" fill="${PLUM}"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" mask="url(#gridMask)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowViolet)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowGold)"/>

    ${network(908, 316)}

    ${mark(78, 66, 44, 'fx-og')}
    <text x="152" y="106" fill="${TEXT_ON_DARK}" font-size="30" font-weight="600"
          letter-spacing="-0.9">Feedex</text>

    <text x="80" y="252" fill="${TEXT_ON_DARK}" font-size="60" font-weight="700"
          letter-spacing="-1.9">Collect feedback from</text>
    <text x="80" y="326" fill="url(#headline)" font-size="60" font-weight="700"
          letter-spacing="-1.9">every project</text>
    <text x="80" y="400" fill="${TEXT_ON_DARK}" font-size="60" font-weight="700"
          letter-spacing="-1.9">in one place.</text>

    <text x="80" y="460" fill="${TEXT_MUTED_DARK}" font-size="23" font-weight="400">One widget. Every project. One dashboard.</text>

    <rect x="80" y="512" width="252" height="42" rx="21" fill="${PLUM_ELEVATED}"
          stroke="#ffffff" stroke-opacity="0.1"/>
    <text x="102" y="539" fill="${VIOLET}" font-size="15" font-weight="700"
          font-family="'Space Mono', ui-monospace, monospace" letter-spacing="1.9">7 KB · MIT</text>

    <text x="80" y="588" fill="${TEXT_MUTED_DARK}" font-size="16" font-weight="500"
          fill-opacity="0.7">feedex.rianfernando.com</text>
  </svg>`;
}

/**
 * App icon: the mark centred on a plum squircle.
 *
 * The handoff specifies a 22% corner radius, which at 512px is the `rx="112"`
 * from its reference asset.
 */
function appIcon(size: number): string {
  const radius = size * 0.22;
  // The mark occupies ~62% of the icon's width, leaving the handoff's clear space.
  const markWidth = size * 0.62;
  const markHeight = markWidth / 1.515;
  const x = (size - markWidth) / 2;
  const y = (size - markHeight) / 2;
  const scale = markHeight / 132;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <mask id="fx-icon">
        <rect x="0" y="0" width="200" height="132" fill="#fff"/>
        <g fill="none" stroke="#000" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
          <path d="M46 40 H152"/>
          <path d="M130 27 L152 40 L130 53"/>
          <path d="M154 70 H48"/>
          <path d="M70 57 L48 70 L70 83"/>
        </g>
      </mask>
    </defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="${PLUM}"/>
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <g mask="url(#fx-icon)">
        <path d="M100 12 H53 A43 43 0 0 0 53 98 H100 Z" fill="${GOLD}"/>
        <polygon points="62,90 36,120 84,99" fill="${GOLD}"/>
        <path d="M100 12 H147 A43 43 0 0 1 147 98 H100 Z" fill="${VIOLET}"/>
        <polygon points="138,90 164,120 116,99" fill="${VIOLET}"/>
      </g>
    </g>
  </svg>`;
}

async function main(): Promise<void> {
  const publicDir = path.resolve(process.cwd(), 'public');
  await mkdir(publicDir, { recursive: true });

  await sharp(Buffer.from(card()))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'og.png'));

  await sharp(Buffer.from(appIcon(180)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  await sharp(Buffer.from(appIcon(512)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-512.png'));

  // A 32px PNG is a valid .ico payload for every browser still in use, and
  // avoids pulling in an ICO encoder for one file.
  await sharp(Buffer.from(appIcon(32)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'favicon.ico'));

  await writeFile(path.join(publicDir, 'favicon.svg'), appIcon(32), 'utf8');

  console.log(
    '[og] wrote og.png (1200x630), apple-touch-icon.png, icon-512.png, favicon.ico, favicon.svg',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
