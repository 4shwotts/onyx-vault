import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { api } from '../api/client';

const ACCOUNT_TYPES = ['checking', 'savings', 'credit'];

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
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
      await api.createAccount(name, type);
      setName('');
      setType('checking');
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
            <input type="text" placeholder="Account name (e.g. Checking)" value={name}
              onChange={(e) => setName(e.target.value)} required className="font-mono" style={inputStyle} />
            <select value={type} onChange={(e) => setType(e.target.value)} className="font-mono" style={selectStyle}>
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

            <div onClick={() => setShowForm(true)} style={linkCardStyle}>
              <span style={{ fontSize: 24, color: '#666' }}>+</span>
              <p className="font-mono" style={{ fontSize: 13, color: '#666', margin: 0, letterSpacing: 0.5, fontWeight: 600 }}>LINK ACCOUNT</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = { borderRadius: 14, padding: 26, minHeight: 150 };
const linkCardStyle = {
  background: '#141414', borderRadius: 14, padding: 26, border: '0.5px dashed #3a3a3a',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
  gap: 10, minHeight: 150, cursor: 'pointer',
};
const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid #333',
  borderRadius: 8, padding: '12px 14px', fontSize: 15, color: '#fff', marginBottom: 10,
};
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