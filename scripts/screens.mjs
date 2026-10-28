/**
 * Capture the README screenshots from the seeded demo.
 *
 *   npm run dev -- --reset     # start with the curated 10-order demo
 *   npm run screens
 *
 * Screenshots are written to docs/screens and are read-only: no chain writes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_URL,
  assertAppIsRunning,
  launchBrowser,
  loginAs,
  watchPage,
} from './lib/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const PUBLIC_ORDER = 'BT-7K4M2Q';
const errors = [];

await fs.mkdir(OUT, { recursive: true });
await assertAppIsRunning();

const browser = await launchBrowser();

async function fresh(options = {}, persona = null) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...options,
  });
  const page = await context.newPage();
  watchPage(page, errors);
  if (persona) await loginAs(page, persona);
  return { context, page };
}

async function shot(page, name, { fullPage = true, wait = 400 } = {}) {
  await page.waitForTimeout(wait);
  const target = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: target, fullPage });
  console.log(`  captured ${path.relative(ROOT, target)}`);
}

async function go(page, route) {
  await page.goto(`${APP_URL}${route}`, { waitUntil: 'networkidle' });
}

try {
  console.log(`[screens] ${APP_URL} → ${path.relative(ROOT, OUT)}`);

  // Auth.
  {
    const { context, page } = await fresh({ colorScheme: 'light' });
    await go(page, '/login');
    await shot(page, 'login-light');
    await context.close();
  }
  {
    const { context, page } = await fresh({ colorScheme: 'dark' });
    await go(page, '/login');
    await shot(page, 'login-dark');
    await context.close();
  }

  // Customer, light.
  {
    const { context, page } = await fresh({}, 'Rohan Mehta');
    await shot(page, 'customer-dashboard');
    await go(page, '/orders');
    await shot(page, 'customer-orders');
    const href = await page.locator('table tbody tr a.table__id').first().getAttribute('href');
    if (href) {
      await go(page, href);
      await shot(page, 'customer-order-detail');
    }
    await go(page, '/orders/new');
    await shot(page, 'customer-new-order');
    await context.close();
  }

  // Customer, dark.
  {
    const { context, page } = await fresh({ colorScheme: 'dark' }, 'Rohan Mehta');
    await shot(page, 'customer-dashboard-dark');
    await context.close();
  }

  // Admin.
  {
    const { context, page } = await fresh({}, 'Maya Sharma');
    await shot(page, 'admin-dashboard');
    await go(page, '/dispatch');
    await shot(page, 'admin-dispatch');
    await go(page, '/team');
    await shot(page, 'admin-team');
    await go(page, '/reports');
    await shot(page, 'admin-reports');
    await go(page, '/notifications');
    await shot(page, 'admin-notifications', { fullPage: false });
    await go(page, '/settings');
    await shot(page, 'admin-settings');
    await context.close();
  }

  // Courier.
  {
    const { context, page } = await fresh({}, 'Arjun Kapoor');
    await go(page, '/queue');
    await shot(page, 'courier-queue');
    await context.close();
  }

  // Public.
  {
    const { context, page } = await fresh({});
    await go(page, `/track/${PUBLIC_ORDER}`);
    await shot(page, 'public-track');
    await go(page, '/privacy');
    await shot(page, 'public-privacy');
    await go(page, '/does-not-exist');
    await shot(page, 'not-found');
    await context.close();
  }

  // Mobile.
  {
    const { context, page } = await fresh(
      { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 },
      'Rohan Mehta'
    );
    await shot(page, 'mobile-dashboard');
    await go(page, '/orders');
    await shot(page, 'mobile-orders');
    const href = await page.locator('.order-card').first().getAttribute('href');
    if (href) {
      await go(page, href);
      await shot(page, 'mobile-order-detail');
    }
    await go(page, '/orders/new');
    await shot(page, 'mobile-new-order');
    await go(page, `/track/${PUBLIC_ORDER}`);
    await shot(page, 'mobile-public-track');
    await context.close();
  }

  console.log(`[screens] done — ${errors.length ? `${errors.length} browser errors` : 'no browser errors'}`);
  if (errors.length) {
    for (const error of [...new Set(errors)]) console.error(`  - ${error}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`[screens] ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
