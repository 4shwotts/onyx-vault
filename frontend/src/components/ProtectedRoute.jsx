import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { SessionContext } from '../lib/session';

// Gatekeeps every private page. On mount, asks the backend "am I still
// signed in?" (api.me() succeeds only while the session exists and hasn't
// expired). Renders nothing meaningful until that check resolves, so a
// signed-out visitor never sees a flash of protected content. The user it
// returns (including whether this is a demo) is shared with the page.
export default function ProtectedRoute({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null }); // checking | authed | unauthed

  useEffect(() => {
    let cancelled = false;
    api.me()
      .then(({ user }) => !cancelled && setState({ status: 'authed', user }))
      .catch(() => !cancelled && setState({ status: 'unauthed', user: null }));
    return () => { cancelled = true; };
  }, []);

  if (state.status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <p role="status" style={{ color: '#333', fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  if (state.status === 'unauthed') {
    return <Navigate to="/login" replace />;
  }

  return <SessionContext.Provider value={{ user: state.user }}>{children}</SessionContext.Provider>;
}
