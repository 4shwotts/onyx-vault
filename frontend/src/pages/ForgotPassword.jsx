import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import AuthCard from '../components/AuthCard';
import { authInputStyle, authButtonStyle, authLinkStyle, authErrorStyle, authTextStyle } from '../components/authStyles';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(email);
      // The API answers the same whether or not the account exists, so
      // this is safe to show unconditionally.
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Reset your password" subtitle={submitted ? undefined : 'Enter your email and we’ll send you a reset link.'}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {submitted ? (
          <p role="status" className="font-mono" style={{ ...authTextStyle, textAlign: 'center' }}>
            If an account with that email exists, a password reset link has been sent.
          </p>
        ) : (
          <form onSubmit={handleSubmit} aria-label="Request a password reset link">
            <label htmlFor="forgot-email" className="visually-hidden">Email</label>
            <input id="forgot-email" type="email" autoComplete="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required className="font-mono" style={{ ...authInputStyle, marginBottom: 14 }} />
            {error && <p role="alert" style={{ ...authErrorStyle, margin: '0 0 12px' }}>{error}</p>}
            <button type="submit" disabled={loading} className="font-mono" style={authButtonStyle}>
              {loading ? 'Please wait…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
      <p className="font-mono" style={{ ...authTextStyle, textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
        <Link to="/login" style={authLinkStyle}>Back to sign in</Link>
      </p>
    </AuthCard>
  );
}
