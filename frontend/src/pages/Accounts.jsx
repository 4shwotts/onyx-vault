import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { api } from '../api/client';
import { AccountTypeIcon } from '../components/Icon';

const ACCOUNT_TYPES = ['current', 'savings', 'credit'];

// Names are generated from the type rather than typed by hand, e.g.
// "Current", or "Current 2" if the user already has one of that type,
// so the account name always matches what it actually is.
function getAutoName(type, existingAccounts) {
  const base = type.charAt(0).toUpperCase() + type.slice(1);
  const sameTypeCount = existingAccounts.filter((a) => a.type === type).length;
  return sameTypeCount === 0 ? base : `${base} ${sameTypeCount + 1}`;
}

// Realistic placeholder balances rather than £0.00, so the empty state
// reads as "here's a preview" instead of "here's a broken account."
// Matches the figures used on the Dashboard's empty state for consistency.
const GHOST_ACCOUNTS = [
  { label: 'Current', balance: 1240 },
  { label: 'Savings', balance: 3820 },
  { label: 'Credit', balance: -180 },
];

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('current');
  const [submitting, setSubmitting] = useState(false);

  async function loadAccounts() {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAccounts(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const autoName = getAutoName(type, accounts);
      await api.createAccount(autoName, type);
      setType('current');
      setShowForm(false);
      await loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(acc) {
    if (confirm(`Delete "${acc.name}"? This also deletes its transactions.`)) {
      await api.deleteAccount(acc.id);
      loadAccounts();
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 32px', position: 'relative', zIndex: 1 }}>
      <Nav />

      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <p className="font-mono" style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#000' }}>Accounts</p>
          <button onClick={() => setShowForm(!showForm)} className="font-mono" style={buttonStyle}>
            {showForm ? 'Cancel' : '+ Add account'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={formStyle}>
            <select value={type} onChange={(e) => setType(e.target.value)} className="font-mono" style={{ ...selectStyle, marginBottom: 14 }}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <button type="submit" disabled={submitting} className="font-mono" style={{ ...buttonStyle, width: '100%' }}>
              {submitting ? 'Creating...' : 'Create account'}
            </button>
          </form>
        )}

        {error && <p style={{ color: 'var(--expense)', fontSize: 14, marginBottom: 14 }}>{error}</p>}

        {loading ? (
          <p style={{ color: '#888', fontSize: 14 }}>Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18, filter: 'blur(3px)', opacity: 0.55, pointerEvents: 'none' }}>
              {GHOST_ACCOUNTS.map(({ label, balance }) => (
                <div key={label} className="chrome-surface" style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                    <p className="font-mono" style={{ fontSize: 13, color: '#1a1a1a', margin: 0, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>
                      {label}
                    </p>
                  </div>
                  <p className="font-mono" style={{ fontSize: 36, fontWeight: 700, margin: '0 0 10px', color: '#101112' }}>
                    £{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="font-mono" style={{ fontSize: 12, color: '#6b6b6b', margin: 0, fontWeight: 400, letterSpacing: 0.5 }}>•••• 0000</p>
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              <p className="font-mono" style={{
                fontSize: 13, margin: 0, padding: '9px 20px', borderRadius: 20,
                letterSpacing: 0.3, fontWeight: 600, color: '#2a2a2a',
                background: 'rgba(255,255,255,0.72)', border: '0.5px solid rgba(0,0,0,0.08)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.10)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              }}>
                No accounts yet — add one above.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
            {accounts.map((acc) => (
              <div key={acc.id} className="chrome-surface" style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                  <p className="font-mono" style={{ fontSize: 13, color: '#1a1a1a', margin: 0, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>
                    {acc.name}
                  </p>
                  <span onClick={() => handleDelete(acc)} style={{ cursor: 'pointer', color: '#1a1a1a', fontSize: 18, opacity: 0.6 }}>×</span>
                </div>
                <p className="font-mono" style={{ fontSize: 36, fontWeight: 700, margin: '0 0 10px', color: '#101112' }}>
                  £{Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="font-mono" style={{ fontSize: 12, color: '#6b6b6b', margin: 0, fontWeight: 400, letterSpacing: 0.5 }}>
                  •••• {String(acc.id).padStart(4, '0')}
                </p>
              </div>
            ))}
            
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = { borderRadius: 14, padding: 26, minHeight: 150 };

const selectStyle = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid #333',
  borderRadius: 8, padding: '12px 40px 12px 14px', fontSize: 15, color: '#fff', marginBottom: 10,
  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e5e5e5' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  backgroundSize: '13px',
};
const buttonStyle = {
  background: '#141414', color: '#fff', border: 'none', borderRadius: 8,
  padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const formStyle = { background: '#141414', borderRadius: 12, padding: 22, marginBottom: 22, maxWidth: 360 };