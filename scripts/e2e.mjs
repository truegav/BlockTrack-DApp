/**
 * End-to-end smoke test for the demo stack.
 *
 * Prerequisites:
 *   npm run dev          # Anvil + contract + seed + Vite
 *   npm run test:e2e
 *
 * The test creates one encrypted order and walks it through dispatch, a courier
 * update, public tracking, cancellation and a vault lock/unlock. It is a smoke
 * test, not a replacement for the Forge unit tests.
 */
import {
  APP_URL,
  assertAppIsRunning,
  launchBrowser,
  loginAs,
  openPage,
  watchPage,
} from './lib/browser.mjs';

const errors = [];
const results = [];
let failures = 0;

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures += 1;
  console.log(`${condition ? '  ok  ' : ' fail '} ${name}${detail ? ` — ${detail}` : ''}`);
}

function uniqueName() {
  return `E2E Parcel ${Date.now().toString(36)}`;
}

async function fillNewOrder(page, recipientName) {
  await page.goto(`${APP_URL}/orders/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  await page.locator('#sender-name').fill('Rohan Mehta');
  await page.locator('#sender-phone').fill('+91 98450 11223');
  await page.locator('#sender-line1').fill('14, 3rd Cross, Indiranagar');
  await page.locator('#sender-city').fill('Bengaluru');
  await page.locator('#sender-state').fill('Karnataka');
  await page.locator('#sender-postalCode').fill('560038');
  await page.locator('#sender-country').fill('India');

  await page.locator('#recipient-name').fill(recipientName);
  await page.locator('#recipient-phone').fill('+91 90000 11111');
  await page.locator('#recipient-line1').fill('22, Test Lane');
  await page.locator('#recipient-city').fill('Mumbai');
  await page.locator('#recipient-state').fill('Maharashtra');
  await page.locator('#recipient-postalCode').fill('400001');
  await page.locator('#recipient-country').fill('India');

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(300);
  await page.locator('#parcel-description').fill('E2E encrypted parcel');
  await page.locator('#parcel-weightKg').fill('1.2');
  await page.locator('#parcel-declaredValue').fill('500');
  await page.locator('#parcel-instructions').fill('Call on arrival.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: /Encrypt & register/ }).click();
  await page.waitForURL(/\/orders\/BT-[A-Z0-9]+$/, { timeout: 60_000 });
  await page.waitForTimeout(2200);
  return page.url().split('/').pop();
}

let browser;
try {
  const deployment = await assertAppIsRunning();
  console.log(`[e2e] app ${APP_URL} · contract ${deployment.contractAddress}`);

  browser = await launchBrowser();
  const recipient = uniqueName();

  // 1. Customer creates an encrypted order and can read it back.
  const { context: rohanContext, page: rohan } = await openPage(browser);
  watchPage(rohan, errors);
  await loginAs(rohan, 'Rohan Mehta');
  const orderId = await fillNewOrder(rohan, recipient);
  check('new order has a tracking ID', /^BT-[A-Z0-9]+$/.test(orderId), orderId);

  let body = await rohan.locator('body').innerText();
  check('owner decrypts recipient', body.includes(recipient));
  check('owner decrypts parcel', body.includes('E2E encrypted parcel'));
  check('owner sees ciphertext model', body.includes('Encrypted'));

  // 2. Admin assigns Priya; the wrapped key is written for the courier.
  const { context: mayaContext, page: maya } = await openPage(browser);
  watchPage(maya, errors);
  await loginAs(maya, 'Maya Sharma');
  await maya.goto(`${APP_URL}/dispatch`, { waitUntil: 'networkidle' });
  await maya.waitForTimeout(1800);

  const dispatchRow = maya.locator('.dispatch-row', { hasText: orderId });
  check('new order is waiting in dispatch', (await dispatchRow.count()) === 1);
  await dispatchRow.getByRole('button', { name: 'Assign' }).click();
  await maya.waitForTimeout(400);
  const assignDialog = maya.locator('dialog');
  await assignDialog.getByText('Priya Nair', { exact: false }).click();
  await assignDialog.getByRole('button', { name: 'Assign courier' }).click();
  await maya.waitForTimeout(3200);

  await maya.goto(`${APP_URL}/orders/${orderId}`, { waitUntil: 'networkidle' });
  await maya.waitForTimeout(1800);
  body = await maya.locator('body').innerText();
  check('admin sees the decrypted order', body.includes(recipient));
  check('courier is assigned', body.includes('Priya Nair'));

  // 3. Courier updates the status with an encrypted note.
  const { context: priyaContext, page: priya } = await openPage(browser);
  watchPage(priya, errors);
  await loginAs(priya, 'Priya Nair');
  await priya.goto(`${APP_URL}/queue`, { waitUntil: 'networkidle' });
  await priya.waitForTimeout(1800);
  check(
    'order appears in courier queue',
    (await priya.locator('body').innerText()).includes(orderId)
  );

  await priya.goto(`${APP_URL}/orders/${orderId}`, { waitUntil: 'networkidle' });
  await priya.waitForTimeout(1600);
  await priya.getByRole('button', { name: 'Update status' }).click();
  await priya.waitForTimeout(400);
  const updateDialog = priya.locator('dialog');
  await updateDialog.locator('#update-note').fill('E2E: collected from the sender.');
  await updateDialog.locator('#update-location').fill('Indiranagar, Bengaluru');
  await updateDialog.getByRole('button', { name: /Encrypt & update/ }).click();
  await priya.waitForTimeout(3200);
  await priya.reload({ waitUntil: 'networkidle' });
  await priya.waitForTimeout(1600);
  body = await priya.locator('body').innerText();
  check('courier sees picked up', body.includes('Picked up'));
  check('courier sees own note', body.includes('E2E: collected from the sender.'));

  // 4. Customer sees the courier note decrypted locally.
  await rohan.reload({ waitUntil: 'networkidle' });
  await rohan.waitForTimeout(1800);
  body = await rohan.locator('body').innerText();
  check('customer sees the courier note', body.includes('E2E: collected from the sender.'));
  check('customer sees the assigned courier', body.includes('Priya Nair'));

  // 5. Public tracker reveals status only.
  const { context: publicContext, page: publicPage } = await openPage(browser);
  watchPage(publicPage, errors);
  await publicPage.goto(`${APP_URL}/track/${orderId}`, { waitUntil: 'networkidle' });
  await publicPage.waitForTimeout(1200);
  body = await publicPage.locator('body').innerText();
  check('public tracker shows the status', body.includes('Picked up'));
  check('public tracker hides the recipient', !body.includes(recipient));
  check('public tracker hides the parcel', !body.includes('E2E encrypted parcel'));
  check(
    'public tracker hides the encrypted note',
    !body.includes('E2E: collected from the sender.')
  );

  // 6. Admin cancels a non-final order.
  await maya.goto(`${APP_URL}/orders/${orderId}`, { waitUntil: 'networkidle' });
  await maya.waitForTimeout(1400);
  await maya.getByRole('button', { name: 'Cancel', exact: true }).click();
  await maya.waitForTimeout(400);
  const cancelDialog = maya.locator('dialog');
  await cancelDialog.locator('#cancel-reason').fill('E2E: cancelled by operations.');
  await cancelDialog.getByRole('button', { name: 'Cancel order' }).click();
  await maya.waitForTimeout(3000);
  await maya.reload({ waitUntil: 'networkidle' });
  await maya.waitForTimeout(1400);
  body = await maya.locator('body').innerText();
  check('admin cancellation is visible', body.includes('Cancelled'));
  check('cancellation reason is decrypted', body.includes('E2E: cancelled by operations.'));

  // 7. Vault lock clears decrypted state; signing again restores access.
  await rohan.goto(`${APP_URL}/dashboard`, { waitUntil: 'networkidle' });
  await rohan.waitForTimeout(900);
  await rohan.getByRole('button', { name: 'Lock vault' }).click();
  await rohan.waitForTimeout(900);
  body = await rohan.locator('body').innerText();
  check('lock shows the unlock gate', body.includes('Unlock your encrypted shipments'));
  check('locked UI does not render order data', !body.includes(recipient));

  await rohan.getByRole('button', { name: /Sign to unlock/ }).click();
  await rohan.waitForTimeout(2400);
  body = await rohan.locator('body').innerText();
  check('unlock restores the dashboard', body.includes('Overview'));

  await Promise.all([
    rohanContext.close(),
    mayaContext.close(),
    priyaContext.close(),
    publicContext.close(),
  ]);
} catch (error) {
  failures += 1;
  console.error('[e2e] crashed:', error.message);
  if (error.stack) console.error(error.stack.split('\n').slice(0, 4).join('\n'));
} finally {
  if (browser) await browser.close();
}

const uniqueErrors = [...new Set(errors)];
if (uniqueErrors.length) {
  failures += uniqueErrors.length;
  console.error('\nBrowser errors:');
  for (const error of uniqueErrors) console.error(`  - ${error}`);
}

console.log(
  `\n[e2e] ${results.filter((result) => result.ok).length}/${results.length} checks passed`
);
console.log(`[e2e] ${failures ? 'FAILED' : 'PASSED'}`);
if (failures) process.exitCode = 1;
