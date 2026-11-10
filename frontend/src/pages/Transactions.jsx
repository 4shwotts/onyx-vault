import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Nav from '../components/Nav';
import MonthPicker from '../components/MonthPicker';
import TransactionForm from '../components/TransactionForm';
import EmptyOverlay, { PlaceholderContent } from '../components/EmptyOverlay';
import { api } from '../api/client';
import { getAvailableMonths } from '../utils/months';
import { monthRange, formatShortDate } from '../utils/dates';
import { toPence, formatSignedGBP } from '../utils/money';
import { signedAmount } from '../lib/transactionForm';
import { BASE_CATEGORIES } from '../constants/categories';
import { CategoryIcon } from '../components/Icon';
import useIsMobile from '../hooks/useIsMobile';

// Page size on mobile (where the page scrolls normally) and before the
// first measurement. On desktop the page size is derived from the space
// left below the header / recurring list, so the pagination controls
// always sit inside the viewport.
const PAGE_SIZE = 9;
const LIST_PADDING_Y = 10;

// Shown blurred behind the "No transactions yet" message. Every name is
// made up; no real shops or companies.
const PLACEHOLDER_TRANSACTIONS = [
  { id: 'p1', description: 'Fernhollow Grocers', category_name: 'Groceries', account_name: 'Current', date: '2026-08-01', amount: '-34.20' },
  { id: 'p2', description: 'Salary – Brambleworth Ltd', category_name: 'Income', account_name: 'Current', date: '2026-08-01', amount: '2400.00', is_recurring: true },
  { id: 'p3', description: 'Velvetreel Streaming', category_name: 'Entertainment', account_name: 'Current', date: '2026-07-29', amount: '-11.99', is_recurring: true },
  { id: 'p4', description: 'Hollowmere Homewares', category_name: 'Shopping', account_name: 'Current', date: '2026-07-27', amount: '-58.40' },
  { id: 'p5', description: 'Pebblewick Coffee', category_name: 'Eating Out', account_name: 'Current', date: '2026-07-25', amount: '-4.50' },
  { id: 'p6', description: 'Glimmerline Rail', category_name: 'Transport', account_name: 'Current', date: '2026-07-24', amount: '-14.30' },
  { id: 'p7', description: 'Quillby Energy', category_name: 'Bills', account_name: 'Current', date: '2026-07-21', amount: '-68.00', is_recurring: true },
  { id: 'p8', description: 'Lyrebird Music Plan', category_name: 'Subscriptions', account_name: 'Current', date: '2026-07-19', amount: '-9.99', is_recurring: true },
];

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // Filters and the page live in the URL, so they survive a refresh, can be
  // linked to (the command palette and dashboard do), and need no effects
  // to keep state and URL in step.
  const filterAccount = searchParams.get('account') || '';
  const filterCategory = searchParams.get('category') || '';
  const filterMonth = searchParams.get('month') || '';
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const addRequested = searchParams.get('new') === '1';

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [allForMonths, setAllForMonths] = useState([]);
  const [pageData, setPageData] = useState(null);
  const [loadedKey, setLoadedKey] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [formMode, setFormMode] = useState(null); // null | 'add' | transaction being edited
  const listSlotRef = useRef(null);
  const [fitPageSize, setFitPageSize] = useState(PAGE_SIZE);

  const pageSize = isMobile ? PAGE_SIZE : fitPageSize;
  const hasPageData = pageData !== null;
  const formOpen = formMode !== null || addRequested;
  const editing = formMode && formMode !== 'add' ? formMode : null;

  const updateParams = useCallback((changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const categoryId = useMemo(() => {
    if (!filterCategory) return null;
    return categories.find((c) => c.name === filterCategory)?.id ?? 'none';
  }, [categories, filterCategory]);

  const query = useMemo(() => {
    const q = { page: requestedPage, limit: pageSize };
    if (filterAccount) q.account_id = filterAccount;
    if (categoryId && categoryId !== 'none') q.category_id = categoryId;
    if (filterMonth) {
      const [year, month] = filterMonth.split('-').map(Number);
      Object.assign(q, monthRange(year, month));
    }
    return q;
  }, [requestedPage, pageSize, filterAccount, categoryId, filterMonth]);

  const queryKey = `${JSON.stringify(query)}|${categoryId}|${refreshCount}`;
  const loading = loadedKey !== queryKey;

  // Reference data: accounts, categories, rules and the months that have
  // any transactions at all.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getAccounts(), api.getCategories(), api.getRecurring(), api.getTransactions()])
      .then(([accs, cats, recs, all]) => {
        if (cancelled) return;
        setAccounts(accs);
        setCategories(cats);
        setRecurring(recs);
        setAllForMonths(all);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [refreshCount]);

  // The page of transactions itself, fetched from the server.
  useEffect(() => {
    let cancelled = false;
    const fetchPage = categoryId === 'none'
      ? Promise.resolve({ transactions: [], page: 1, limit: pageSize, total: 0, totalPages: 0 })
      : api.getTransactionsPage(query);
    fetchPage
      .then((data) => {
        if (cancelled) return;
        setPageData(data);
        setLoadedKey(queryKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoadedKey(queryKey);
      });
    return () => { cancelled = true; };
  }, [query, queryKey, categoryId, pageSize]);

  const reload = () => setRefreshCount((n) => n + 1);

  const filterCategoryOptions = useMemo(() => {
    const names = new Set([...BASE_CATEGORIES, ...categories.map((c) => c.name)]);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  async function resolveCategoryId(name) {
    const typed = (name || '').trim() || 'Other';
    const existing = categories.find((c) => c.name.toLowerCase() === typed.toLowerCase());
    if (existing) return existing.id;
    const created = await api.createCategory(typed);
    return created.id;
  }

  function closeForm() {
    setFormMode(null);
    if (addRequested) updateParams({ new: '' });
  }

  async function handleSubmit(values) {
    setError('');
    setInfo('');
    const categoryIdToUse = await resolveCategoryId(values.categoryName);
    const amount = signedAmount(values.amount, values.isExpense);
    const body = {
      account_id: Number(values.accountId),
      category_id: categoryIdToUse,
      amount,
      description: values.description.trim() || null,
    };

    if (editing) {
      await api.updateTransaction(editing.id, { ...body, date: values.date });
      setInfo('Transaction updated.');
    } else if (values.makeRecurring) {
      const created = await api.createRecurring({ ...body, frequency: values.frequency, start_date: values.date });
      const posted = created.payments_posted || 0;
      setInfo(posted > 0
        ? `Recurring rule created. ${posted} payment${posted === 1 ? '' : 's'} due so far ${posted === 1 ? 'has' : 'have'} been added.`
        : 'Recurring rule created. It will add its first payment on the start date.');
    } else {
      await api.createTransaction({ ...body, date: values.date });
    }
    closeForm();
    reload();
  }

  async function handleDelete(t) {
    if (!window.confirm(`Delete “${t.description || 'this transaction'}”?`)) return;
    try {
      await api.deleteTransaction(t.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteRecurring(rule) {
    if (!window.confirm(`Stop the recurring payment “${rule.description || 'untitled'}”? Payments already added are kept.`)) return;
    try {
      await api.deleteRecurring(rule.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  // Fits as many rows as the list slot can hold. The slot is flex:1, so
  // its height comes from the viewport minus everything above it, not
  // from its contents; re-measured whenever that space changes.
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
  }, [isMobile, hasPageData]);

  useEffect(() => {
    if (!formOpen) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') closeForm();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const transactions = pageData?.transactions ?? [];
  const total = pageData?.total ?? 0;
  const totalPages = pageData?.totalPages ?? 0;
  const isEmpty = !loading && total === 0;
  const hasFilters = Boolean(filterAccount || filterCategory || filterMonth);
  const currentPage = Math.min(requestedPage, Math.max(totalPages, 1));
  const rows = isEmpty ? PLACEHOLDER_TRANSACTIONS.slice(0, pageSize) : transactions;

  return (
    <div className="hide-scrollbar" style={{
      ...(isMobile
        ? { minHeight: '100vh', padding: 16 }
        : { height: '100vh', padding: '16px 32px', overflowY: 'auto' }),
      display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1,
    }}>
      <Nav />

      <main className="page-container" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* The form floats over the list (anchored to this header) instead
            of being inserted into the flow, so opening it doesn't push the
            list and pagination below the fold. */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
          <h1 className="font-mono" style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, color: '#000' }}>Transactions</h1>
          <button
            type="button"
            onClick={() => (formOpen ? closeForm() : setFormMode('add'))}
            aria-expanded={formOpen}
            className="font-mono"
            style={buttonStyle}
          >
            {formOpen ? 'Cancel' : '+ Add'}
          </button>

          {formOpen && (
            <TransactionForm
              key={editing ? `edit-${editing.id}` : 'add'}
              mode={editing ? 'edit' : 'add'}
              initial={editing}
              accounts={accounts}
              categoryNames={categories.map((c) => c.name)}
              onSubmit={handleSubmit}
              onCancel={closeForm}
              style={{ ...floatingFormStyle, ...(isMobile ? { left: 0, right: 0 } : { right: 0, width: 360 }) }}
            />
          )}
        </div>

        <div role="group" aria-label="Filters" style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, flexShrink: 0 }}>
          <label className="visually-hidden" htmlFor="filter-account">Filter by account</label>
          <select id="filter-account" value={filterAccount} onChange={(e) => updateParams({ account: e.target.value, page: '' })} className="font-mono" style={isMobile ? mobileChipStyle : chipStyle}>
            <option value="">All Accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <label className="visually-hidden" htmlFor="filter-category">Filter by category</label>
          <select id="filter-category" value={filterCategory} onChange={(e) => updateParams({ category: e.target.value, page: '' })} className="font-mono" style={isMobile ? mobileChipStyle : chipStyle}>
            <option value="">All Categories</option>
            {filterCategoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
            <MonthPicker months={getAvailableMonths(allForMonths)} value={filterMonth} onChange={(m) => updateParams({ month: m, page: '' })} allowAll fullWidth={isMobile} />
          </div>
        </div>

        {error && <p role="alert" className="font-mono" style={{ color: '#b83232', fontSize: 14, margin: '0 0 14px', flexShrink: 0 }}>{error}</p>}
        {info && <p role="status" className="font-mono" style={{ color: '#5b2a74', fontSize: 14, margin: '0 0 14px', flexShrink: 0 }}>{info}</p>}

        {recurring.length > 0 && (
          <section aria-labelledby="recurring-heading" style={{ marginBottom: 20, flexShrink: 0 }}>
            <h2 id="recurring-heading" className="font-mono" style={{ fontSize: 15, color: '#333', margin: '0 0 8px', fontWeight: 700 }}>Recurring Payments</h2>
            <div className="dark-surface" style={darkListStyle}>
              {/* Capped at ~3 rows so a long list of rules can't eat the
                  space the transaction list needs; scrolls past that. */}
              <ul className="hide-scrollbar" style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 190, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
                {recurring.map((r, i) => {
                  const pence = toPence(r.amount);
                  return (
                    <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: isMobile ? '10px 12px' : '10px 18px', borderBottom: i < recurring.length - 1 ? '0.5px solid #262626' : 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <p className="font-mono" style={{ fontSize: isMobile ? 14 : 16, color: '#e5e5e5', margin: '0 0 2px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '(no description)'}</p>
                        <p className="font-mono" style={{ fontSize: isMobile ? 10 : 12, color: '#a0a0a0', margin: 0 }}>
                          {r.account_name?.toUpperCase()} · {r.frequency.toUpperCase()} · NEXT {formatShortDate(r.next_run_date).toUpperCase()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, flexShrink: 0 }}>
                        <p className="font-mono" style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', color: pence < 0 ? '#ff8a8a' : '#6fdba5' }}>
                          {formatSignedGBP(pence)}
                        </p>
                        <button type="button" onClick={() => handleDeleteRecurring(r)} className="icon-button" aria-label={`Stop recurring payment ${r.description || ''}`.trim()} style={{ color: '#bbb', fontSize: 16 }}>
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        <div ref={listSlotRef} style={isMobile ? { position: 'relative' } : { position: 'relative', flex: 1, minHeight: 0 }}>
          {loading && pageData === null ? (
            <p role="status" style={{ color: '#444', fontSize: 14 }}>Loading transactions…</p>
          ) : (
            <>
              {(() => {
                const list = (
                  <ul className="chrome-surface" aria-label="Transactions" aria-busy={loading} style={{ listStyle: 'none', margin: 0, borderRadius: 14, padding: `${LIST_PADDING_Y}px ${isMobile ? 4 : 8}px` }}>
                    {rows.map((t, i) => (
                      <TransactionRow key={t.id} t={t} last={i === rows.length - 1} isMobile={isMobile}
                        onEdit={() => setFormMode(t)} onDelete={() => handleDelete(t)} />
                    ))}
                  </ul>
                );
                return isEmpty ? <PlaceholderContent>{list}</PlaceholderContent> : list;
              })()}
              {isEmpty && <EmptyOverlay message={hasFilters ? 'No transactions match these filters.' : 'No transactions yet.'} />}
            </>
          )}
        </div>

        {totalPages > 1 && (
          <nav aria-label="Pages" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? 8 : 14, marginTop: 12, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => updateParams({ page: currentPage - 1 > 1 ? currentPage - 1 : '' })}
              disabled={currentPage === 1}
              className="font-mono"
              style={{ ...pageButtonStyle, minWidth: isMobile ? 84 : 100, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}
            >
              Previous
            </button>
            <p className="font-mono" aria-live="polite" style={{ fontSize: isMobile ? 11 : 13, color: '#333', margin: 0, minWidth: isMobile ? 0 : 90, textAlign: 'center' }}>
              Page {currentPage} of {totalPages}
            </p>
            <button
              type="button"
              onClick={() => updateParams({ page: currentPage + 1 })}
              disabled={currentPage === totalPages}
              className="font-mono"
              style={{ ...pageButtonStyle, minWidth: isMobile ? 84 : 100, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}
            >
              Next
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}

function TransactionRow({ t, last, isMobile, onEdit, onDelete }) {
  const pence = toPence(t.amount);
  const label = t.description || '(no description)';
  return (
    <li data-tx-row style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      padding: isMobile ? '11px 10px' : '13px 18px',
      borderBottom: last ? 'none' : '0.5px solid #00000022',
    }}>
      {/* minWidth:0 + nowrap/ellipsis keep every row one fixed height (the
          desktop page-size maths relies on it) and stop long text pushing
          the amount off-screen. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, minWidth: 0 }}>
        <CategoryIcon name={t.category_name} size={isMobile ? 36 : 46} />
        <div style={{ minWidth: 0 }}>
          <p className="font-mono" style={{ fontSize: isMobile ? 13 : 17, color: '#101112', margin: '0 0 3px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{label}</span>
            {t.is_recurring && <span className="font-mono" style={{ ...badgeStyle, fontSize: isMobile ? 8 : 12, color: '#222', border: '1px solid #333' }}>{isMobile ? 'REC' : 'RECURRING'}</span>}
            {t.is_anomaly && (
              <span className="font-mono" title="More than three times your usual spending in this category" style={{ ...badgeStyle, fontSize: isMobile ? 8 : 12, color: '#8f1d1d', border: '1px solid #8f1d1d', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span aria-hidden="true" style={{ fontSize: isMobile ? 10 : 15, position: 'relative', top: -1 }}>⚠</span>{isMobile ? <span className="visually-hidden">Unusual</span> : ' UNUSUAL'}
              </span>
            )}
          </p>
          <p className="font-mono" style={{ fontSize: isMobile ? 10 : 13, color: '#2e2e2e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.account_name} · {t.category_name || 'Other'} · {formatShortDate(t.date)}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 2 : 8, flexShrink: 0 }}>
        <p className="font-mono" style={{ fontSize: isMobile ? 13 : 17, fontWeight: 700, margin: '0 6px 0 0', whiteSpace: 'nowrap', color: pence < 0 ? '#8f1d1d' : '#14663d' }}>
          {formatSignedGBP(pence)}
        </p>
        <button type="button" onClick={onEdit} className="icon-button" aria-label={`Edit ${label}`} style={{ color: '#222', fontSize: isMobile ? 13 : 15 }}>
          <span aria-hidden="true">✎</span>
        </button>
        <button type="button" onClick={onDelete} className="icon-button" aria-label={`Delete ${label}`} style={{ color: '#222', fontSize: 16 }}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </li>
  );
}

const darkListStyle = { borderRadius: 14, padding: 4 };
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
const floatingFormStyle = {
  position: 'absolute', top: 'calc(100% + 8px)', zIndex: 20,
  boxShadow: '0 18px 44px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.25)',
};
