import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import AuthCard from '../components/AuthCard';
import { authButtonStyle, authLinkStyle, authTextStyle } from '../components/authStyles';
import { SLOW_AFTER_MS, GIVE_UP_AFTER_MS } from '../hooks/useWakeServer';

// /demo — and where "Try the demo" leads. Starts a fresh throwaway account
// (no email, no password), fills it with made-up data and opens the
// dashboard. The server may be asleep, so a slow start is explained, and
// every failure offers a way to try again.
export default function DemoStart() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'starting' }); // starting | slow | failed
  const [attempt, setAttempt] = useState(0);
  const startedFor = useRef(-1);

  const start = useCallback(async (signal) => {
    try {
      await api.startDemo();
      if (!signal.cancelled) navigate('/dashboard', { replace: true });
    } catch (err) {
      if (signal.cancelled) return;
      let message = 'The demo couldn’t be started. Please try again.';
      if (err.status === 503) message = 'The demo is busy right now. Please try again in a few minutes.';
      else if (err.status === 429) message = 'Too many demos have been started from your connection. Please try again later.';
      else if (err.message === 'timeout') message = 'The server didn’t wake up in time. It may be busy — please try again.';
      setState({ status: 'failed', message });
    }
  }, [navigate]);

  useEffect(() => {
    // Start once per attempt (React runs effects twice in development).
    if (startedFor.current === attempt) return undefined;
    startedFor.current = attempt;
    const signal = { cancelled: false };
    const slow = setTimeout(() => setState((s) => (s.status === 'starting' ? { status: 'slow' } : s)), SLOW_AFTER_MS);
    const giveUp = setTimeout(() => {
      signal.cancelled = true;
      setState({ status: 'failed', message: 'The server didn’t wake up in time. It may be busy — please try again.' });
    }, GIVE_UP_AFTER_MS);
    start(signal).finally(() => {
      clearTimeout(slow);
      clearTimeout(giveUp);
    });
    return undefined;
  }, [attempt, start]);

  function retry() {
    setState({ status: 'starting' });
    setAttempt((n) => n + 1);
  }

  return (
    <AuthCard title="Try the demo" subtitle="A throwaway account full of made-up data. No email or password needed.">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
        {state.status === 'failed' ? (
          <>
            <p role="alert" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', margin: 0 }}>{state.message}</p>
            <button type="button" onClick={retry} className="font-mono" style={authButtonStyle}>Try again</button>
          </>
        ) : (
          <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', margin: 0 }}>
            {state.status === 'slow' ? 'Waking the server — this can take up to a minute' : 'Setting up your demo…'}
          </p>
        )}
        <p className="font-mono" style={{ ...authTextStyle, fontSize: 11, textAlign: 'center', margin: 0 }}>
          Demo data is fake and is deleted after 24 hours, or as soon as you end the demo.
        </p>
      </div>
      <p className="font-mono" style={{ ...authTextStyle, textAlign: 'center', marginBottom: 0 }}>
        <Link to="/login" style={authLinkStyle}>Back to sign in</Link>
      </p>
    </AuthCard>
  );
}
