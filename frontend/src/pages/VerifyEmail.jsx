import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function VerifyEmail() {
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setError('Missing verification token');
      return;
    }

    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(err.message);
      });
  }, [searchParams]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        background: 'rgba(11,13,15,0.92)', borderRadius: 12, padding: '36px 32px',
        width: 300, minHeight: 300, border: '0.5px solid #3a4045', borderTop: '0.5px solid #6b7278',
        position: 'relative', zIndex: 1, textAlign: 'center',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {status === 'verifying' && (
          <p className="font-mono" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Verifying your email...
          </p>
        )}

        {status === 'success' && (
          <>
            <p className="font-mono" style={{ fontSize: 15, marginBottom: 16 }}>
              Email verified
            </p>
            <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              You can now sign in to your account.
            </p>
            <button onClick={() => navigate('/login')} className="font-mono" style={buttonStyle}>
              Go to sign in
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="font-mono" style={{ fontSize: 15, color: 'var(--expense)', marginBottom: 12 }}>
              Verification failed
            </p>
            <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {error}
            </p>
            <Link to="/login" className="font-mono" style={{ fontSize: 13, color: '#7d3c98' }}>
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

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