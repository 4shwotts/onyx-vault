import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { toPence, formatSignedGBP } from '../utils/money';

// Ctrl/Cmd+K quick navigation and search. An accessible modal dialog:
// - role="dialog" + aria-modal, labelled, with focus kept inside while open
//   and returned to where it was when it closes;
// - the search box is a combobox controlling a listbox of options, with
//   the highlighted option announced via aria-activedescendant;
// - works with a mouse, a keyboard (arrows, Enter, Escape) and touch.
export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [data, setData] = useState(null); // { accounts, categories, transactions } once loaded
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const navigate = useNavigate();
  const listId = useId();

  const open = useCallback(() => {
    returnFocusRef.current = document.activeElement;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setHighlighted(0);
    const target = returnFocusRef.current;
    if (target && typeof target.focus === 'function') setTimeout(() => target.focus(), 0);
  }, []);

  useEffect(() => {
    function handleKeydown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) close(); else open();
      }
    }
    // Fired by api/client.js after any create/edit/delete, so the next
    // open shows fresh data.
    const handleDataChanged = () => setData(null);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('open-command-palette', open);
    window.addEventListener('app-data-changed', handleDataChanged);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('open-command-palette', open);
      window.removeEventListener('app-data-changed', handleDataChanged);
    };
  }, [isOpen, open, close]);

  // Load searchable data the first time the palette opens (and again after
  // anything changes). Signed-out visitors simply get the page commands.
  useEffect(() => {
    if (!isOpen || data) return undefined;
    let cancelled = false;
    Promise.all([api.getAccounts(), api.getCategories(), api.getTransactions()])
      .then(([accounts, categories, transactions]) => {
        if (!cancelled) setData({ accounts, categories, transactions });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, data]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  function go(path) {
    return () => navigate(path);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      navigate('/login');
    }
  }

  const staticCommands = [
    { id: 'nav-dashboard', label: 'Go to Dashboard', group: 'Navigate', action: go('/dashboard') },
    { id: 'nav-transactions', label: 'Go to Transactions', group: 'Navigate', action: go('/transactions') },
    { id: 'nav-accounts', label: 'Go to Accounts', group: 'Navigate', action: go('/accounts') },
    { id: 'nav-import', label: 'Go to Import', group: 'Navigate', action: go('/import') },
    { id: 'nav-settings', label: 'Go to Settings', group: 'Navigate', action: go('/settings') },
    { id: 'action-add-transaction', label: 'Add a transaction', group: 'Quick actions', action: go('/transactions?new=1') },
    { id: 'action-add-account', label: 'Add an account', group: 'Quick actions', action: go('/accounts?new=1') },
    { id: 'action-import', label: 'Import a CSV file', group: 'Quick actions', action: go('/import') },
    { id: 'action-logout', label: 'Log out', group: 'Quick actions', action: handleLogout },
  ];

  const accountCommands = (data?.accounts ?? []).map((acc) => ({
    id: `account-${acc.id}`,
    label: `Filter transactions: ${acc.name}`,
    group: 'Accounts',
    action: go(`/transactions?account=${acc.id}`),
  }));

  const categoryCommands = (data?.categories ?? []).map((cat) => ({
    id: `category-${cat.id}`,
    label: `Filter by category: ${cat.name}`,
    group: 'Categories',
    action: go(`/transactions?category=${encodeURIComponent(cat.name)}`),
  }));

  const lowerQuery = query.trim().toLowerCase();
  const matchedCommands = lowerQuery === ''
    ? staticCommands
    : [...staticCommands, ...accountCommands, ...categoryCommands].filter((c) => c.label.toLowerCase().includes(lowerQuery));

  const matchedTransactions = lowerQuery.length >= 2
    ? (data?.transactions ?? [])
      .filter((t) => (t.description || '').toLowerCase().includes(lowerQuery))
      .slice(0, 5)
      .map((t) => ({
        id: `tx-${t.id}`,
        label: t.description || '(no description)',
        meta: formatSignedGBP(toPence(t.amount)),
        group: 'Transactions',
        action: go(`/transactions?account=${t.account_id}`),
      }))
    : [];

  const results = [...matchedCommands, ...matchedTransactions];
  const activeIndex = Math.min(highlighted, Math.max(results.length - 1, 0));

  function choose(item) {
    close();
    item.action();
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(Math.min(activeIndex + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) choose(results[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog: the search box is its only stop.
      e.preventDefault();
    }
  }

  if (!isOpen) return null;

  const groups = [];
  results.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.items.push({ ...item, index });
    else groups.push({ name: item.group, items: [{ ...item, index }] });
  });

  const optionId = (index) => `${listId}-option-${index}`;

  return (
    <div
      onClick={close}
      data-testid="command-palette-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8,8,10,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search and quick actions"
        onClick={(e) => e.stopPropagation()}
        className="dark-surface"
        style={{ width: 560, maxWidth: 'calc(100vw - 32px)', maxHeight: '65vh', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Search pages, accounts, categories and transactions"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search pages, accounts, categories, transactions…"
          className="font-mono"
          style={{
            border: 'none', outline: 'none', background: 'transparent', color: '#eef1f3',
            fontSize: 15, padding: '18px 20px', borderBottom: '0.5px solid #262626',
            position: 'relative', zIndex: 1, minWidth: 0,
          }}
        />
        <div id={listId} role="listbox" aria-label="Results" style={{ overflowY: 'auto', padding: '6px 0', position: 'relative', zIndex: 1 }}>
          {results.length === 0 && (
            <p role="status" className="font-mono" style={{ fontSize: 13, color: '#aaa', padding: '16px 20px', margin: 0 }}>
              No matches.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name}>
              <p aria-hidden="true" className="font-mono" style={{ fontSize: 11, color: '#aaa', letterSpacing: 0.8, textTransform: 'uppercase', margin: '10px 20px 4px', fontWeight: 700 }}>
                {group.name}
              </p>
              {group.items.map((item) => {
                const isHighlighted = item.index === activeIndex;
                return (
                  <div
                    key={item.id}
                    id={optionId(item.index)}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlighted(item.index)}
                    onClick={() => choose(item)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      padding: '12px 20px', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box',
                      background: isHighlighted ? 'rgba(255,255,255,0.08)' : 'transparent',
                    }}
                  >
                    <span className="font-mono" style={{ fontSize: 14, color: '#eef1f3', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    {item.meta && (
                      <span className="font-mono" style={{ fontSize: 13, color: '#c0c0c0', fontWeight: 700, flexShrink: 0 }}>
                        {item.meta}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
