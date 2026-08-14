import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import SpinningGem from '../components/SpinningGem';

// Basic shape check (has an @, something before it, a domain with a
// dot) plus a domain allowlist restricting to well-known consumer
// providers. Note: this also blocks real work/company emails, which is
// a real tradeoff for an app like this, but matches what was asked for.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DOMAINS = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
  'icloud.com', 'live.com', 'protonmail.com', 'aol.com', 'msn.com',
];

function getEmailError(rawEmail) {
  const value = rawEmail.trim();
  if (!EMAIL_SHAPE.test(value)) {
    return 'That doesn\'t look like a valid email address.';
  }
  const domain = value.split('@')[1]?.toLowerCase();
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return 'Please use an email from a recognized provider like Gmail or Outlook.';
  }
  return '';
}

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailWarning, setEmailWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendStatus, setResendStatus] = useState('idle'); // idle | sending | sent
  const navigate = useNavigate();

  function handleEmailBlur() {
    if (!email) {
      setEmailWarning('');
      return;
    }
    setEmailWarning(getEmailError(email));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setUnverified(false);

    const emailError = getEmailError(email);
    if (emailError) {
      setEmailWarning(emailError);
      return;
    }
    setEmailWarning('');

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
        width: 300, height: 420, border: '0.5px solid #3a4045', borderTop: '0.5px solid #6b7278',
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: 'var(--nav-bg)',
            border: '0.5px solid #454b50', borderTop: '0.5px solid #8a9096',
            margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SpinningGem size={26} variant="dark" />
          </div>
          <p className="font-mono" style={{ fontSize: 19, margin: 0 }}>
            <span style={{ fontWeight: 700 }}>Onyx</span>{' '}
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Vault</span>
          </p>
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '6px 0 0', letterSpacing: 1 }}>
            {mode === 'login' ? 'SIGN IN TO CONTINUE' : 'CREATE YOUR ACCOUNT'}
          </p>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
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
                <div style={{ position: 'relative' }}>
                  {emailWarning && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
                      background: '#2a1418', border: '0.5px solid var(--expense)', borderRadius: 6,
                      padding: '6px 10px', fontSize: 11, color: '#ff9a9a', zIndex: 5,
                    }}>
                      {emailWarning}
                    </div>
                  )}
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setUnverified(false); setResendStatus('idle'); if (emailWarning) setEmailWarning(''); }}
                    onBlur={handleEmailBlur}
                    required
                    className="font-mono"
                    style={{
                      ...inputStyle,
                      border: emailWarning ? '0.5px solid var(--expense)' : inputStyle.border,
                    }}
                  />
                </div>
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
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setUnverified(false); setEmailWarning(''); }}
                  style={{ color: '#7d3c98', cursor: 'pointer' }}
                >
                  {mode === 'login' ? 'Register' : 'Sign in'}
                </span>
              </p>
            </>
          )}
        </div>
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