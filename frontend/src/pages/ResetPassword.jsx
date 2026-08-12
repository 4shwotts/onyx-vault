import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Missing reset token');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
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
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p className="font-mono" style={{ fontSize: 15, margin: 0 }}>Choose a new password</p>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {success ? (
            <>
              <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
                Your password has been updated.
              </p>
              <button onClick={() => navigate('/login')} className="font-mono" style={buttonStyle}>
                Go to sign in
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="font-mono"
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="font-mono"
                style={{ ...inputStyle, marginBottom: 18 }}
              />

              {error && (
                <p style={{ color: 'var(--expense)', fontSize: 13, marginBottom: 14 }}>{error}</p>
              )}

              <button type="submit" disabled={loading} className="font-mono" style={buttonStyle}>
                {loading ? 'Please wait...' : 'Update password'}
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