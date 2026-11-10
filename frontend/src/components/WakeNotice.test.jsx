// @vitest-environment jsdom
// Waking the sleeping server: nothing for 2 seconds, then an explanation,
// and after 75 seconds a friendly error with Retry.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import WakeNotice from './WakeNotice';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { wake: vi.fn() } }));

// A /wake request that never answers until it is cut off.
const hangs = (signal) => new Promise((_resolve, reject) => {
  signal.addEventListener('abort', () => reject(new Error('aborted')));
});
// One that answers after `ms`.
const answersAfter = (ms) => () => new Promise((resolve) => setTimeout(() => resolve({ status: 'awake' }), ms));

const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('WakeNotice', () => {
  it('shows nothing at all when the server answers quickly', async () => {
    api.wake.mockImplementation(answersAfter(300));
    const { container } = render(<WakeNotice />);
    await advance(5000);
    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing for the first 2 seconds, then explains the wait', async () => {
    api.wake.mockImplementation(hangs);
    render(<WakeNotice />);
    await advance(1900);
    expect(screen.queryByRole('status')).toBeNull();
    await advance(200);
    expect(screen.getByRole('status')).toHaveTextContent('Waking the server — this can take up to a minute');
  });

  it('the message goes away once the server is awake', async () => {
    api.wake.mockImplementation(answersAfter(10000));
    render(<WakeNotice />);
    await advance(3000);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await advance(8000);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps trying while a request hangs, and succeeds if the server wakes within 75 seconds', async () => {
    let calls = 0;
    api.wake.mockImplementation((signal) => {
      calls += 1;
      return calls < 3 ? hangs(signal) : Promise.resolve({ status: 'awake' });
    });
    render(<WakeNotice />);
    await advance(50000); // two 20-second attempts and their pauses
    expect(api.wake).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('after 75 seconds without an answer, shows a friendly error with Retry', async () => {
    api.wake.mockImplementation(hangs);
    render(<WakeNotice />);
    await advance(74000);
    expect(screen.queryByRole('alert')).toBeNull();
    await advance(1500);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The server didn’t wake up in time. It may be busy — please try again.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('Retry starts again: quiet for 2 seconds, then the message, and recovers when the server answers', async () => {
    api.wake.mockImplementation(hangs);
    render(<WakeNotice />);
    await advance(76000);
    const callsBefore = api.wake.mock.calls.length;

    api.wake.mockImplementation(answersAfter(4000));
    await act(async () => { screen.getByRole('button', { name: 'Retry' }).click(); });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.wake.mock.calls.length).toBe(callsBefore + 1);
    await advance(2100);
    expect(screen.getByRole('status')).toHaveTextContent('Waking the server');
    await advance(2000);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('treats an error response (e.g. the proxy timing out) as "not awake yet" and tries again', async () => {
    let calls = 0;
    api.wake.mockImplementation(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(Object.assign(new Error('Gateway timeout'), { status: 504 })) : Promise.resolve({});
    });
    render(<WakeNotice />);
    await advance(2500);
    expect(api.wake).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
