import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';

// Gatekeeps every private page. On mount, asks the backend "am I still
// logged in?" (api.me() succeeds only if the httpOnly cookie holds a
// valid, unexpired JWT). Renders nothing meaningful until that check
// resolves, so a logged-out user never sees a flash of protected content.
export default function ProtectedRoute({ children }) {
  // Three explicit states rather than a boolean, since "checking" is
  // genuinely a distinct render (a loading screen) from "unauthed"
  // (a redirect) — collapsing this into isLoggedIn/isLoading pairs
  // would need two booleans to express the same three states.
  const [status, setStatus] = useState('checking'); // 'checking' | 'authed' | 'unauthed'

  useEffect(() => {
    api.me()
      .then(() => setStatus('authed'))
      .catch(() => setStatus('unauthed'));
  }, []);

  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading...</p>
      </div>
    );
  }

  if (status === 'unauthed') {
    return <Navigate to="/login" replace />;
  }

  return children;
}