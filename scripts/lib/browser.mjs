import fs from 'node:fs';
import { chromium } from 'playwright-core';

export const APP_URL = (process.env.APP_URL || 'http://127.0.0.1:5173').replace(
  /\/$/,
  ''
);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

/**
 * playwright-core does not ship a browser, so use a locally installed Chrome.
 * `channel: "chrome"` is the most portable fallback.
 */
export async function launchBrowser({ headless = process.env.HEADED !== '1' } = {}) {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  for (const executablePath of CHROME_CANDIDATES) {
    if (!fs.existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ executablePath, headless, args });
    } catch {
      // Try the next candidate.
    }
  }
  try {
    return await chromium.launch({ channel: 'chrome', headless, args });
  } catch (error) {
    throw new Error(
      `Could not launch Chrome. Set CHROME_PATH to a Chrome/Chromium binary. (${error.message})`
    );
  }
}

export function watchPage(page, errors) {
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text().slice(0, 400)}`);
    }
  });
}

export async function openPage(browser, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...options,
  });
  const page = await context.newPage();
  return { context, page };
}

/**
 * Log in with one of the seeded Anvil personas. Waits until the dashboard
 * has rendered and the first order query has settled.
 */
export async function loginAs(page, name) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL('**/dashboard', { timeout: 20_000 });
  await page.waitForTimeout(2200);
}

export async function goto(page, path) {
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle' });
}

export function assertAppIsRunning() {
  return fetch(`${APP_URL}/deployment.json`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`deployment.json returned HTTP ${response.status}`);
      }
      const deployment = await response.json();
      if (!deployment.contractAddress) {
        throw new Error('deployment.json is missing contractAddress');
      }
      return deployment;
    })
    .catch((error) => {
      throw new Error(
        `The app is not reachable at ${APP_URL}. Start it with \`npm run dev\`. (${error.message})`
      );
    });
}
