import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import { api } from '../api/client';
import useIsMobile from '../hooks/useIsMobile';
import { useSession } from '../lib/session';
import { Link } from 'react-router-dom';

function formatEndTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export default function Settings() {
  const isMobile = useIsMobile();
  const { user } = useSession();
  const isDemo = Boolean(user?.isDemo);

  return (
    <div style={{ minHeight: '100vh', padding: isMobile ? 16 : '24px 32px', position: 'relative', zIndex: 1 }}>
      <Nav />
      <main className="page-container" style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 className="font-mono" style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: '0 0 22px', color: '#000' }}>Settings</h1>

        <section aria-labelledby="account-heading" className="dark-surface" style={panelStyle}>
          <div style={innerStyle}>
            <h2 id="account-heading" className="font-mono" style={headingStyle}>Your account</h2>
            {isDemo ? (
              <p className="font-mono" style={textStyle}>
                You’re using the demo: a throwaway account with made-up data, no email address and no password.
                It ends automatically on <strong style={{ color: '#fff' }}>{formatEndTime(user.demoExpiresAt)}</strong>,
                or straight away when you choose <strong style={{ color: '#fff' }}>End demo</strong>. Either way, everything in it is deleted.
              </p>
            ) : (
              <p className="font-mono" style={textStyle}>
                Signed in as <strong style={{ color: '#fff', overflowWrap: 'anywhere' }}>{user?.email || '…'}</strong>
              </p>
            )}
          </div>
        </section>

        <RecurringSection />

        <section aria-labelledby="legal-heading" className="dark-surface" style={panelStyle}>
          <div style={innerStyle}>
            <h2 id="legal-heading" className="font-mono" style={headingStyle}>Privacy and disclaimer</h2>
            <p className="font-mono" style={textStyle}>
              Onyx Vault is a portfolio project, not a real financial service. Read how your data is handled and what the app is (and isn’t).
            </p>
            <p className="font-mono" style={{ ...textStyle, marginBottom: 0, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Link to="/privacy" style={settingsLinkStyle}>Privacy notice</Link>
              <Link to="/disclaimer" style={settingsLinkStyle}>Disclaimer</Link>
            </p>
          </div>
        </section>
        {!isDemo && <DeleteAccountSection />}
      </main>
    </div>
  );
}

function RecurringSection() {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [message, setMessage] = useState('');

  async function runNow() {
    setStatus('running');
    try {
      const { processed } = await api.runRecurringNow();
      setStatus('done');
      setMessage(processed === 0
        ? 'Nothing was due — your recurring payments are up to date.'
        : `${processed} recurring payment${processed === 1 ? '' : 's'} added.`);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  return (
    <section aria-labelledby="recurring-settings-heading" className="dark-surface" style={panelStyle}>
      <div style={innerStyle}>
        <h2 id="recurring-settings-heading" className="font-mono" style={headingStyle}>Recurring payments</h2>
        <p className="font-mono" style={textStyle}>
          Payments that are due are added automatically, including any that fell due while the server was asleep.
          You can also add anything that’s due straight away.
        </p>
        <button type="button" onClick={runNow} disabled={status === 'running'} className="font-mono" style={buttonStyle}>
          {status === 'running' ? 'Checking…' : 'Add due payments now'}
        </button>
        {message && (
          <p role={status === 'error' ? 'alert' : 'status'} className="font-mono" style={{ ...textStyle, marginTop: 12, marginBottom: 0, color: status === 'error' ? '#ff8a8a' : '#cfe9da' }}>
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

function DeleteAccountSection() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e) {
    e.preventDefault();
    setError('');
    if (!understood) {
      setError('Tick the box to confirm you understand this can’t be undone.');
      return;
    }
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await api.deleteMyAccount(password);
      navigate('/login?deleted=1', { replace: true });
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="delete-heading" className="dark-surface" style={{ ...panelStyle, border: '1px solid #6b2323' }}>
      <form onSubmit={handleDelete} noValidate style={innerStyle}>
        <h2 id="delete-heading" className="font-mono" style={headingStyle}>Delete your account</h2>
        <p className="font-mono" style={textStyle}>
          This permanently deletes your account and everything in it: accounts, transactions, categories and recurring payments.
          It can’t be undone.
        </p>
        <label htmlFor="delete-password" className="font-mono" style={{ ...textStyle, display: 'block', marginBottom: 6 }}>Your password</label>
        <input id="delete-password" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} className="font-mono" style={inputStyle} />
        <label className="font-mono" style={{ ...textStyle, display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12 }}>
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} style={{ marginTop: 3 }} />
          I understand my account and all its data will be deleted permanently.
        </label>
        {error && <p role="alert" className="font-mono" style={{ ...textStyle, color: '#ff8a8a' }}>{error}</p>}
        <button type="submit" disabled={deleting} className="font-mono" style={{ ...buttonStyle, background: '#7a1f1f' }}>
          {deleting ? 'Deleting…' : 'Delete my account permanently'}
        </button>
      </form>
    </section>
  );
}

const settingsLinkStyle = { color: '#e6c8f5', fontWeight: 700 };
const panelStyle = { borderRadius: 14, marginBottom: 18 };
const innerStyle = { position: 'relative', zIndex: 1, padding: 22 };
const headingStyle = { fontSize: 15, color: '#fff', margin: '0 0 10px', fontWeight: 700 };
const textStyle = { fontSize: 13, color: '#d0d0d0', lineHeight: 1.6, margin: '0 0 14px' };
const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid #555',
  borderRadius: 8, padding: '11px 12px', fontSize: 14, color: '#fff',
};
const buttonStyle = {
  background: '#2a2f33', color: '#fff', border: 'none', borderRadius: 8,
  padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
