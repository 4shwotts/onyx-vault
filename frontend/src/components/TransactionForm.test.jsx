// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionForm from './TransactionForm';

const accounts = [{ id: 1, name: 'Current' }, { id: 2, name: 'Savings' }];

function setup(props = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<TransactionForm accounts={accounts} onSubmit={onSubmit} {...props} />);
  return { user, onSubmit };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('TransactionForm validation', () => {
  it('every field has an accessible label', () => {
    setup();
    for (const name of ['Account', 'Description', 'Category', 'Amount in pounds', 'Money in or out', 'Date']) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  it('defaults the date to today on the user’s clock', () => {
    setup();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-10');
  });

  it('shows an error for each missing required field and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Account')).toHaveAccessibleDescription('Choose an account.');
    expect(screen.getByLabelText('Amount in pounds')).toHaveAccessibleDescription('Enter an amount.');
    expect(screen.getByLabelText('Account')).toHaveAttribute('aria-invalid', 'true');
    // Focus moves to the first problem.
    expect(screen.getByLabelText('Account')).toHaveFocus();
  });

  it.each([
    ['12.345', /up to 2 decimal places/],
    ['1e3', /up to 2 decimal places/],
    ['-5', /up to 2 decimal places/],
    ['£12', /up to 2 decimal places/],
    ['0', /can’t be zero/],
    ['0.00', /can’t be zero/],
    ['1000000', /more than £999,999.99/],
    ['999999.999', /up to 2 decimal places/],
  ])('rejects an amount of %j', async (amount, message) => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText('Account'), '1');
    await user.type(screen.getByLabelText('Amount in pounds'), amount);
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Amount in pounds')).toHaveAccessibleDescription(message);
  });

  it('accepts the largest allowed amount, £999,999.99', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText('Account'), '1');
    await user.type(screen.getByLabelText('Amount in pounds'), '999999.99');
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: '999999.99' }));
  });

  it('clears a field’s error as soon as it is corrected', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));
    await user.selectOptions(screen.getByLabelText('Account'), '2');
    expect(screen.getByLabelText('Account')).not.toHaveAttribute('aria-invalid');
  });

  it('submits valid values', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText('Account'), '2');
    await user.type(screen.getByLabelText('Description'), 'Corner shop');
    await user.selectOptions(screen.getByLabelText('Category'), 'Groceries');
    await user.type(screen.getByLabelText('Amount in pounds'), '12.5');
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      accountId: '2', description: 'Corner shop', categoryName: 'Groceries', amount: '12.5', isExpense: true, date: '2026-11-10', makeRecurring: false,
    }));
  });

  it('offers a frequency only when "Make this recurring" is ticked', async () => {
    const { user } = setup();
    expect(screen.queryByLabelText('How often')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Make this recurring'));
    expect(screen.getByLabelText('How often')).toHaveValue('monthly');
    expect(screen.getByRole('button', { name: 'Create recurring rule' })).toBeInTheDocument();
  });

  it('shows an error from the server without losing what was typed', async () => {
    const { user, onSubmit } = setup();
    onSubmit.mockRejectedValueOnce(new Error('Account not found'));
    await user.selectOptions(screen.getByLabelText('Account'), '1');
    await user.type(screen.getByLabelText('Amount in pounds'), '7.20');
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Account not found');
    expect(screen.getByLabelText('Amount in pounds')).toHaveValue('7.20');
  });
});

describe('TransactionForm in edit mode', () => {
  const existing = {
    id: 9, account_id: 1, category_name: 'Bills', amount: '-68.00', description: 'Quillby Energy', date: '2026-10-21',
  };

  it('starts with the transaction’s values, shown as a positive amount and an expense', () => {
    setup({ mode: 'edit', initial: existing });
    expect(screen.getByRole('form', { name: 'Edit transaction' })).toBeInTheDocument();
    expect(screen.getByLabelText('Account')).toHaveValue('1');
    expect(screen.getByLabelText('Description')).toHaveValue('Quillby Energy');
    expect(screen.getByLabelText('Category')).toHaveValue('Bills');
    expect(screen.getByLabelText('Amount in pounds')).toHaveValue('68.00');
    expect(screen.getByLabelText('Money in or out')).toHaveValue('expense');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-21');
  });

  it('does not offer to make an existing transaction recurring', () => {
    setup({ mode: 'edit', initial: existing });
    expect(screen.queryByLabelText('Make this recurring')).not.toBeInTheDocument();
  });

  it('reads an API timestamp date as its calendar day', () => {
    setup({ mode: 'edit', initial: { ...existing, date: '2026-10-21T00:00:00.000Z' } });
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-21');
  });

  it('cancels without submitting', async () => {
    const onCancel = vi.fn();
    const { user, onSubmit } = setup({ mode: 'edit', initial: existing, onCancel });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
