import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import AuthCard from '../components/AuthCard';
import { authInputStyle, authButtonStyle, authLinkStyle, authErrorStyle, authTextStyle } from '../components/authStyles';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  // Kept in memory and removed from the address bar, so the one-time
  // reset code isn't left in browser history.
  const tokenRef = useRef(searchParams.get('token'));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (tokenRef.current) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8 || password.length > 72) {
      setError('Choose a password between 8 and 72 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords don’t match.');
      return;
    }
    if (!tokenRef.current) {
      setError('This link is missing its reset code. Request a new link.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(tokenRef.current, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Choose a new password">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {success ? (
          <>
            <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center', marginTop: 0 }}>
              Your password has been updated, and any other signed-in sessions have been signed out.
            </p>
            <Link to="/login" className="font-mono" style={{ ...authButtonStyle, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
              Go to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate aria-label="Choose a new password">
            <label htmlFor="new-password" className="visually-hidden">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" placeholder="New password (8–72 characters)"
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              className="font-mono" style={{ ...authInputStyle, marginBottom: 10 }} />
            <label htmlFor="confirm-password" className="visually-hidden">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" placeholder="Confirm new password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8}
              className="font-mono" style={{ ...authInputStyle, marginBottom: 14 }} />
            {error && <p role="alert" style={{ ...authErrorStyle, margin: '0 0 12px' }}>{error}</p>}
            <button type="submit" disabled={loading} className="font-mono" style={authButtonStyle}>
              {loading ? 'Please wait…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
      <p className="font-mono" style={{ ...authTextStyle, textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
        <Link to="/forgot-password" style={authLinkStyle}>Request a new link</Link>
        {' · '}
        <Link to="/login" style={authLinkStyle}>Sign in</Link>
      </p>
    </AuthCard>
  );
}
