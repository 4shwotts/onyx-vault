import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

// Same mark as Nav.jsx, duplicated locally rather than imported from a
// shared file — both pages need it, but neither should break if the
// other's import path changes.
function OnyxMark({ size = 32, lineColor = '#101112', offsetColor = 'rgba(255,255,255,0.6)' }) {
  const gemPath = 'M12 3 L22 9 L12 21 L2 9 Z';
  const facetLine = 'M2 9 L22 9';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <g transform="translate(0.6,0.8)">
        <path d={gemPath} stroke={offsetColor} strokeWidth="2" strokeLinejoin="round" />
        <path d={facetLine} stroke={offsetColor} strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <path d={gemPath} stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
      <path d={facetLine} stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendStatus, setResendStatus] = useState('idle'); // idle | sending | sent
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setLoading(true);

    try {
      if (mode === 'register') {
        await api.register(email, password);
        // No cookie is set on register anymore, accounts are inactive
        // until the verification link is clicked, so there's nothing
        // to navigate to yet, show the "check your email" message instead.
        setRegistered(true);
      } else {
        await api.login(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      if (err.message === 'Please verify your email before logging in') {
        setUnverified(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendStatus('sending');
    try {
      await api.resendVerification(email);
      setResendStatus('sent');
    } catch {
      // Backend always returns a generic success message, so this
      // branch shouldn't normally fire, but fall back gracefully if it does.
      setResendStatus('sent');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        background: 'rgba(11,13,15,0.92)', borderRadius: 12, padding: '36px 32px',
        width: 300, border: '0.5px solid #3a4045', borderTop: '0.5px solid #6b7278',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: 'var(--nav-bg)',
            border: '0.5px solid #454b50', borderTop: '0.5px solid #8a9096',
            margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <OnyxMark size={26} lineColor="#eef1f3" offsetColor="rgba(0,0,0,0.5)" />
          </div>
          <p className="font-mono" style={{ fontSize: 19, margin: 0 }}>
            <span style={{ fontWeight: 700 }}>Onyx</span>{' '}
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Vault</span>
          </p>
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0', letterSpacing: 1 }}>
            {mode === 'login' ? 'SIGN IN TO CONTINUE' : 'CREATE YOUR ACCOUNT'}
          </p>
        </div>

        {registered ? (
          <>
            <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
              Account created. Check your email for a verification link before signing in.
            </p>
            <button
              onClick={() => { setRegistered(false); setMode('login'); setEmail(''); setPassword(''); }}
              className="font-mono"
              style={buttonStyle}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setUnverified(false); setResendStatus('idle'); }}
                required
                className="font-mono"
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="font-mono"
                style={{ ...inputStyle, marginBottom: mode === 'login' ? 8 : 18 }}
              />

              {mode === 'login' && (
                <p className="font-mono" style={{ textAlign: 'right', fontSize: 12, marginBottom: 18 }}>
                  <Link to="/forgot-password" style={{ color: '#7d3c98' }}>Forgot password?</Link>
                </p>
              )}

              {error && (
                <p style={{ color: 'var(--expense)', fontSize: 13, marginBottom: unverified ? 8 : 14 }}>{error}</p>
              )}

              {unverified && (
                resendStatus === 'sent' ? (
                  <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                    If that account exists and isn't verified, a new link has been sent.
                  </p>
                ) : (
                  <p className="font-mono" style={{ fontSize: 12, marginBottom: 14 }}>
                    <span
                      onClick={resendStatus === 'sending' ? undefined : handleResend}
                      style={{ color: '#7d3c98', cursor: resendStatus === 'sending' ? 'default' : 'pointer' }}
                    >
                      {resendStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
                    </span>
                  </p>
                )
              )}

              <button type="submit" disabled={loading} className="font-mono" style={buttonStyle}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="font-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 18 }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setUnverified(false); }}
                style={{ color: '#7d3c98', cursor: 'pointer' }}
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#15181a',
  border: '0.5px solid #2e3336',
  borderRadius: 8,
  padding: '11px 12px',
  fontSize: 14,
  color: 'var(--text-primary)',
  marginBottom: 10,
};

const buttonStyle = {
  width: '100%',
  background: 'var(--accent)',
  color: 'var(--accent-text)',
  border: 'none',
  borderRadius: 8,
  padding: 12,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};