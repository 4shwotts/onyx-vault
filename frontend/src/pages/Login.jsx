import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { getEmailError } from '../lib/emailRules';
import AuthCard from '../components/AuthCard';
import WakeNotice from '../components/WakeNotice';
import { ShortDisclaimer } from '../components/LegalLinks';
import { authInputStyle, authButtonStyle, authLinkStyle, authErrorStyle, authTextStyle } from '../components/authStyles';

// Sign in (/login) and sign up (/signup) share one card. The mode comes
// from the route, so each has its own address that can be linked to.
export default function Login({ mode = 'login' }) {
  const isSignUp = mode === 'signup';
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailWarning, setEmailWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendStatus, setResendStatus] = useState('idle'); // idle | sending | sent
  const [honeypot, setHoneypot] = useState('');
  const [formRenderedAt] = useState(() => Date.now());
  // null until known; only the sign-up page asks.
  const [signupOpen, setSignupOpen] = useState(null);
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const accountDeleted = query.get('deleted') === '1';
  const demoEnded = query.get('demoEnded') === '1';
  const signupClosed = isSignUp && signupOpen === false;

  // On the live site, public sign-up is switched off: the page keeps its
  // full design but the form is disabled and points to the demo instead.
  useEffect(() => {
    if (!isSignUp) return undefined;
    let cancelled = false;
    api.getConfig()
      .then((config) => !cancelled && setSignupOpen(config.publicSignupEnabled !== false))
      .catch(() => !cancelled && setSignupOpen(true)); // the server still refuses if it's closed
    return () => { cancelled = true; };
  }, [isSignUp]);

  function handleEmailBlur() {
    setEmailWarning(email ? getEmailError(email) : '');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (signupClosed) return;
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
      if (isSignUp) {
        await api.register(email, password, honeypot, formRenderedAt);
        setRegistered(true);
      } else {
        await api.login(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      if (err.status === 403 && !isSignUp) setUnverified(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendStatus('sending');
    try {
      await api.resendVerification(email);
    } finally {
      setResendStatus('sent');
    }
  }

  if (registered) {
    return (
      <AuthCard title="Check your email">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: 20 }}>
          <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', margin: 0 }}>
            Account created. Check your email for a verification link before signing in.
          </p>
          <Link to="/login" className="font-mono" style={{ ...authButtonStyle, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={isSignUp ? 'Create your account' : 'Sign in to continue'} footer={<WakeNotice />}>
      {accountDeleted && !isSignUp && (
        <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', margin: '0 0 12px' }}>
          Your account and all its data have been deleted.
        </p>
      )}
      {demoEnded && !isSignUp && (
        <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', margin: '0 0 12px' }}>
          Your demo has ended and all its data has been deleted.
        </p>
      )}
      {signupClosed && (
        <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', margin: '0 0 14px', fontWeight: 700 }}>
          Sign-up is closed on the live site.{' '}
          <Link to="/demo" style={authLinkStyle}>Try the demo instead</Link>
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate aria-label={isSignUp ? 'Sign up' : 'Sign in'}>
        <fieldset disabled={signupClosed} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: signupClosed ? 0.6 : 1 }}>
        {/* Honeypot: hidden from people and assistive technology, but many
            form-filling bots fill in every field they find. */}
        {isSignUp && (
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="website">Website</label>
            <input id="website" type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
          </div>
        )}

        <label htmlFor="email" className="visually-hidden">Email</label>
        <input
          id="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setUnverified(false); setResendStatus('idle'); if (emailWarning) setEmailWarning(''); }}
          onBlur={handleEmailBlur}
          required
          aria-invalid={emailWarning ? 'true' : undefined}
          aria-describedby={emailWarning ? 'email-error' : undefined}
          className="font-mono"
          style={{ ...authInputStyle, border: emailWarning ? '1px solid #8f1d1d' : authInputStyle.border }}
        />
        <div style={{ minHeight: 30, marginBottom: 4 }}>
          {emailWarning && <p id="email-error" style={authErrorStyle}>{emailWarning}</p>}
        </div>

        <label htmlFor="password" className="visually-hidden">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          aria-describedby={isSignUp ? 'password-hint' : undefined}
          className="font-mono"
          style={{ ...authInputStyle, marginBottom: 6 }}
        />
        {isSignUp && <p id="password-hint" className="font-mono" style={{ ...authTextStyle, fontSize: 11, margin: '0 0 8px' }}>8 to 72 characters.</p>}

        {!isSignUp && (
          <p className="font-mono" style={{ fontSize: 12, margin: '6px 0 12px', textAlign: 'right' }}>
            <Link to="/forgot-password" style={authLinkStyle}>Forgot password?</Link>
          </p>
        )}

        {error && <p role="alert" style={{ ...authErrorStyle, fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

        {unverified && (
          <div style={{ marginBottom: 10 }}>
            {resendStatus === 'sent' ? (
              <p role="status" className="font-mono" style={{ ...authTextStyle, fontSize: 12, margin: 0 }}>
                If that account exists and isn’t verified, a new link has been sent.
              </p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resendStatus === 'sending'} className="link-button font-mono" style={{ ...authLinkStyle, fontSize: 12 }}>
                {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} className="font-mono" style={authButtonStyle}>
          {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
        </button>
        </fieldset>

        {/* The demo needs no email or password: a throwaway account full of
            made-up data, deleted after 24 hours. */}
        <Link to="/demo" className="font-mono" style={demoButtonStyle}>
          Try the demo
        </Link>

        <p className="font-mono" style={{ ...authTextStyle, textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
          {isSignUp ? 'Already have an account? ' : 'Don’t have an account? '}
          <Link to={isSignUp ? '/login' : '/signup'} style={authLinkStyle}>
            {isSignUp ? 'Sign in' : 'Sign up'}
          </Link>
        </p>
        {isSignUp && <ShortDisclaimer />}
      </form>
    </AuthCard>
  );
}

const demoButtonStyle = {
  display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 10, padding: 11, borderRadius: 8,
  textAlign: 'center', textDecoration: 'none', fontSize: 14, fontWeight: 600,
  color: '#101112', background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.3)',
};
