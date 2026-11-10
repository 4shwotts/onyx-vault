// @vitest-environment jsdom
// The demo entry points, the demo banner and the sign-up switch.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Login from './Login';
import DemoStart from './DemoStart';
import Nav from '../components/Nav';
import { SessionContext } from '../lib/session';
import { DEMO_NOTICE } from '../components/DemoBanner';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    getConfig: vi.fn(),
    wake: vi.fn(),
    startDemo: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    login: vi.fn(),
  },
}));

function Where() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}{location.search}</p>;
}

function renderAt(path, element, session) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path.split('?')[0]} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  return render(session ? <SessionContext.Provider value={session}>{tree}</SessionContext.Provider> : tree);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.wake.mockResolvedValue({ status: 'awake' });
});

describe('sign-up switch', () => {
  it('open: the sign-up form works as normal', async () => {
    api.getConfig.mockResolvedValue({ publicSignupEnabled: true });
    renderAt('/signup', <Login mode="signup" />);
    await waitFor(() => expect(api.getConfig).toHaveBeenCalled());
    expect(screen.getByLabelText('Email')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
    expect(screen.queryByText(/Sign-up is closed/)).toBeNull();
  });

  it('closed: the page keeps its design but the form is disabled and points to the demo', async () => {
    api.getConfig.mockResolvedValue({ publicSignupEnabled: false });
    renderAt('/signup', <Login mode="signup" />);

    const notice = await screen.findByText(/Sign-up is closed on the live site/);
    expect(notice).toHaveTextContent('Sign-up is closed on the live site. Try the demo instead');
    expect(screen.getByRole('link', { name: 'Try the demo instead' })).toHaveAttribute('href', '/demo');
    // Same card, same fields — just disabled.
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('the sign-in page never asks, and keeps working when sign-up is closed', () => {
    renderAt('/login', <Login mode="login" />);
    expect(api.getConfig).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toBeEnabled();
  });
});

describe('Try the demo', () => {
  it('is offered on both the sign-in and sign-up pages', async () => {
    api.getConfig.mockResolvedValue({ publicSignupEnabled: false });
    const { unmount } = renderAt('/login', <Login mode="login" />);
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
    unmount();
    renderAt('/signup', <Login mode="signup" />);
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
  });

  it('the sign-in page says when a demo has ended', () => {
    renderAt('/login?demoEnded=1', <Login mode="login" />);
    expect(screen.getByRole('status')).toHaveTextContent('Your demo has ended and all its data has been deleted.');
  });
});

describe('/demo', () => {
  afterEach(() => vi.useRealTimers());

  it('starts a demo once and opens the dashboard', async () => {
    api.startDemo.mockResolvedValue({ user: { id: 1, isDemo: true } });
    renderAt('/demo', <DemoStart />);
    expect(screen.getByRole('status')).toHaveTextContent('Setting up your demo…');
    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard');
    expect(api.startDemo).toHaveBeenCalledTimes(1);
  });

  it('explains a slow start (a sleeping server) after 2 seconds', async () => {
    vi.useFakeTimers();
    api.startDemo.mockReturnValue(new Promise(() => {}));
    renderAt('/demo', <DemoStart />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(screen.getByRole('status')).toHaveTextContent('Waking the server — this can take up to a minute');
  });

  it('gives up after 75 seconds with a friendly message and Try again', async () => {
    vi.useFakeTimers();
    api.startDemo.mockReturnValue(new Promise(() => {}));
    renderAt('/demo', <DemoStart />);
    await act(async () => { await vi.advanceTimersByTimeAsync(75100); });
    expect(screen.getByRole('alert')).toHaveTextContent('The server didn’t wake up in time');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says when the demo is busy, and Try again starts a new attempt', async () => {
    api.startDemo
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { status: 503 }))
      .mockResolvedValueOnce({ user: { id: 2, isDemo: true } });
    renderAt('/demo', <DemoStart />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The demo is busy right now. Please try again in a few minutes.');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/dashboard');
    expect(api.startDemo).toHaveBeenCalledTimes(2);
  });

  it('says when too many demos have been started from one connection', async () => {
    api.startDemo.mockRejectedValue(Object.assign(new Error('Too many'), { status: 429 }));
    renderAt('/demo', <DemoStart />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many demos have been started from your connection');
  });
});

describe('demo banner and End demo', () => {
  const demoSession = { user: { id: 5, email: null, isDemo: true, demoExpiresAt: '2026-11-11T12:00:00Z' } };

  it('shows the exact demo notice, linked to the disclaimer, on every signed-in page', () => {
    renderAt('/dashboard', <Nav />, demoSession);
    const banner = screen.getByRole('region', { name: 'Demo mode' });
    expect(DEMO_NOTICE).toBe('Demo mode: this account and its data are fake and reset after 24 hours. Not a real financial service.');
    expect(banner).toHaveTextContent(DEMO_NOTICE);
    expect(screen.getByRole('link', { name: 'Read the disclaimer' })).toHaveAttribute('href', '/disclaimer');
  });

  it('is not shown for a real account, which logs out as normal', () => {
    renderAt('/dashboard', <Nav />, { user: { id: 1, email: 'a@gmail.com', isDemo: false } });
    expect(screen.queryByRole('region', { name: 'Demo mode' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End demo' })).toBeNull();
  });

  it('End demo deletes the demo (via logout) and returns to sign-in with a message', async () => {
    api.logout.mockResolvedValue({ success: true });
    renderAt('/dashboard', <Nav />, demoSession);
    // Only the header offers it; the banner has no button of its own.
    expect(screen.getAllByRole('button', { name: 'End demo' })).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Demo mode' })).queryByRole('button')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'End demo' }));
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('location')).toHaveTextContent('/login?demoEnded=1');
  });
});
