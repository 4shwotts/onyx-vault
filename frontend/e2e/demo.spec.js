// "Try the demo" in a real browser: no email or password, made-up data,
// the demo banner, End demo, isolation between demos, and the "waking the
// server" message.
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support.js';

const DEMO_NOTICE = 'Demo mode: this account and its data are fake and reset after 24 hours. Not a real financial service.';

test('try the demo from the sign-in page, look around, then end it', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Try the demo' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // The banner, on every page.
  const banner = page.getByRole('region', { name: 'Demo mode' });
  await expect(banner).toContainText(DEMO_NOTICE);
  await expect(banner.getByRole('link', { name: 'Read the disclaimer' })).toHaveAttribute('href', '/disclaimer');

  // Made-up data straight away: balances, charts, insight, recent rows.
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Spend by Category' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Show Groceries transactions' })).toBeVisible();
  await expect(page.getByTestId('insight-line')).not.toBeEmpty();
  await expect(main.getByText('No transactions yet.')).toHaveCount(0);

  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByRole('region', { name: 'Recurring Payments' })).toContainText('Salary – Brambleworth Ltd');
  await expect(page.getByRole('region', { name: 'Recurring Payments' })).toContainText('Velvetreel Streaming');
  await expect(page.getByRole('list', { name: 'Transactions' }).getByRole('listitem').first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText(/Page 1 of \d+/);
  await expect(page.getByRole('region', { name: 'Demo mode' })).toBeVisible();

  // Settings explains the demo and has no "delete account" form.
  await page.goto('/settings');
  await expect(page.getByRole('main')).toContainText('You’re using the demo');
  await expect(page.getByRole('region', { name: 'Delete your account' })).toHaveCount(0);

  // End demo: back to sign-in, and the demo is gone.
  // The header has the only End demo button; the banner has none.
  await expect(page.getByRole('region', { name: 'Demo mode' }).getByRole('button')).toHaveCount(0);
  await page.getByRole('banner').getByRole('button', { name: 'End demo' }).click();
  await expect(page).toHaveURL(/\/login\?demoEnded=1$/);
  await expect(page.getByRole('status').first()).toHaveText('Your demo has ended and all its data has been deleted.');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('/demo works as a direct link', async ({ page }) => {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('region', { name: 'Demo mode' })).toBeVisible();
});

test('two visitors get separate demos: what one adds, the other never sees', async ({ browser }) => {
  const visitor = async (ip) => {
    const context = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': ip }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/demo');
    await expect(page).toHaveURL(/\/dashboard$/);
    return { context, page };
  };
  const a = await visitor('10.201.0.1');
  const b = await visitor('10.201.0.2');

  await a.page.goto('/transactions');
  await a.page.getByRole('button', { name: '+ Add' }).click();
  const form = a.page.getByRole('form', { name: 'Add transaction' });
  await form.getByLabel('Account').selectOption({ label: 'Current' });
  await form.getByLabel('Description').fill('Only in visitor A’s demo');
  await form.getByLabel('Amount in pounds').fill('1.23');
  await form.getByRole('button', { name: 'Add transaction' }).click();
  await expect(a.page.getByRole('list', { name: 'Transactions' })).toContainText('Only in visitor A’s demo');

  await b.page.goto('/transactions');
  await expect(b.page.getByRole('list', { name: 'Transactions' }).getByRole('listitem').first()).toBeVisible();
  await b.page.keyboard.press('Control+k');
  await b.page.getByRole('combobox', { name: /^Search pages/ }).fill('Only in visitor');
  await expect(b.page.getByRole('option', { name: /Only in visitor/ })).toHaveCount(0);

  await a.context.close();
  await b.context.close();
});

test('the sign-in page explains a slow, sleeping server, then gets out of the way', async ({ page }) => {
  // Hold the wake-up request for 3.5 seconds, as a sleeping server would.
  await page.route('**/api/wake', async (route) => {
    await new Promise((r) => setTimeout(r, 3500));
    await route.continue();
  });
  await page.goto('/login');
  const notice = page.getByRole('status').filter({ hasText: 'Waking the server' });
  await expect(notice).toHaveCount(0);
  await expect(notice).toHaveText('Waking the server — this can take up to a minute', { timeout: 3000 });
  await expect(notice).toHaveCount(0, { timeout: 5000 });
  // Signing in was possible all along.
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

test('a quick server shows no waking message at all', async ({ page }) => {
  await page.goto('/login');
  await page.waitForTimeout(2500);
  await expect(page.getByText('Waking the server')).toHaveCount(0);
});

test('demo pages have no accessibility violations', async ({ page }) => {
  const scan = async (label) => {
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`), label).toEqual([]);
  };
  await page.route('**/api/auth/demo', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto('/demo');
  await expect(page.getByRole('status')).toContainText('Waking the server');
  await scan('/demo while waking');
  await expect(page).toHaveURL(/\/dashboard$/);
  await scan('demo dashboard with banner');
  await page.goto('/settings');
  await scan('demo settings');
});
