import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Nav from '../components/Nav';
import EmptyOverlay, { PlaceholderContent } from '../components/EmptyOverlay';
import { api } from '../api/client';
import { AccountTypeIcon } from '../components/Icon';
import { toPence, formatGBP } from '../utils/money';
import useIsMobile from '../hooks/useIsMobile';

const ACCOUNT_TYPES = ['current', 'savings', 'credit'];

// Names are generated from the type rather than typed by hand, e.g.
// "Current", or "Current 2" if the user already has one of that type,
// so the account name always matches what it actually is.
function getAutoName(type, existingAccounts) {
  const base = type.charAt(0).toUpperCase() + type.slice(1);
  const sameTypeCount = existingAccounts.filter((a) => a.type === type).length;
  return sameTypeCount === 0 ? base : `${base} ${sameTypeCount + 1}`;
}

// "Account 01", "Account 02"… — a simple position label, deliberately not
// styled like a card or account number.
function accountLabel(index) {
  return `Account ${String(index + 1).padStart(2, '0')}`;
}

// Realistic placeholder balances rather than £0.00, so the empty state
// reads as "here's a preview" instead of "here's a broken account".
// Matches the figures used on the Dashboard's empty state.
const GHOST_ACCOUNTS = [
  { label: 'Current', type: 'current', balance: '1240.00' },
  { label: 'Savings', type: 'savings', balance: '3820.00' },
  { label: 'Credit', type: 'credit', balance: '-180.00' },
];

export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState(null); // null while loading
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState('current');
  const [submitting, setSubmitting] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const isMobile = useIsMobile();
  const showForm = formOpen || searchParams.get('new') === '1';

  useEffect(() => {
    let cancelled = false;
    api.getAccounts()
      .then((data) => !cancelled && setAccounts(data))
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setAccounts([]);
      });
    return () => { cancelled = true; };
  }, [refreshCount]);

  function closeForm() {
    setFormOpen(false);
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createAccount(getAutoName(type, accounts || []), type);
      setType('current');
      closeForm();
      setRefreshCount((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(acc) {
    if (!window.confirm(`Delete "${acc.name}"? This also deletes its transactions.`)) return;
    try {
      await api.deleteAccount(acc.id);
      setRefreshCount((n) => n + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  const loading = accounts === null;
  const grid = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? 12 : 18 };

  return (
    <div style={{ minHeight: '100vh', padding: isMobile ? 16 : '24px 32px', position: 'relative', zIndex: 1 }}>
      <Nav />

      <main className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, gap: 12 }}>
          <h1 className="font-mono" style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, color: '#000' }}>Accounts</h1>
          <button type="button" onClick={() => (showForm ? closeForm() : setFormOpen(true))} aria-expanded={showForm} className="font-mono" style={buttonStyle}>
            {showForm ? 'Cancel' : '+ Add account'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} aria-label="Add account" style={formStyle}>
            <label htmlFor="account-type" className="font-mono" style={{ display: 'block', color: '#ccc', fontSize: 12, marginBottom: 8 }}>
              Account type
            </label>
            <select id="account-type" value={type} onChange={(e) => setType(e.target.value)} className="font-mono" style={{ ...selectStyle, marginBottom: 14 }}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <button type="submit" disabled={submitting} className="font-mono" style={{ ...buttonStyle, background: '#2a2f33', width: '100%' }}>
              {submitting ? 'Creating…' : 'Create account'}
            </button>
          </form>
        )}

        {error && <p role="alert" style={{ color: '#8f1d1d', fontSize: 14, marginBottom: 14 }}>{error}</p>}

        {loading ? (
          <p role="status" style={{ color: '#333', fontSize: 14 }}>Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <div style={{ position: 'relative' }}>
            <PlaceholderContent style={grid}>
              {GHOST_ACCOUNTS.map((acc, i) => (
                <AccountCard key={acc.label} name={acc.label} type={acc.type} balance={acc.balance} label={accountLabel(i)} isMobile={isMobile} />
              ))}
            </PlaceholderContent>
            <EmptyOverlay message="No accounts yet — add one above." />
          </div>
        ) : (
          <ul aria-label="Your accounts" style={{ ...grid, listStyle: 'none', padding: 0, margin: 0 }}>
            {accounts.map((acc, i) => (
              <li key={acc.id}>
                <AccountCard
                  name={acc.name}
                  type={acc.type}
                  balance={acc.balance}
                  label={accountLabel(i)}
                  isMobile={isMobile}
                  onDelete={() => handleDelete(acc)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function AccountCard({ name, type, balance, label, isMobile, onDelete }) {
  return (
    <div className="chrome-surface" style={isMobile ? mobileCardStyle : cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, position: 'relative', zIndex: 1 }}>
        <h2 className="font-mono" style={{ fontSize: 13, color: '#1a1a1a', margin: 0, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AccountTypeIcon type={type} size={18} />
          {name}
        </h2>
        {onDelete && (
          <button type="button" onClick={onDelete} className="icon-button" aria-label={`Delete ${name} account`} style={{ color: '#1a1a1a', fontSize: 18 }}>
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      <p className="font-mono" style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, margin: '0 0 10px', color: '#101112', overflowWrap: 'anywhere', position: 'relative', zIndex: 1 }}>
        {formatGBP(toPence(balance))}
      </p>
      <p className="font-mono" style={{ fontSize: 12, color: '#2e2e2e', margin: 0, fontWeight: 500, letterSpacing: 0.5, position: 'relative', zIndex: 1 }}>
        {label}
      </p>
    </div>
  );
}

const cardStyle = { borderRadius: 14, padding: 26, minHeight: 150 };
const mobileCardStyle = { borderRadius: 14, padding: 20, minHeight: 0 };

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
  padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
const formStyle = { background: '#141414', borderRadius: 12, padding: 22, marginBottom: 22, maxWidth: 360 };
