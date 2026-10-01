import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Nav from '../components/Nav';
import MonthPicker from '../components/MonthPicker';
import { api } from '../api/client';
import { getAvailableMonths } from '../utils/months';
import { BASE_CATEGORIES } from '../constants/categories';
import { CategoryIcon } from '../components/Icon';
import useIsMobile from '../hooks/useIsMobile';

// Page size on mobile (where the page scrolls normally) and before the
// first measurement. On desktop the page size is derived from the space
// left below the header / recurring list, so the pagination controls
// always sit inside the viewport.
const PAGE_SIZE = 9;
const LIST_PADDING_Y = 10;

const FAKE_TRANSACTIONS = [
  { id: 'ghost-1', description: 'Tesco Express', category_name: 'Groceries', account_name: 'Current', date: '2026-08-01', amount: -34.20, is_recurring: false, is_anomaly: false },
  { id: 'ghost-2', description: 'Salary', category_name: 'Income', account_name: 'Current', date: '2026-08-01', amount: 2400, is_recurring: true, is_anomaly: false },
  { id: 'ghost-3', description: 'Netflix', category_name: 'Entertainment', account_name: 'Current', date: '2026-07-29', amount: -11.99, is_recurring: true, is_anomaly: false },
  { id: 'ghost-4', description: 'Amazon', category_name: 'Shopping', account_name: 'Current', date: '2026-07-27', amount: -58.40, is_recurring: false, is_anomaly: false },
  { id: 'ghost-5', description: 'Costa Coffee', category_name: 'Eating Out', account_name: 'Current', date: '2026-07-25', amount: -4.50, is_recurring: false, is_anomaly: false },
  { id: 'ghost-6', description: 'Uber', category_name: 'Transport', account_name: 'Current', date: '2026-07-24', amount: -14.30, is_recurring: false, is_anomaly: false },
  { id: 'ghost-7', description: 'British Gas', category_name: 'Bills', account_name: 'Current', date: '2026-07-21', amount: -68.00, is_recurring: true, is_anomaly: false },
  { id: 'ghost-8', description: 'Spotify', category_name: 'Subscriptions', account_name: 'Current', date: '2026-07-19', amount: -9.99, is_recurring: true, is_anomaly: false },
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
  const [searchParams] = useSearchParams();
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
  const [appliedUrlFilters, setAppliedUrlFilters] = useState(false);
  const [page, setPage] = useState(1);
  const isMobile = useIsMobile();
  const listSlotRef = useRef(null);
  const [fitPageSize, setFitPageSize] = useState(PAGE_SIZE);

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

  const mergedFilterCategories = useMemo(() => {
    const realNames = new Set(categories.map((c) => c.name));
    const virtualOnes = BASE_CATEGORIES
      .filter((name) => !realNames.has(name))
      .map((name) => ({ id: `virtual-${name}`, name }));
    return [...categories, ...virtualOnes].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  async function loadAll() {
    try {
      const isVirtualCategory = filterCategory.startsWith('virtual-');
      const params = new URLSearchParams();
      if (filterAccount) params.append('account_id', filterAccount);
      if (filterCategory && !isVirtualCategory) params.append('category_id', filterCategory);
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
      setTransactions(isVirtualCategory ? [] : txs);
      setAccounts(accs);
      setCategories(cats);
      setRecurring(recs);
      setAllTransactionsForMonths(allTxs);
      return { cats, accs };
    } catch (err) {
      setError(err.message);
      return { cats: [], accs: [] };
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [filterAccount, filterCategory, filterMonth]);

  useEffect(() => {
    setPage(1);
  }, [filterAccount, filterCategory, filterMonth]);

  useEffect(() => {
    if (appliedUrlFilters) return;
    if (categories.length === 0 && accounts.length === 0) return;

    const categoryParam = searchParams.get('category');
    const accountParam = searchParams.get('account');
    const monthParam = searchParams.get('month');

    let changed = false;
    if (categoryParam) {
      const match = categories.find((c) => c.name === categoryParam);
      if (match) {
        setFilterCategory(String(match.id));
        changed = true;
      }
    }
    if (accountParam) {
      const match = accounts.find((a) => String(a.id) === accountParam);
      if (match) {
        setFilterAccount(String(match.id));
        changed = true;
      }
    }
    if (monthParam) {
      setFilterMonth(monthParam);
      changed = true;
    }
    if (changed || categoryParam || accountParam || monthParam) {
      setAppliedUrlFilters(true);
    }
  }, [categories, accounts, searchParams, appliedUrlFilters]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowForm(true);
    }
  }, [searchParams]);

  async function resolveCategoryId() {
    const typed = categoryName.trim() || 'Other';
    const existing = categories.find(
      (c) => c.name.toLowerCase() === typed.toLowerCase()
    );
    if (existing) return existing.id;
    const created = await api.createCategory(typed);
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
        if (created.first_transaction_created) {
          setInfo("Recurring rule created -- today's payment was processed immediately. It'll run automatically from here on.");
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

  function formatNextRun(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  }

  // Fits as many rows as the list slot can hold. The slot is flex:1, so
  // its height comes from the viewport minus everything above it, not
  // from its contents; re-measured whenever that space changes (window
  // resize, recurring list or messages appearing) and when the list
  // itself resizes, since row height shifts once the web fonts load.
  useLayoutEffect(() => {
    const slot = listSlotRef.current;
    if (isMobile || !slot) return undefined;

    function measure() {
      const row = slot.querySelector('[data-tx-row]');
      const rowHeight = row ? row.offsetHeight : 73;
      const available = slot.clientHeight - LIST_PADDING_Y * 2;
      setFitPageSize(Math.max(1, Math.floor(available / rowHeight)));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    if (slot.firstElementChild) observer.observe(slot.firstElementChild);
    return () => observer.disconnect();
  }, [isMobile, loading]);

  useEffect(() => {
    if (!showForm) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') setShowForm(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showForm]);

  const pageSize = isMobile ? PAGE_SIZE : fitPageSize;
  const displayTransactions = transactions.length === 0 ? FAKE_TRANSACTIONS : transactions;
  const totalPages = Math.max(1, Math.ceil(displayTransactions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedTransactions = displayTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="hide-scrollbar" style={{
      ...(isMobile
        ? { minHeight: '100vh', padding: 16 }
        : { height: '100vh', padding: '20px 32px', overflowY: 'auto' }),
      display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1,
    }}>
      <Nav />

      <div className="page-container" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* The add form floats over the list (anchored to this header)
            instead of being inserted into the flow, so opening it
            doesn't push the list and pagination below the fold. */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
          <p className="font-mono" style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, color: '#000' }}>Transactions</p>
          <button onClick={() => setShowForm(!showForm)} className="font-mono" style={buttonStyle}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>

          {showForm && (
          <form onSubmit={handleCreate} style={{ ...formStyle, ...(isMobile ? { left: 0, right: 0 } : { right: 0, width: 360 }) }}>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required className="font-mono" style={selectStyle}>
              <option value="">Select account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input type="text" placeholder="Description (e.g. Waitrose)" value={description}
              onChange={(e) => setDescription(e.target.value)} className="font-mono" style={inputStyle} />
            <select value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="font-mono" style={selectStyle}>
              <option value="">Category</option>
              {BASE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
        </div>

        <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, flexShrink: 0 }}>
          <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="font-mono" style={isMobile ? mobileChipStyle : chipStyle}>
            <option value="">All Accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="font-mono" style={isMobile ? mobileChipStyle : chipStyle}>
            <option value="">Category</option>
            {mergedFilterCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
            <MonthPicker months={getAvailableMonths(allTransactionsForMonths)} value={filterMonth} onChange={setFilterMonth} allowAll fullWidth={isMobile} />
          </div>
        </div>

        {error && <p className="font-mono" style={{ color: 'var(--expense)', fontSize: 14, margin: '0 0 14px', flexShrink: 0 }}>{error}</p>}
        {info && <p className="font-mono" style={{ color: 'var(--accent)', fontSize: 14, margin: '0 0 14px', flexShrink: 0 }}>{info}</p>}

        {recurring.length > 0 && (
          <div style={{ marginBottom: 20, flexShrink: 0 }}>
            <p className="font-mono" style={{ fontSize: 15, color: '#333', margin: '0 0 8px', fontWeight: 700 }}>Transactions Recurring</p>
            <div className="dark-surface" style={darkListStyle}>
              {/* Capped at ~3 rows so a long list of rules can't eat the
                  space the transaction list needs; scrolls past that. */}
              <div className="hide-scrollbar" style={{ maxHeight: 190, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
                {recurring.map((r, i) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: isMobile ? '10px 12px' : '10px 18px', borderBottom: i < recurring.length - 1 ? '0.5px solid #262626' : 'none' }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="font-mono" style={{ fontSize: isMobile ? 14 : 16, color: '#e5e5e5', margin: '0 0 2px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '(no description)'}</p>
                      <p className="font-mono" style={{ fontSize: isMobile ? 10 : 12, color: '#8a8a8a', margin: 0 }}>
                        {r.account_name?.toUpperCase()} · {r.frequency.toUpperCase()} · NEXT {formatNextRun(r.next_run_date)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, flexShrink: 0 }}>
                      <p className="font-mono" style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', color: Number(r.amount) < 0 ? 'var(--expense)' : 'var(--income)' }}>
                        {Number(r.amount) < 0 ? '−' : '+'}£{Math.abs(Number(r.amount)).toFixed(2)}
                      </p>
                      <span onClick={() => handleDeleteRecurring(r.id)} style={{ cursor: 'pointer', color: '#8a8a8a', fontSize: 15 }}>×</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: '#888', fontSize: 14 }}>Loading transactions...</p>
        ) : (
          <>
            <div ref={listSlotRef} style={isMobile ? { position: 'relative' } : { position: 'relative', flex: 1, minHeight: 0 }}>
              <div className="chrome-surface" style={{
                borderRadius: 14, padding: `${LIST_PADDING_Y}px ${isMobile ? 4 : 8}px`,
                filter: transactions.length === 0 ? 'blur(3px)' : 'none',
                opacity: transactions.length === 0 ? 0.55 : 1,
                pointerEvents: transactions.length === 0 ? 'none' : 'auto',
              }}>
                {pagedTransactions.map((t, i) => (
                  <div key={t.id} data-tx-row style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                    padding: isMobile ? '11px 10px' : '13px 18px',
                    borderBottom: i < pagedTransactions.length - 1 ? '0.5px solid #00000022' : 'none',
                  }}>
                    {/* minWidth:0 + nowrap/ellipsis keep every row one fixed
                        height (the desktop page-size maths relies on it)
                        and stop long text pushing the amount off-screen. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, minWidth: 0 }}>
                      <CategoryIcon name={t.category_name} size={isMobile ? 36 : 46} />
                      <div style={{ minWidth: 0 }}>
                        <p className="font-mono" style={{ fontSize: isMobile ? 13 : 17, color: '#101112', margin: '0 0 3px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, minWidth: 0 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{t.description || '(no description)'}</span>
                          {t.is_recurring && <span className="font-mono" style={{ ...badgeStyle, fontSize: isMobile ? 8 : 12, color: '#333', border: '1px solid #333' }}>{isMobile ? 'REC' : 'RECURRING'}</span>}
                          {t.is_anomaly && (
                            <span className="font-mono" style={{ ...badgeStyle, fontSize: isMobile ? 8 : 12, color: 'var(--expense)', border: '1px solid var(--expense)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: isMobile ? 10 : 15, position: 'relative', top: -1 }}>⚠</span>{!isMobile && ' UNUSUAL'}
                            </span>
                          )}
                        </p>
                        <p className="font-mono" style={{ fontSize: isMobile ? 10 : 13, color: '#3a3a3a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.account_name} · {t.category_name || 'Other'} · {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, flexShrink: 0 }}>
                      <p className="font-mono" style={{ fontSize: isMobile ? 13 : 17, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', color: Number(t.amount) < 0 ? '#b83232' : '#1f8a52' }}>
                        {Number(t.amount) < 0 ? '−' : '+'}£{Math.abs(Number(t.amount)).toFixed(2)}
                      </p>
                      <span onClick={() => handleDelete(t.id)} style={{ cursor: 'pointer', color: '#00000066', fontSize: 16 }}>×</span>
                    </div>
                  </div>
                ))}
              </div>
              {transactions.length === 0 && <EmptyOverlay message="No transactions yet." />}
            </div>

            {transactions.length > pageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? 8 : 14, marginTop: 12, flexShrink: 0 }}>
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="font-mono"
                  style={{ ...pageButtonStyle, minWidth: isMobile ? 84 : 100, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}
                >
                  Previous
                </button>
                <p className="font-mono" style={{ fontSize: isMobile ? 11 : 13, color: '#555', margin: 0, minWidth: isMobile ? 0 : 90, textAlign: 'center' }}>
                  Page {currentPage} of {totalPages}
                </p>
                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="font-mono"
                  style={{ ...pageButtonStyle, minWidth: isMobile ? 84 : 100, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const darkListStyle = { borderRadius: 14, padding: 4 };
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
const mobileChipStyle = {
  ...chipStyle, width: '100%', minWidth: 0, padding: '10px 30px 10px 14px', textOverflow: 'ellipsis',
};
const badgeStyle = { borderRadius: 4, padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap' };
const buttonStyle = {
  background: '#141414', color: '#fff', border: 'none', borderRadius: 8,
  padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const pageButtonStyle = {
  background: '#141414', color: '#e5e5e5', border: '0.5px solid #333', borderRadius: 8,
  padding: '9px 16px', fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'center',
};
const formStyle = {
  position: 'absolute', top: 'calc(100% + 8px)', zIndex: 20,
  background: '#141414', borderRadius: 12, padding: 22,
  boxShadow: '0 18px 44px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.25)',
};