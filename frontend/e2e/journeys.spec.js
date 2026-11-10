// End-to-end journeys in Chromium, through the real UI, against the
// throwaway test API.
import {
  test, expect, PASSWORD, uniqueEmail, lastEmailLink, createVerifiedUser, signInViaApi, signInViaUi, apiPost, todayKey,
} from './support.js';

async function addTransaction(page, { account = 'Current', description, category, amount, type = 'Expense', date = todayKey() }) {
  await page.getByRole('button', { name: '+ Add' }).click();
  const form = page.getByRole('form', { name: 'Add transaction' });
  await form.getByLabel('Account').selectOption({ label: account });
  await form.getByLabel('Description').fill(description);
  await form.getByLabel('Category').selectOption(category);
  await form.getByLabel('Amount in pounds').fill(amount);
  await form.getByLabel('Money in or out').selectOption({ label: type });
  await form.getByLabel('Date').fill(date);
  await form.getByRole('button', { name: 'Add transaction' }).click();
  await expect(form).toBeHidden();
}

test('sign up → verify → add transactions → check totals and charts → log out → log back in, data still there', async ({ page, request }) => {
  const email = uniqueEmail('journey');

  // Sign up.
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.waitForTimeout(400); // the bot check's minimum time (shortened under test)
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email for a verification link');

  // Signing in before verifying is refused.
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please verify your email before logging in');

  // Verify with the emailed link; the code is cleared from the address bar.
  const link = await lastEmailLink(request, email);
  await page.goto(link.pathname + link.search);
  await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);

  // Sign in: a brand-new user sees the empty dashboard.
  await page.getByRole('link', { name: 'Go to sign in' }).click();
  await signInViaUi(page, { email, password: PASSWORD });
  await expect(page.getByText('No accounts yet — add one on the Accounts page.')).toBeVisible();

  // Add an account.
  await page.getByRole('link', { name: 'Accounts' }).click();
  await page.getByRole('button', { name: '+ Add account' }).click();
  await page.getByLabel('Account type').selectOption('current');
  await page.getByRole('button', { name: 'Create account' }).click();
  const card = page.getByRole('list', { name: 'Your accounts' }).getByRole('listitem');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Current');
  await expect(card).toContainText('£0.00');
  await expect(card).toContainText('Account 01');

  // Add transactions.
  await page.getByRole('link', { name: 'Transactions' }).click();
  await addTransaction(page, { description: 'Salary – Brambleworth Ltd', category: 'Income', amount: '2100', type: 'Income' });
  await addTransaction(page, { description: 'Fernhollow Grocers', category: 'Groceries', amount: '42.10' });
  await addTransaction(page, { description: 'Fernhollow Grocers', category: 'Groceries', amount: '7.90' });
  await addTransaction(page, { description: 'Glimmerline Rail', category: 'Transport', amount: '14.30' });
  const rows = page.getByRole('list', { name: 'Transactions' }).getByRole('listitem');
  await expect(rows).toHaveCount(4);
  await expect(rows.filter({ hasText: 'Glimmerline Rail' })).toContainText('−£14.30');
  await expect(rows.filter({ hasText: 'Salary' })).toContainText('+£2,100.00');

  // Totals and charts on the dashboard: 2100.00 − 42.10 − 7.90 − 14.30.
  await page.getByRole('link', { name: 'Dashboard' }).click();
  const main = page.getByRole('main');
  const totalBalance = main.getByRole('heading', { name: 'Total Balance:' }).locator('xpath=following-sibling::p[1]');
  await expect(totalBalance).toHaveText('£2,035.70');
  await expect(main.getByRole('button', { name: 'Show Groceries transactions' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Show Transport transactions' })).toBeVisible();
  await expect(main.locator('svg text').first()).toHaveText('£64'); // donut centre: £64.30 rounded
  await expect(page.getByTestId('insight-line')).toContainText('Groceries');
  await expect(main.getByText('Glimmerline Rail')).toBeVisible();

  // A legend entry links to that category's transactions.
  await main.getByRole('button', { name: 'Show Transport transactions' }).click();
  await expect(page).toHaveURL(/\/transactions\?category=Transport/);
  await expect(page.getByRole('list', { name: 'Transactions' }).getByRole('listitem')).toHaveCount(1);

  // Log out: protected pages bounce back to sign-in.
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);

  // Log back in: everything is still there.
  await signInViaUi(page, { email, password: PASSWORD });
  await expect(page.getByRole('main').getByRole('heading', { name: 'Total Balance:' }).locator('xpath=following-sibling::p[1]')).toHaveText('£2,035.70');
  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByRole('list', { name: 'Transactions' }).getByRole('listitem')).toHaveCount(4);
});

test('forgotten password: request a link, choose a new password, the old one stops working', async ({ page, request }) => {
  const user = await createVerifiedUser(request);

  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  // Wait for the new page: both pages have an "Email" field.
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('a password reset link has been sent');

  const link = await lastEmailLink(request, user.email);
  await page.goto(link.pathname + link.search);
  await expect(page).not.toHaveURL(/token=/);
  await page.getByLabel('New password', { exact: true }).fill('a-brand-new-password');
  await page.getByLabel('Confirm new password').fill('a-brand-new-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been updated');

  await page.getByRole('link', { name: 'Go to sign in' }).click();
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');

  await signInViaUi(page, { email: user.email, password: 'a-brand-new-password' });
});

test('add, edit and delete a transaction, with the balance following along', async ({ page }) => {
  // page.request shares the page's cookies, so signing in here signs the page in.
  const user = await createVerifiedUser(page.request);
  await signInViaApi(page.request, user);
  await apiPost(page.request, '/accounts', { name: 'Current', type: 'current' });

  await page.goto('/transactions');
  await addTransaction(page, { description: 'Pebblewick Coffee', category: 'Eating Out', amount: '3.85' });
  const row = page.getByRole('list', { name: 'Transactions' }).getByRole('listitem');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('−£3.85');

  // Edit.
  await page.getByRole('button', { name: 'Edit Pebblewick Coffee' }).click();
  const form = page.getByRole('form', { name: 'Edit transaction' });
  await expect(form.getByLabel('Amount in pounds')).toHaveValue('3.85');
  await form.getByLabel('Description').fill('Pebblewick Coffee (large)');
  await form.getByLabel('Amount in pounds').fill('4.20');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toHaveText('Transaction updated.');
  await expect(row).toContainText('Pebblewick Coffee (large)');
  await expect(row).toContainText('−£4.20');

  await page.goto('/accounts');
  await expect(page.getByRole('list', { name: 'Your accounts' })).toContainText('−£4.20');

  // Delete (confirming the browser dialog).
  await page.goto('/transactions');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Pebblewick Coffee (large)' }).click();
  await expect(page.getByText('No transactions yet.')).toBeVisible();

  await page.goto('/accounts');
  await expect(page.getByRole('list', { name: 'Your accounts' })).toContainText('£0.00');
});

test('create a recurring transaction and see it post', async ({ page }) => {
  const user = await createVerifiedUser(page.request);
  await signInViaApi(page.request, user);
  await apiPost(page.request, '/accounts', { name: 'Current', type: 'current' });

  await page.goto('/transactions');
  await page.getByRole('button', { name: '+ Add' }).click();
  const form = page.getByRole('form', { name: 'Add transaction' });
  await form.getByLabel('Account').selectOption({ label: 'Current' });
  await form.getByLabel('Description').fill('Velvetreel Streaming');
  await form.getByLabel('Category').selectOption('Subscriptions');
  await form.getByLabel('Amount in pounds').fill('11.99');
  await form.getByLabel('Date').fill(todayKey());
  await form.getByLabel('Make this recurring').check();
  await form.getByLabel('How often').selectOption('monthly');
  await form.getByRole('button', { name: 'Create recurring rule' }).click();

  await expect(page.getByRole('status')).toContainText('1 payment due so far has been added');
  const rules = page.getByRole('region', { name: 'Recurring Payments' });
  await expect(rules).toContainText('Velvetreel Streaming');
  await expect(rules).toContainText('MONTHLY');
  const posted = page.getByRole('list', { name: 'Transactions' }).getByRole('listitem');
  await expect(posted).toHaveCount(1);
  await expect(posted).toContainText('RECURRING');
  await expect(posted).toContainText('−£11.99');

  // Nothing more is due, so "add due payments now" posts nothing twice.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Add due payments now' }).click();
  await expect(page.getByRole('status')).toContainText('Nothing was due');
  await page.goto('/transactions');
  await expect(page.getByRole('list', { name: 'Transactions' }).getByRole('listitem')).toHaveCount(1);
});

test('delete an account: needs the password and a tick, then everything is gone', async ({ page, request }) => {
  const user = await createVerifiedUser(request);
  await signInViaUi(page, user);
  await apiPost(page.request, '/accounts', { name: 'Current', type: 'current' });

  await page.goto('/settings');
  await expect(page.getByRole('main')).toContainText(user.email);
  const section = page.getByRole('region', { name: 'Delete your account' });

  await section.getByRole('button', { name: 'Delete my account permanently' }).click();
  await expect(section.getByRole('alert')).toContainText('Tick the box');

  await section.getByLabel('I understand my account and all its data will be deleted permanently.').check();
  await section.getByLabel('Your password').fill('not-my-password');
  await section.getByRole('button', { name: 'Delete my account permanently' }).click();
  await expect(section.getByRole('alert')).toHaveText('Incorrect password');

  await section.getByLabel('Your password').fill(user.password);
  await section.getByRole('button', { name: 'Delete my account permanently' }).click();
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  await expect(page.getByRole('status')).toHaveText('Your account and all its data have been deleted.');

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
});
