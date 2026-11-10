// Automated accessibility scan (axe-core) of every main page, including
// open pop-ups. Any violation of WCAG 2.2 A/AA fails the run.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, createVerifiedUser, signInViaApi, seedUserWithData, apiPost, todayKey } from './support.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page, label) {
  // Let entrance animations and lazy content settle.
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} element(s): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary, `axe violations on ${label}`).toEqual([]);
}

test.describe('signed out', () => {
  for (const [label, path] of [
    ['sign in', '/login'],
    ['sign up', '/signup'],
    ['forgotten password', '/forgot-password'],
    ['reset password', '/reset-password?token=' + 'a'.repeat(64)],
    ['verify email (link missing its code)', '/verify-email'],
    ['privacy notice', '/privacy'],
    ['disclaimer', '/disclaimer'],
  ]) {
    test(label, async ({ page }) => {
      await page.goto(path);
      await expectNoViolations(page, label);
    });
  }

  test('sign in, showing a validation message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).focus();
    await expect(page.locator('#email-error')).toBeVisible();
    await expectNoViolations(page, 'sign in with an error');
  });
});

test.describe('signed in, with data', () => {
  test.beforeEach(async ({ page }) => {
    const { account } = await seedUserWithData(page.request);
    await apiPost(page.request, '/recurring', {
      account_id: account.id, amount: '-11.99', description: 'Velvetreel Streaming', frequency: 'monthly', start_date: todayKey(),
    });
  });

  for (const [label, path] of [
    ['dashboard', '/dashboard'],
    ['transactions', '/transactions'],
    ['accounts', '/accounts'],
    ['import', '/import'],
    ['settings', '/settings'],
  ]) {
    test(label, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await expectNoViolations(page, label);
    });
  }

  test('transactions with the add form open', async ({ page }) => {
    await page.goto('/transactions');
    await page.getByRole('button', { name: '+ Add' }).click();
    await page.getByRole('button', { name: 'Add transaction' }).click(); // show the field errors too
    await expectNoViolations(page, 'add form with errors');
  });

  test('transactions with the edit form open', async ({ page }) => {
    await page.goto('/transactions');
    await page.getByRole('button', { name: /^Edit / }).first().click();
    await expectNoViolations(page, 'edit form');
  });

  test('month picker open', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /^Month:/ }).click();
    await expect(page.getByRole('dialog', { name: 'Choose a month' })).toBeVisible();
    await expectNoViolations(page, 'month picker');
  });

  test('command palette open, with search results', async ({ page }) => {
    await page.goto('/dashboard');
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox').fill('fern');
    await expect(page.getByRole('option', { name: /Fernhollow/ }).first()).toBeVisible();
    await expectNoViolations(page, 'command palette');
  });
});

// Bug 17: controls that were clickable <span>s couldn't be reached with
// the keyboard. Pressing Tab must reach each of them.
test.describe('keyboard', () => {
  async function tabUntil(page, matches, maxPresses = 40) {
    for (let i = 0; i < maxPresses; i += 1) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? (el.getAttribute('aria-label') || el.textContent || '').trim() : '';
      });
      if (matches(name)) return name;
    }
    return null;
  }

  test('every control on the sign-in page can be reached with Tab', async ({ page }) => {
    await page.goto('/login');
    for (const target of ['Forgot password?', 'Sign in', 'Try the demo', 'Sign up', 'Privacy notice', 'Disclaimer']) {
      await page.locator('body').focus();
      expect(await tabUntil(page, (n) => n === target), target).toBe(target);
    }
  });

  test('delete, edit and category controls can be reached with Tab and used with Enter', async ({ page }) => {
    await seedUserWithData(page.request);
    await page.goto('/accounts');
    expect(await tabUntil(page, (n) => n === 'Delete Current account')).toBe('Delete Current account');

    await page.goto('/transactions');
    expect(await tabUntil(page, (n) => n.startsWith('Edit '))).toMatch(/^Edit /);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('form', { name: 'Edit transaction' })).toBeVisible();

    await page.goto('/dashboard');
    expect(await tabUntil(page, (n) => n === 'Show Groceries transactions')).toBe('Show Groceries transactions');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/transactions\?category=Groceries/);
  });
});

test.describe('signed in, before adding anything (empty states)', () => {
  test.beforeEach(async ({ page }) => {
    const user = await createVerifiedUser(page.request);
    await signInViaApi(page.request, user);
  });

  for (const [label, path] of [['empty dashboard', '/dashboard'], ['empty transactions', '/transactions'], ['empty accounts', '/accounts']]) {
    test(label, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await expectNoViolations(page, label);
    });
  }
});
