import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

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
      // Backend always returns the same generic message whether or not
      // the account exists, so this is safe to show unconditionally.
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        width: 300, minHeight: 300, border: '0.5px solid #3a4045', borderTop: '0.5px solid #6b7278',
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
      }}>
        {!submitted && (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p className="font-mono" style={{ fontSize: 15, margin: 0 }}>Reset your password</p>
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
              Enter your email and we'll send you a reset link
            </p>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {submitted ? (
            <p className="font-mono" style={{ fontSize: 16, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
              If an account with that email exists, a password reset link has been sent.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="font-mono"
                style={{ ...inputStyle, marginBottom: 18 }}
              />

              {error && (
                <p style={{ color: 'var(--expense)', fontSize: 13, marginBottom: 14 }}>{error}</p>
              )}

              <button type="submit" disabled={loading} className="font-mono" style={buttonStyle}>
                {loading ? 'Please wait...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <p className="font-mono" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 18 }}>
          <Link to="/login" style={{ color: '#7d3c98' }}>Back to sign in</Link>
        </p>
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