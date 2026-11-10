// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CommandPalette from './CommandPalette';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    getAccounts: vi.fn(),
    getCategories: vi.fn(),
    getTransactions: vi.fn(),
    logout: vi.fn(),
  },
}));

function Where() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}{location.search}</p>;
}

function renderPalette() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <button type="button">Somewhere on the page</button>
      <CommandPalette />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>
  );
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getAccounts.mockResolvedValue([{ id: 3, name: 'Savings' }]);
  api.getCategories.mockResolvedValue([{ id: 7, name: 'Groceries' }]);
  api.getTransactions.mockResolvedValue([
    { id: 1, account_id: 3, description: 'Fernhollow Grocers', amount: '-42.10' },
    { id: 2, account_id: 3, description: 'Salary – Brambleworth Ltd', amount: '2100.00' },
  ]);
});

describe('CommandPalette', () => {
  it('is closed until Ctrl+K is pressed, then opens as a labelled modal dialog with focus in the search box', async () => {
    const user = renderPalette();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');

    const dialog = screen.getByRole('dialog', { name: 'Search and quick actions' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('also opens with Cmd+K (Mac) and from the header’s Search button event', async () => {
    const user = renderPalette();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    act(() => { window.dispatchEvent(new Event('open-command-palette')); });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('filters as you type and says when nothing matches', async () => {
    const user = renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'accounts');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Go to Accounts']);

    await user.clear(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('No matches.');
  });

  it('finds transactions by description and shows amounts as signed pounds', async () => {
    const user = renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(api.getTransactions).toHaveBeenCalled());
    await user.type(screen.getByRole('combobox'), 'fernhollow');

    const option = await screen.findByRole('option', { name: /Fernhollow Grocers/ });
    expect(option).toHaveTextContent('−£42.10');
  });

  it('moves the highlight with the arrow keys, announces it, and runs the highlighted command with Enter', async () => {
    const user = renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    const combobox = screen.getByRole('combobox');
    const options = screen.getAllByRole('option');

    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(combobox).toHaveAttribute('aria-activedescendant', options[0].id);

    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(combobox).toHaveAttribute('aria-activedescendant', options[1].id);

    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/transactions');
  });

  it('closes on Escape and returns focus to where it was', async () => {
    const user = renderPalette();
    const trigger = screen.getByRole('button', { name: 'Somewhere on the page' });
    trigger.focus();
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps keyboard focus inside the dialog', async () => {
    const user = renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.tab();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('works with a tap or click: choosing an option navigates, tapping outside closes', async () => {
    const user = renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    await user.pointer({ keys: '[TouchA]', target: screen.getByRole('option', { name: 'Go to Settings' }) });
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');

    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByTestId('command-palette-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still works with just the page commands when the data can’t be loaded (signed out)', async () => {
    api.getAccounts.mockRejectedValue(new Error('Not signed in'));
    const user = renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('option', { name: 'Go to Dashboard' })).toBeInTheDocument();
  });
});
