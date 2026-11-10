// @vitest-environment jsdom
// Loading and empty states: what a visitor (and a screen reader) is told
// while data loads, and when there is nothing to show yet.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Accounts from './Accounts';
import Transactions from './Transactions';
import Dashboard, { DashboardSkeleton } from './Dashboard';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    getAccounts: vi.fn(),
    getCategories: vi.fn(),
    getRecurring: vi.fn(),
    getTransactions: vi.fn(),
    getTransactionsPage: vi.fn(),
    logout: vi.fn(),
  },
}));

function renderAt(path, element) {
  return render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
}

// A promise that never settles: keeps a page in its loading state.
const pending = () => new Promise(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  api.getAccounts.mockResolvedValue([]);
  api.getCategories.mockResolvedValue([]);
  api.getRecurring.mockResolvedValue([]);
  api.getTransactions.mockResolvedValue([]);
  api.getTransactionsPage.mockResolvedValue({ transactions: [], page: 1, limit: 9, total: 0, totalPages: 0, totals: { income: '0.00', spending: '0.00', net: '0.00' } });
});

describe('loading states', () => {
  it('the dashboard skeleton is announced as loading', () => {
    render(<DashboardSkeleton isMobile={false} />);
    expect(screen.getByRole('status', { name: 'Loading your dashboard' })).toHaveAttribute('aria-busy', 'true');
  });

  it('the dashboard shows its skeleton until data arrives', () => {
    api.getAccounts.mockReturnValue(pending());
    renderAt('/dashboard', <Dashboard />);
    expect(screen.getByRole('status', { name: 'Loading your dashboard' })).toBeInTheDocument();
  });

  it('the accounts page says it is loading', () => {
    api.getAccounts.mockReturnValue(pending());
    renderAt('/accounts', <Accounts />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading accounts…');
  });

  it('the transactions page says it is loading', () => {
    api.getTransactionsPage.mockReturnValue(pending());
    renderAt('/transactions', <Transactions />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading transactions…');
  });
});

describe('empty states', () => {
  it('accounts: says there are none, and hides the made-up preview cards from assistive technology', async () => {
    renderAt('/accounts', <Accounts />);
    expect(await screen.findByText('No accounts yet — add one above.')).toHaveAttribute('role', 'status');
    expect(screen.queryByText('Loading accounts…')).toBeNull();
    // The blurred preview is decorative: not in the accessibility tree.
    expect(screen.queryByText('£1,240.00')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: /Current/ })).toBeNull();
  });

  it('transactions: says there are none yet', async () => {
    renderAt('/transactions', <Transactions />);
    expect(await screen.findByText('No transactions yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Transactions' })).toBeNull();
  });

  it('transactions: says when filters match nothing (rather than "none yet")', async () => {
    renderAt('/transactions?month=2026-10', <Transactions />);
    expect(await screen.findByText('No transactions match these filters.')).toBeInTheDocument();
  });

  it('dashboard: tells a new user there are no accounts or transactions yet', async () => {
    renderAt('/dashboard', <Dashboard />);
    expect(await screen.findByText('No accounts yet — add one on the Accounts page.')).toBeInTheDocument();
    const statuses = screen.getAllByRole('status').map((s) => s.textContent);
    expect(statuses).toContain('No transactions yet.');
    // No insight line when there is no spending.
    expect(screen.queryByTestId('insight-line')).toBeNull();
  });

  it('dashboard: with data, shows totals, the insight line and real rows', async () => {
    api.getAccounts.mockResolvedValue([{ id: 1, name: 'Current', balance: '1234.56' }]);
    api.getTransactions.mockResolvedValue([
      { id: 1, date: '2026-10-05', amount: '-90.00', category_name: 'Groceries', description: 'Fernhollow Grocers' },
      { id: 2, date: '2026-09-05', amount: '-100.00', category_name: 'Groceries', description: 'Fernhollow Grocers' },
    ]);
    renderAt('/dashboard', <Dashboard />);
    const recent = await screen.findByRole('heading', { name: 'Recent Transactions' });
    expect(recent).toBeInTheDocument();
    expect(await screen.findByTestId('insight-line')).toHaveTextContent('Groceries: £90 in October, 10% less than in September.');
    expect(within(recent.parentElement).getAllByText('Fernhollow Grocers')).toHaveLength(2);
  });
});
