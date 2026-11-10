// Shared fixtures and helpers for the browser tests.
import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

let ipCounter = 0;

// Each test gets its own client IP (the API trusts one proxy hop and the
// Vite proxy passes this header through), so rate limits behave as they
// would for separate visitors instead of one busy machine.
export const test = base.extend({
  extraHTTPHeaders: async ({}, use, testInfo) => {
    ipCounter += 1;
    const n = testInfo.workerIndex * 10000 + ipCounter;
    await use({ 'X-Forwarded-For': `10.200.${(n >> 8) & 255}.${n & 255}` });
  },
});

export { expect };

export const PASSWORD = 'correct-horse-battery';

export function uniqueEmail(label = 'e2e') {
  return `${label}.${randomUUID().slice(0, 8)}@gmail.com`;
}

// The verification/reset link the app "sent" (test outbox, NODE_ENV=test).
export async function lastEmailLink(request, email) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await request.get(`/api/__test__/outbox?to=${encodeURIComponent(email)}`);
    if (res.ok()) return new URL((await res.json()).link);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No email arrived for ${email}`);
}

// Creates and verifies a user through the API (fast set-up for journeys
// that aren't about sign-up itself).
export async function createVerifiedUser(request, { email = uniqueEmail(), password = PASSWORD } = {}) {
  const reg = await request.post('/api/auth/register', {
    data: { email, password, honeypot: '', formRenderedAt: Date.now() - 5000 },
  });
  expect(reg.status()).toBe(201);
  const link = await lastEmailLink(request, email);
  const verify = await request.post('/api/auth/verify-email', { data: { token: link.searchParams.get('token') } });
  expect(verify.status()).toBe(200);
  return { email, password };
}

// Signs in through the API; the session cookie lands in the page's context.
export async function signInViaApi(request, user) {
  const res = await request.post('/api/auth/login', { data: { email: user.email, password: user.password } });
  expect(res.status()).toBe(200);
}

export async function signInViaUi(page, user) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function apiPost(request, path, data) {
  const res = await request.post(`/api${path}`, { data });
  if (!res.ok()) throw new Error(`${path} failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

// Today on the machine's clock, as the date input shows it.
export function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A signed-in user with an account and a handful of made-up transactions.
export async function seedUserWithData(request) {
  const user = await createVerifiedUser(request);
  await signInViaApi(request, user);
  const account = await apiPost(request, '/accounts', { name: 'Current', type: 'current' });
  const groceries = await apiPost(request, '/categories', { name: 'Groceries' });
  const income = await apiPost(request, '/categories', { name: 'Income' });
  const today = todayKey();
  for (const [amount, description, categoryId] of [
    ['2100.00', 'Salary – Brambleworth Ltd', income.id],
    ['-42.10', 'Fernhollow Grocers', groceries.id],
    ['-7.90', 'Fernhollow Grocers', groceries.id],
  ]) {
    await apiPost(request, '/transactions', { account_id: account.id, category_id: categoryId, amount, description, date: today });
  }
  return { user, account };
}
