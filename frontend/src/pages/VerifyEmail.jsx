import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import AuthCard from '../components/AuthCard';
import { authInputStyle, authButtonStyle, authLinkStyle, authTextStyle } from '../components/authStyles';

// Opened from the link in the verification email.
//
// - The token is sent exactly once. (In development React runs effects
//   twice; sending it twice made the second request fail and showed
//   "Verification failed" right after a successful verification.)
// - The token is removed from the address bar straight away, so it isn't
//   left in browser history or passed on in a Referer header.
// - If the link is invalid or has expired, a new one can be requested
//   from the same page.
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token'));
  const sentRef = useRef(false);
  const [result, setResult] = useState(null); // { ok: true } | { ok: false, message }

  useEffect(() => {
    if (!token || sentRef.current) return;
    sentRef.current = true;
    window.history.replaceState(window.history.state, '', window.location.pathname);
    api.verifyEmail(token)
      .then(() => setResult({ ok: true }))
      .catch((err) => setResult({ ok: false, message: err.message }));
  }, [token]);

  const status = !token ? 'missing' : result === null ? 'verifying' : result.ok ? 'success' : 'failed';

  if (status === 'verifying') {
    return (
      <AuthCard title="Verifying your email">
        <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center' }}>Verifying your email…</p>
      </AuthCard>
    );
  }

  if (status === 'success') {
    return (
      <AuthCard title="Email verified">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: 20 }}>
          <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', margin: 0 }}>
            Your email address is verified. You can now sign in.
          </p>
          <Link to="/login" className="font-mono" style={{ ...authButtonStyle, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
            Go to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Verification failed">
      <p role="alert" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', marginTop: 0 }}>
        {status === 'missing' ? 'This link is missing its verification code.' : result.message}
      </p>
      <ResendForm />
      <p className="font-mono" style={{ ...authTextStyle, textAlign: 'center', marginBottom: 0 }}>
        <Link to="/login" style={authLinkStyle}>Back to sign in</Link>
      </p>
    </AuthCard>
  );
}

function ResendForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    try {
      await api.resendVerification(email);
    } finally {
      setState('sent');
    }
  }

  if (state === 'sent') {
    return (
      <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center' }}>
        If that account exists and isn’t verified yet, a new link has been sent.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Send a new verification link" style={{ marginTop: 8 }}>
      <label htmlFor="resend-email" className="font-mono" style={{ ...authTextStyle, display: 'block', fontSize: 12, marginBottom: 6 }}>
        Send a new link to:
      </label>
      <input id="resend-email" type="email" autoComplete="email" placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)} required className="font-mono" style={{ ...authInputStyle, marginBottom: 10 }} />
      <button type="submit" disabled={state === 'sending'} className="font-mono" style={authButtonStyle}>
        {state === 'sending' ? 'Sending…' : 'Send a new link'}
      </button>
    </form>
  );
}
