import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

// The free hosting plan puts the API (and its database) to sleep when no
// one has used it for a while; the first request can then take up to a
// minute. The sign-in page calls this as it loads, so the server is
// usually awake by the time someone signs in.
//
// status:
//   'checking' — waking it; nothing shown yet (most of the time it's quick)
//   'slow'     — still waiting after 2 seconds: say what's happening
//   'ready'    — awake
//   'failed'   — no answer within 75 seconds: offer to try again

export const SLOW_AFTER_MS = 2000;
export const GIVE_UP_AFTER_MS = 75000;
// One attempt can hang while the host starts the server (and a proxy may
// give up on it), so each try is cut off and retried until the deadline.
export const ATTEMPT_TIMEOUT_MS = 20000;
export const RETRY_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Keeps calling /wake until it answers or the deadline passes.
export async function wakeUntilReady({ wake = api.wake, giveUpAfterMs = GIVE_UP_AFTER_MS } = {}) {
  const deadline = Date.now() + giveUpAfterMs;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now()));
    try {
      await wake(controller.signal);
      return true;
    } catch {
      // Not awake yet (timed out, a proxy error, or the server still starting).
    } finally {
      clearTimeout(timer);
    }
    if (Date.now() + RETRY_DELAY_MS >= deadline) break;
    await sleep(RETRY_DELAY_MS);
  }
  return false;
}

export default function useWakeServer() {
  const [status, setStatus] = useState('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => !cancelled && setStatus((s) => (s === 'checking' ? 'slow' : s)), SLOW_AFTER_MS);
    wakeUntilReady().then((ok) => {
      if (!cancelled) setStatus(ok ? 'ready' : 'failed');
    });
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus('checking');
    setAttempt((n) => n + 1);
  }, []);

  return { status, retry };
}
