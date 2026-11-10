// @vitest-environment jsdom
// The privacy notice and disclaimer: readable without signing in, saying
// everything they must, and linked from the places they must be.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Privacy, { CONTACT_EMAIL } from './Privacy';
import Disclaimer from './Disclaimer';
import Login from './Login';
import Settings from './Settings';
import { SessionContext } from '../lib/session';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { getConfig: vi.fn(), wake: vi.fn(), runRecurringNow: vi.fn() },
}));

beforeEach(() => {
  api.getConfig.mockResolvedValue({ publicSignupEnabled: true });
  api.wake.mockResolvedValue({ status: 'awake' });
});

const renderPage = (element, path = '/') => render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
const text = () => document.body.textContent.replace(/\s+/g, ' ');

describe('disclaimer', () => {
  it('renders without a session', () => {
    renderPage(<Disclaimer />);
    expect(screen.getByRole('heading', { level: 1, name: 'Disclaimer' })).toBeInTheDocument();
  });

  it.each([
    ['a portfolio project, not a real financial service', /portfolio project, not a real financial service/],
    ['not connected to any bank', /isn’t connected to any bank/],
    ['not regulated by the FCA', /isn’t (authorised or )?regulated by the Financial Conduct Authority \(FCA\)/],
    ['not financial advice', /Nothing in Onyx Vault is financial advice/],
    ['users shouldn’t enter real financial details', /don’t enter real financial details/],
    ['provided as-is, with no guarantees', /provided “as is”, with no guarantees/],
    ['data may be reset or deleted', /Data may be reset or deleted/],
    ['it doesn’t move or hold money', /doesn’t move, hold or look after money/],
  ])('says clearly: %s', (_label, pattern) => {
    renderPage(<Disclaimer />);
    expect(text()).toMatch(pattern);
  });

  it('links to the privacy notice and the demo', () => {
    renderPage(<Disclaimer />);
    expect(screen.getByRole('link', { name: 'privacy notice' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'try the demo' })).toHaveAttribute('href', '/demo');
  });
});

describe('privacy notice', () => {
  it('renders without a session', () => {
    renderPage(<Privacy />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument();
  });

  it.each([
    ['who to contact', new RegExp(CONTACT_EMAIL.replace('.', '\\.'))],
    ['the data stored', /email address, your password \(stored only as a one-way bcrypt hash/],
    ['why (lawful basis)', /lawful basis is contract/],
    ['IP handling', /kept only in the server’s memory, for up to one hour, and are never saved to the database/],
    ['strictly necessary cookies only, so no banner', /one cookie.*token.*strictly necessary.*no consent banner is needed/],
    ['no analytics or tracking', /no analytics, advertising or tracking cookies/],
    ['the providers', /Vercel.*Render.*Neon.*Brevo/],
    ['data possibly stored outside the UK', /may process data outside the UK/],
    ['the database region', /Neon hosts the database, in its London \(UK\) region/],
    ['demo retention', /Demo accounts: 24 hours, or until you choose “End demo”/],
    ['real accounts kept until deleted', /Your account and everything in it: until you delete the account/],
    ['how to delete an account', /open Settings and use Delete your account/],
    ['the user’s rights', /copy of your personal data.*corrected.*deleted.*restrict or object.*portable/],
    ['how to complain (ICO)', /Information Commissioner’s Office \(ICO\)/],
    ['not to enter real financial details', /Please don’t enter real financial details/],
  ])('covers %s', (_label, pattern) => {
    renderPage(<Privacy />);
    expect(text()).toMatch(pattern);
  });

  it('links the contact email', () => {
    renderPage(<Privacy />);
    expect(screen.getAllByRole('link', { name: CONTACT_EMAIL })[0]).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
  });
});

describe('where they are linked from', () => {
  it('the sign-in page links to both', () => {
    renderPage(<Login mode="login" />, '/login');
    const legal = screen.getByRole('navigation', { name: 'Legal' });
    expect(within(legal).getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy');
    expect(within(legal).getByRole('link', { name: 'Disclaimer' })).toHaveAttribute('href', '/disclaimer');
  });

  it('the sign-up page links to both and shows the short disclaimer', () => {
    renderPage(<Login mode="signup" />, '/signup');
    expect(within(screen.getByRole('navigation', { name: 'Legal' })).getAllByRole('link')).toHaveLength(2);
    const short = screen.getByTestId('short-disclaimer');
    expect(short).toHaveTextContent('Onyx Vault is a portfolio project, not a real financial service. It isn’t connected to any bank, isn’t regulated by the FCA and isn’t financial advice. Please don’t enter real financial details.');
    expect(within(short).getByRole('link', { name: 'Read the disclaimer' })).toHaveAttribute('href', '/disclaimer');
  });

  it('settings links to both', () => {
    render(
      <SessionContext.Provider value={{ user: { id: 1, email: 'a@gmail.com', isDemo: false } }}>
        <MemoryRouter initialEntries={['/settings']}><Settings /></MemoryRouter>
      </SessionContext.Provider>
    );
    const section = screen.getByRole('region', { name: 'Privacy and disclaimer' });
    expect(within(section).getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy');
    expect(within(section).getByRole('link', { name: 'Disclaimer' })).toHaveAttribute('href', '/disclaimer');
  });
});
