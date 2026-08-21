import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import SpinningGem from '../components/SpinningGem';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'zoho.com', 'zohomail.com',
  'gmx.com', 'gmx.us',
  'mail.com',
  'yandex.com', 'yandex.ru',
  'fastmail.com', 'fastmail.fm',
  'tutanota.com', 'tuta.io',
];

function getEmailError(rawEmail) {
  const value = rawEmail.trim();
  if (!EMAIL_SHAPE.test(value)) {
    return 'That doesn\'t look like a valid email address.';
  }
  const domain = value.split('@')[1]?.toLowerCase();
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return 'Please use a verified email, such as Gmail.';
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
      setResendStatus('sent');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      position: 'relative', zIndex: 1,
    }}>
      <div className="chrome-surface" style={{
            borderRadius: 12, padding: '36px 32px',
            width: 300, height: 480,
            position: 'relative', zIndex: 1, boxSizing: 'border-box',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 28, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <SpinningGem size={64} variant="dark" />
          </div>
          <p className="font-mono" style={{ fontSize: 19, margin: 0 }}>
            <span style={{ fontWeight: 700, color: '#101112' }}>Onyx</span>{' '}
            <span style={{ fontWeight: 700, color: '#101112' }}>Vault</span>
          </p>
          <p className="font-mono" style={{ fontSize: 10, color: '#4a4a4a', margin: '6px 0 0', letterSpacing: 1 }}>
            {mode === 'login' ? 'SIGN IN TO CONTINUE' : 'CREATE YOUR ACCOUNT'}
          </p>
        </div>

        {registered ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 300, position: 'relative', zIndex: 1 }}>
            <p className="font-mono" style={{ fontSize: 13, color: '#4a4a4a', textAlign: 'center', marginBottom: 20 }}>
              Account created. Check your email for a verification link before signing in.
            </p>
            <button
              onClick={() => { setRegistered(false); setMode('login'); setEmail(''); setPassword(''); }}
              className="font-mono"
              style={buttonStyle}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1 }}>
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
                marginBottom: 4,
              }}
            />
            <div style={{ height: 30, marginBottom: 4 }}>
              {emailWarning && (
                <p style={{ color: 'var(--expense)', fontSize: 11, lineHeight: 1.35, margin: 0 }}>{emailWarning}</p>
              )}
            </div>

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="font-mono"
              style={{ ...inputStyle, marginBottom: 8 }}
            />

            <div style={{ height: 24, marginBottom: 10, textAlign: 'right' }}>
              <p className="font-mono" style={{
                fontSize: 12, margin: 0,
                opacity: mode === 'login' ? 1 : 0,
                pointerEvents: mode === 'login' ? 'auto' : 'none',
              }}>
                <Link to="/forgot-password" style={{ color: '#7d3c98' }}>Forgot password?</Link>
              </p>
            </div>

            <div style={{ minHeight: error ? 20 : 0, marginBottom: error ? 10 : 0 }}>
              {error && <p style={{ color: 'var(--expense)', fontSize: 13, margin: 0 }}>{error}</p>}
            </div>

            {unverified && (
              <div style={{ marginBottom: 10 }}>
                {resendStatus === 'sent' ? (
                  <p className="font-mono" style={{ fontSize: 12, color: '#4a4a4a', margin: 0 }}>
                    If that account exists and isn't verified, a new link has been sent.
                  </p>
                ) : (
                  <p className="font-mono" style={{ fontSize: 12, margin: 0 }}>
                    <span
                      onClick={resendStatus === 'sending' ? undefined : handleResend}
                      style={{ color: '#7d3c98', cursor: resendStatus === 'sending' ? 'default' : 'pointer' }}
                    >
                      {resendStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
                    </span>
                  </p>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="font-mono" style={buttonStyle}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>

            <p className="font-mono" style={{ textAlign: 'center', fontSize: 13, color: '#4a4a4a', marginTop: 18 }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setUnverified(false); setEmailWarning(''); }}
                style={{ color: '#7d3c98', cursor: 'pointer' }}
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#f5f6f7',
  border: '0.5px solid rgba(0,0,0,0.15)',
  borderRadius: 8,
  padding: '11px 12px',
  fontSize: 14,
  color: '#101112',
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