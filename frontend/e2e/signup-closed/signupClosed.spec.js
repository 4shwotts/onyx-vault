// Runs against the second test server, started with
// PUBLIC_SIGNUP_ENABLED=false, as the live site will be.
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support.js';

test('the sign-up page keeps its design but is closed, pointing to the demo', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByText('Sign-up is closed on the live site.')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeDisabled();
  await expect(page.getByLabel('Password', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();

  await page.getByRole('link', { name: 'Try the demo instead' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('region', { name: 'Demo mode' })).toBeVisible();
});

test('the server refuses sign-up even if the form is bypassed', async ({ page }) => {
  const res = await page.request.post('/api/auth/register', {
    data: { email: 'bypass@gmail.com', password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 5000 },
  });
  expect(res.status()).toBe(403);
  expect(await res.json()).toEqual({ error: 'Sign-up is closed on the live site. Try the demo instead.' });
  expect((await page.request.get('/api/config')).ok()).toBe(true);
  expect(await (await page.request.get('/api/config')).json()).toEqual({ publicSignupEnabled: false });
});

test('signing in and the forgotten-password page still work', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  // Wait for the new page: both pages have an "Email" field.
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email').fill('someone@gmail.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('a password reset link has been sent');
});

test('the closed sign-up page has no accessibility violations', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByText('Sign-up is closed on the live site.')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
