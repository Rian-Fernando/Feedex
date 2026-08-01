import { chromium, type Browser, type Page } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { loadEnv } from './load-env';

loadEnv();

/**
 * End-to-end smoke test.
 *
 * Drives a real browser through the paths that matter and would be expensive to
 * get wrong: the marketing page renders, a user can sign in, the dashboard and
 * its sub-pages load with data, the widget bundle is served with the right
 * headers, and the public ingestion endpoint accepts a submission that then
 * appears in the dashboard.
 *
 * Uses the locally installed Chrome via `channel` rather than downloading a
 * browser, so the dependency footprint stays at one small package.
 *
 * Screenshots are written to `.screenshots/` for visual review.
 *
 *   npm run dev          # in one terminal
 *   npm run test:e2e     # in another
 */

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = process.env.SMOKE_OUT_DIR ?? '.screenshots';

const DEMO_EMAIL = 'demo@feedex.dev';
const DEMO_PASSWORD = 'feedex-demo-2026';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function shoot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage });
}

async function run(browser: Browser): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  /* ------------------------------- marketing ------------------------------ */
  console.log('\nmarketing');

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  check('home renders an h1', (await page.locator('h1').count()) === 1);
  check(
    'home headline is the product promise',
    (await page.locator('h1').innerText()).includes('every project'),
  );
  check('nav landmark present', (await page.locator('nav[aria-label="Main"]').count()) > 0);
  check('footer present', (await page.locator('footer').count()) > 0);
  check(
    'portfolio backlink present',
    (await page.locator('a[href="https://rianfernando.com"]').count()) > 0,
  );
  check(
    'JSON-LD structured data present',
    (await page.locator('script[type="application/ld+json"]').count()) > 0,
  );

  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
  let parsedLd: { '@graph'?: Array<{ '@type'?: string }> } = {};
  try {
    parsedLd = JSON.parse(jsonLd ?? '{}');
  } catch {
    /* handled by the check below */
  }
  const types = (parsedLd['@graph'] ?? []).map((node) => node['@type']);
  check('JSON-LD declares WebApplication', types.includes('WebApplication'));
  check('JSON-LD declares FAQPage', types.includes('FAQPage'));

  await shoot(page, '01-home');
  await shoot(page, '02-home-full', true);

  /* --------------------------------- tour --------------------------------- */
  console.log('\nproduct tour');

  await page.locator('#tour').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  check('tour tablist present', (await page.locator('[role="tablist"]').count()) > 0);

  // Stepping through the tour must swap the panel content.
  await page.locator('#tour-tab-triage').click();
  await page.waitForTimeout(500);
  check(
    'tour step selects',
    (await page.locator('#tour-tab-triage').getAttribute('aria-selected')) === 'true',
  );
  await shoot(page, '03-tour');

  /* --------------------------------- theme -------------------------------- */
  console.log('\ntheme');

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  check('dark theme applied by default', (await page.locator('html.dark').count()) > 0);

  /* ---------------------------------- auth -------------------------------- */
  console.log('\nauthentication');

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  check('unauthenticated dashboard redirects to login', page.url().includes('/login'));
  await shoot(page, '04-login');

  await page.fill('input[name="email"]', DEMO_EMAIL);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  check('sign-in reaches the dashboard', page.url().includes('/dashboard'));

  /* ------------------------------- dashboard ------------------------------ */
  console.log('\ndashboard');

  await page.waitForLoadState('networkidle');
  check(
    'overview greets the user',
    (await page.locator('h1').innerText()).includes('Welcome back'),
  );
  check('metrics rendered', (await page.getByText('Total reports', { exact: true }).count()) > 0);
  check('recent feedback listed', (await page.getByText('Recent feedback').count()) > 0);
  await shoot(page, '05-dashboard');
  await shoot(page, '06-dashboard-full', true);

  await page.goto(`${BASE_URL}/dashboard/projects`, { waitUntil: 'networkidle' });
  check('projects page lists seeded projects', (await page.getByText('Dashboard').count()) > 0);
  await shoot(page, '07-projects');

  await page.goto(`${BASE_URL}/dashboard/feedback`, { waitUntil: 'networkidle' });
  check('feedback list renders rows', (await page.locator('main li a').count()) > 0);
  await shoot(page, '08-feedback');

  // Filters live in the URL, so a filtered view must survive a direct load.
  await page.goto(`${BASE_URL}/dashboard/feedback?status=open`, { waitUntil: 'networkidle' });
  check('feedback filter applies from the URL', (await page.locator('main li a').count()) > 0);

  // Client-side navigation settles after `networkidle`, so wait on the URL
  // itself rather than on the network going quiet.
  await page.locator('main li a').first().click();
  await page.waitForURL(/\/dashboard\/feedback\/fbk_/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  check('feedback detail opens', page.url().includes('/dashboard/feedback/fbk_'));
  check('detail shows captured context', (await page.getByText('Context').count()) > 0);
  check('detail shows triage controls', (await page.getByText('Triage').count()) > 0);
  await shoot(page, '09-feedback-detail', true);

  await page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: 'networkidle' });
  check('settings renders', (await page.getByText('Appearance').count()) > 0);
  await shoot(page, '10-settings');

  /* --------------------------- project + install -------------------------- */
  console.log('\nproject detail');

  await page.goto(`${BASE_URL}/dashboard/projects`, { waitUntil: 'networkidle' });
  await page.locator('main a[href^="/dashboard/projects/prj_"]').first().click();
  await page.waitForURL(/\/dashboard\/projects\/prj_/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  check('project detail opens', page.url().includes('/dashboard/projects/prj_'));

  await page.getByRole('tab', { name: 'Install' }).click();
  await page.waitForTimeout(400);
  check('install snippet shown', (await page.getByText('pk_fdx_').first().count()) > 0);
  check('api keys panel shown', (await page.getByText('API keys').count()) > 0);
  await shoot(page, '11-project-install', true);

  /* --------------------------------- light -------------------------------- */
  console.log('\nlight theme');

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.localStorage.setItem('feedex-theme', 'light');
  });
  await page.reload({ waitUntil: 'networkidle' });
  check('light theme applies', (await page.locator('html.dark').count()) === 0);
  await shoot(page, '12-dashboard-light');

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shoot(page, '13-home-light');

  /* --------------------------------- mobile ------------------------------- */
  console.log('\nmobile');

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
  const overflow = await mobilePage.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= limit + 1) return null;

    // Everything here is inlined rather than split into helpers: the function
    // is serialised and run inside the page, where the bundler's helper
    // shims (`__name` and friends) do not exist.
    const offenders: Array<{ selector: string; right: number }> = [];

    for (const element of Array.from(document.querySelectorAll('body *'))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= limit + 1) continue;

      // Elements inside a horizontally scrollable ancestor are meant to extend
      // past the viewport — that is what the scroll container is for. Only
      // overflow no ancestor absorbs can widen the document.
      let absorbed = false;
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
          absorbed = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (absorbed) continue;

      const el = element as HTMLElement;
      const classes = (el.className || '')
        .toString()
        .split(' ')
        .filter(Boolean)
        .slice(0, 4)
        .join('.');

      offenders.push({
        selector: el.tagName.toLowerCase() + (classes ? '.' + classes : ''),
        right: Math.round(rect.right),
      });
    }

    offenders.sort((a, b) => b.right - a.right);

    return {
      scrollWidth: document.documentElement.scrollWidth,
      limit,
      offenders: offenders.slice(0, 4),
    };
  });

  check(
    'mobile page does not scroll horizontally',
    overflow === null,
    overflow
      ? `${overflow.scrollWidth}px > ${overflow.limit}px :: ${overflow.offenders
          .map((o) => `${o.selector} @${o.right}`)
          .join(' | ')}`
      : undefined,
  );

  await mobilePage.screenshot({ path: path.join(OUT_DIR, '14-home-mobile.png') });
  await mobile.close();

  /* ------------------------------ widget + api ---------------------------- */
  console.log('\nwidget and ingestion');

  const widgetResponse = await page.request.get(`${BASE_URL}/widget.js`);
  check('widget.js served', widgetResponse.status() === 200);
  check(
    'widget.js is CORS-enabled',
    widgetResponse.headers()['access-control-allow-origin'] === '*',
  );

  const health = await page.request.get(`${BASE_URL}/api/health`);
  check('health endpoint ok', health.status() === 200);

  const rejected = await page.request.post(`${BASE_URL}/api/v1/feedback`, {
    data: { publicKey: 'pk_fdx_not_a_real_key', description: 'should be rejected' },
  });
  check('ingestion rejects an unknown key', rejected.status() === 401);

  const invalid = await page.request.post(`${BASE_URL}/api/v1/feedback`, {
    data: { publicKey: 'pk_fdx_short', description: 'x' },
  });
  check('ingestion rejects a short description', invalid.status() === 422);

  const unauthorised = await page.request.get(`${BASE_URL}/api/v1/issues`);
  check('issues API requires a key', unauthorised.status() === 401);

  const robots = await page.request.get(`${BASE_URL}/robots.txt`);
  const robotsBody = await robots.text();
  check('robots allows GPTBot', robotsBody.includes('GPTBot'));
  check('robots allows ClaudeBot', robotsBody.includes('ClaudeBot'));
  check('robots disallows the dashboard', robotsBody.includes('/dashboard'));

  const llms = await page.request.get(`${BASE_URL}/llms.txt`);
  const llmsBody = await llms.text();
  check('llms.txt served', llms.status() === 200);
  check('llms.txt has an H1', llmsBody.startsWith('# Feedex'));
  check('llms.txt has a blockquote summary', llmsBody.includes('\n> Feedex is'));

  const sitemap = await page.request.get(`${BASE_URL}/sitemap.xml`);
  check('sitemap served', sitemap.status() === 200);

  /* ------------------------------ console noise --------------------------- */
  console.log('\nconsole');

  // React and Next both surface real problems as console errors, so anything
  // here is worth failing on. Known-benign noise is filtered explicitly.
  const meaningful = consoleErrors.filter(
    (message) =>
      !message.includes('Download the React DevTools') &&
      !message.includes('favicon') &&
      !/WebGL|SwiftShader|GroupMarkerNotSet/i.test(message),
  );
  check('no console errors', meaningful.length === 0, meaningful.slice(0, 3).join(' | '));

  await context.close();
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--enable-unsafe-swiftshader'],
  });

  try {
    await run(browser);
  } finally {
    await browser.close();
  }

  console.log('');
  if (failures > 0) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log(`all checks passed — screenshots in ${OUT_DIR}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
