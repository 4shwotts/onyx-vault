import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import MonthPicker from '../components/MonthPicker';
import { api } from '../api/client';
import { getAvailableMonths } from '../utils/months';

// Placeholder rows shown, lightly blurred, behind an overlay message when
// there are no real transactions yet — keeps the chrome card at its
// normal size instead of collapsing down to a single line of text.
const FAKE_TRANSACTIONS = [
  { id: 'ghost-1', description: 'Tesco Express', category_name: 'Groceries', account_name: 'Current', date: '2026-08-01', amount: -34.20, is_recurring: false, is_anomaly: false },
  { id: 'ghost-2', description: 'Salary', category_name: 'Income', account_name: 'Current', date: '2026-08-01', amount: 2400, is_recurring: true, is_anomaly: false },
  { id: 'ghost-3', description: 'Netflix', category_name: 'Entertainment', account_name: 'Current', date: '2026-07-29', amount: -11.99, is_recurring: true, is_anomaly: false },
  { id: 'ghost-4', description: 'Amazon', category_name: 'Shopping', account_name: 'Current', date: '2026-07-27', amount: -58.40, is_recurring: false, is_anomaly: false },
  { id: 'ghost-5', description: 'Costa Coffee', category_name: 'Dining', account_name: 'Current', date: '2026-07-25', amount: -4.50, is_recurring: false, is_anomaly: false },
  { id: 'ghost-6', description: 'Uber', category_name: 'Transport', account_name: 'Current', date: '2026-07-24', amount: -14.30, is_recurring: false, is_anomaly: false },
  { id: 'ghost-7', description: 'British Gas', category_name: 'Utilities', account_name: 'Current', date: '2026-07-21', amount: -68.00, is_recurring: true, is_anomaly: false },
  { id: 'ghost-8', description: 'Spotify', category_name: 'Entertainment', account_name: 'Current', date: '2026-07-19', amount: -9.99, is_recurring: true, is_anomaly: false },
];

function EmptyOverlay({ message }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
      <p className="font-mono" style={{
        fontSize: 13, margin: 0, padding: '9px 20px', borderRadius: 20,
        letterSpacing: 0.3, fontWeight: 600,
        color: '#2a2a2a',
        background: 'rgba(255,255,255,0.72)',
        border: '0.5px solid rgba(0,0,0,0.08)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.10)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        {message}
      </p>
    </div>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [allTransactionsForMonths, setAllTransactionsForMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [amount, setAmount] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const params = new URLSearchParams();
      if (filterAccount) params.append('account_id', filterAccount);
      if (filterCategory) params.append('category_id', filterCategory);
      if (filterMonth) {
        const [year, month] = filterMonth.split('-').map(Number);
        const from = new Date(year, month - 1, 1).toISOString().slice(0, 10);
        const lastDay = new Date(year, month, 0).getDate();
        const to = new Date(year, month - 1, lastDay).toISOString().slice(0, 10);
        params.append('from', from);
        params.append('to', to);
      }
      const query = params.toString() ? `?${params.toString()}` : '';

      const [txs, accs, cats, recs, allTxs] = await Promise.all([
        api.getTransactions(query),
        api.getAccounts(),
        api.getCategories(),
        api.getRecurring(),
        api.getTransactions(),
      ]);
      setTransactions(txs);
      setAccounts(accs);
      setCategories(cats);
      setRecurring(recs);
      setAllTransactionsForMonths(allTxs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [filterAccount, filterCategory, filterMonth]);

  // Categories are created on the fly here rather than requiring the
  // user to pre-create them: if the typed name matches an existing
  // category (case-insensitive), reuse its id; otherwise create a new one.
  async function resolveCategoryId() {
    if (!categoryName.trim()) return null;
    const existing = categories.find(
      (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
    );
    if (existing) return existing.id;
    const created = await api.createCategory(categoryName.trim());
    return created.id;
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');

    try {
      const categoryId = await resolveCategoryId();
      const numericAmount = Math.abs(Number(amount)) * (isExpense ? -1 : 1);

      if (makeRecurring) {
        const created = await api.createRecurring({
          account_id: accountId,
          category_id: categoryId,
          amount: numericAmount,
          description,
          frequency,
          start_date: date,
        });
        // The backend processes the rule immediately if start_date is
        // today or earlier (see recurring.js), returning
        // first_transaction_created so the message here can reflect
        // what actually happened rather than always saying "scheduled."
        if (created.first_transaction_created) {
          setInfo("Recurring rule created — today's payment was processed immediately. It'll run automatically from here on.");
        } else {
          setInfo('Recurring rule created. It will run automatically on its scheduled date.');
        }
      } else {
        await api.createTransaction({
          account_id: accountId,
          category_id: categoryId,
          amount: numericAmount,
          description,
          date,
        });
      }

      setAmount('');
      setDescription('');
      setCategoryName('');
      setMakeRecurring(false);
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (confirm('Delete this transaction?')) {
      try {
        await api.deleteTransaction(id);
        await loadAll();
      } catch (err) {
        setError(err.message);
      }
    }
  }

  async function handleDeleteRecurring(id) {
    if (confirm('Cancel this recurring transaction?')) {
      try {
        await api.deleteRecurring(id);
        await loadAll();
      } catch (err) {
        setError(err.message);
      }
    }
  }

  // Falls back to the raw string if the date can't be parsed, rather
  // than letting a malformed value throw and break the whole row.
  function formatNextRun(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  }

  const displayTransactions = transactions.length === 0 ? FAKE_TRANSACTIONS : transactions;

  return (
    <div style={{ minHeight: '100vh', padding: '24px 32px', position: 'relative', zIndex: 1 }}>
      <Nav />

      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <p className="font-mono" style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#000' }}>Transactions</p>
          <button onClick={() => setShowForm(!showForm)} className="font-mono" style={buttonStyle}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="font-mono" style={chipStyle}>
            <option value="">All Accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="font-mono" style={chipStyle}>
            <option value="">Category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <MonthPicker months={getAvailableMonths(allTransactionsForMonths)} value={filterMonth} onChange={setFilterMonth} allowAll />
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={formStyle}>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required className="font-mono" style={selectStyle}>
              <option value="">Select account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input type="text" placeholder="Description (e.g. Waitrose)" value={description}
              onChange={(e) => setDescription(e.target.value)} className="font-mono" style={inputStyle} />
            <input type="text" placeholder="Category (e.g. Groceries)" value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)} className="font-mono" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input type="number" step="0.01" min="0" placeholder="Amount" value={amount}
                onChange={(e) => setAmount(e.target.value)} required className="font-mono" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <select value={isExpense ? 'expense' : 'income'} onChange={(e) => setIsExpense(e.target.value === 'expense')}
                className="font-mono" style={{ ...selectStyle, marginBottom: 0, width: 130 }}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="font-mono" style={inputStyle} />
            <label className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#999', marginBottom: makeRecurring ? 10 : 14 }}>
              <input type="checkbox" checked={makeRecurring} onChange={(e) => setMakeRecurring(e.target.checked)} />
              Make this recurring
            </label>
            {makeRecurring && (
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="font-mono" style={selectStyle}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
            <button type="submit" disabled={submitting} className="font-mono" style={{ ...buttonStyle, width: '100%' }}>
              {submitting ? 'Saving...' : makeRecurring ? 'Create recurring rule' : 'Add transaction'}
            </button>
          </form>
        )}

        {error && <p style={{ color: 'var(--expense)', fontSize: 14, marginBottom: 14 }}>{error}</p>}
        {info && <p style={{ color: 'var(--accent)', fontSize: 14, marginBottom: 14 }}>{info}</p>}

        {recurring.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p className="font-mono" style={{ fontSize: 15, color: '#333', margin: '0 0 10px', fontWeight: 700 }}>Transactions Recurring</p>
            <div style={darkListStyle}>
              {recurring.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: i < recurring.length - 1 ? '0.5px solid #262626' : 'none' }}>
                  <div>
                    <p className="font-mono" style={{ fontSize: 16, color: '#e5e5e5', margin: '0 0 2px', fontWeight: 600 }}>{r.description || '(no description)'}</p>
                    <p className="font-mono" style={{ fontSize: 12, color: '#8a8a8a', margin: 0 }}>
                      {r.account_name?.toUpperCase()} · {r.frequency.toUpperCase()} · NEXT {formatNextRun(r.next_run_date)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <p className="font-mono" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: Number(r.amount) < 0 ? 'var(--expense)' : 'var(--income)' }}>
                      {Number(r.amount) < 0 ? '−' : '+'}£{Math.abs(Number(r.amount)).toFixed(2)}
                    </p>
                    <span onClick={() => handleDeleteRecurring(r.id)} style={{ cursor: 'pointer', color: '#8a8a8a', fontSize: 15 }}>×</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: '#888', fontSize: 14 }}>Loading transactions...</p>
        ) : (
          <div style={{ position: 'relative' }}>
            <div className="chrome-surface" style={{
              borderRadius: 14, padding: '10px 8px',
              filter: transactions.length === 0 ? 'blur(3px)' : 'none',
              opacity: transactions.length === 0 ? 0.55 : 1,
              pointerEvents: transactions.length === 0 ? 'none' : 'auto',
            }}>
              {displayTransactions.map((t, i) => (
                <div key={t.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px',
                  borderBottom: i < displayTransactions.length - 1 ? '0.5px solid #00000022' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#9a9a9a', fontSize: 15 }}>{(t.category_name || '?')[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-mono" style={{ fontSize: 17, color: '#101112', margin: '0 0 3px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {t.description || '(no description)'}
                        {t.is_recurring && <span className="font-mono" style={{ fontSize: 12, color: '#333', border: '1px solid #333', borderRadius: 4, padding: '1px 6px' }}>RECURRING</span>}
                        {t.is_anomaly && (
                          <span className="font-mono" style={{ fontSize: 12, color: 'var(--expense)', border: '1px solid var(--expense)', borderRadius: 4, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 15, position: 'relative', top: -1 }}>⚠</span> UNUSUAL
                          </span>
                        )}
                      </p>
                      <p className="font-mono" style={{ fontSize: 13, color: '#3a3a3a', margin: 0 }}>
                        {t.account_name} · {t.category_name || 'Uncategorized'} · {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <p className="font-mono" style={{ fontSize: 17, fontWeight: 700, margin: 0, color: Number(t.amount) < 0 ? '#b83232' : '#1f8a52' }}>
                      {Number(t.amount) < 0 ? '−' : '+'}£{Math.abs(Number(t.amount)).toFixed(2)}
                    </p>
                    <span onClick={() => handleDelete(t.id)} style={{ cursor: 'pointer', color: '#00000066', fontSize: 16 }}>×</span>
                  </div>
                </div>
              ))}
            </div>
            {transactions.length === 0 && <EmptyOverlay message="No transactions yet." />}
          </div>
        )}
      </div>
    </div>
  );
}

const darkListStyle = { background: '#141414', borderRadius: 14, padding: 4 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid #333',
  borderRadius: 8, padding: '12px 14px', fontSize: 14, color: '#fff', marginBottom: 10,
};
const selectStyle = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid #333',
  borderRadius: 8, padding: '12px 40px 12px 14px', fontSize: 14, color: '#fff', marginBottom: 10,
  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e5e5e5' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  backgroundSize: '13px',
};
const chipStyle = {
  background: '#141414',
  border: 'none',
  borderRadius: 20,
  padding: '9px 34px 9px 18px',
  fontSize: 13,
  color: '#e5e5e5',
  fontWeight: 600,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e5e5e5' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  backgroundSize: '11px',
};
const buttonStyle = {
  background: '#141414', color: '#fff', border: 'none', borderRadius: 8,
  padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const formStyle = { background: '#141414', borderRadius: 12, padding: 22, marginBottom: 22, maxWidth: 360 };