// The privacy notice and disclaimer: public pages, linked from sign-in,
// sign-up, settings and the demo banner.
import { test, expect } from './support.js';

test('both pages are readable without signing in', async ({ page }) => {
  for (const [path, heading] of [['/privacy', 'Privacy notice'], ['/disclaimer', 'Disclaimer']]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('linked from the sign-in and sign-up pages', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Privacy notice' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();

  await page.goto('/signup');
  await expect(page.getByTestId('short-disclaimer')).toContainText('not a real financial service');
  await page.getByTestId('short-disclaimer').getByRole('link', { name: 'Read the disclaimer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Disclaimer' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('isn’t authorised or regulated by the Financial Conduct Authority (FCA)');
});

test('linked from the demo banner and from settings, without ending the demo', async ({ page }) => {
  await page.goto('/demo');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('region', { name: 'Demo mode' }).getByRole('link', { name: 'Read the disclaimer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Disclaimer' })).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('region', { name: 'Privacy and disclaimer' }).getByRole('link', { name: 'Privacy notice' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();

  // Still signed in to the same demo.
  await page.goto('/dashboard');
  await expect(page.getByRole('region', { name: 'Demo mode' })).toBeVisible();
});
