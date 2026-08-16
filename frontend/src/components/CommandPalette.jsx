import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

// A single global overlay, mounted once at the app root, opened via
// Cmd+K / Ctrl+K or the visible hint chip in the nav (which dispatches
// a plain window event — avoids needing shared state/context just to
// let the nav trigger something owned by this component).
export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeydown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    function handleExternalOpen() {
      setIsOpen(true);
    }
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('open-command-palette', handleExternalOpen);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('open-command-palette', handleExternalOpen);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setHighlighted(0);
      return;
    }
    // Focus the input once the overlay has actually mounted.
    const timer = setTimeout(() => inputRef.current?.focus(), 20);

    if (!dataLoaded) {
      Promise.all([api.getAccounts(), api.getCategories(), api.getTransactions()])
        .then(([accs, cats, txs]) => {
          setAccounts(accs);
          setCategories(cats);
          setTransactions(txs);
          setDataLoaded(true);
        })
        .catch(() => {
          // Silent — the palette still works for static navigation even
          // if the data fetch fails, no need to surface an error here.
        });
    }
    return () => clearTimeout(timer);
  }, [isOpen, dataLoaded]);

  function close() {
    setIsOpen(false);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      close();
      navigate('/login');
    }
  }

  const staticCommands = [
    { id: 'nav-dashboard', label: 'Go to Dashboard', group: 'Navigate', action: () => navigate('/dashboard') },
    { id: 'nav-transactions', label: 'Go to Transactions', group: 'Navigate', action: () => navigate('/transactions') },
    { id: 'nav-accounts', label: 'Go to Accounts', group: 'Navigate', action: () => navigate('/accounts') },
    { id: 'nav-import', label: 'Go to Import', group: 'Navigate', action: () => navigate('/import') },
    { id: 'action-add-transaction', label: 'Add a transaction', group: 'Quick actions', action: () => navigate('/transactions?new=1') },
    { id: 'action-add-account', label: 'Add an account', group: 'Quick actions', action: () => navigate('/accounts?new=1') },
    { id: 'action-import', label: 'Import a bank statement', group: 'Quick actions', action: () => navigate('/import') },
    { id: 'action-logout', label: 'Log out', group: 'Quick actions', action: handleLogout },
  ];

  const accountCommands = accounts.map((acc) => ({
    id: `account-${acc.id}`,
    label: `Filter transactions: ${acc.name}`,
    group: 'Accounts',
    action: () => navigate(`/transactions?account=${acc.id}`),
  }));

  const categoryCommands = categories.map((cat) => ({
    id: `category-${cat.id}`,
    label: `Filter by category: ${cat.name}`,
    group: 'Categories',
    action: () => navigate(`/transactions?category=${encodeURIComponent(cat.name)}`),
  }));

  const lowerQuery = query.trim().toLowerCase();

  // With an empty query, only the small fixed set of static commands
  // shows (Navigate + Quick actions) — accounts and categories are
  // left out of the default view entirely, since dumping every
  // account and category by default doesn't scale (a handful of
  // accounts is fine, but a growing category list would eventually
  // bury the useful stuff) and isn't any more specific or useful than
  // just browsing the Accounts/Transactions filter dropdowns directly.
  // They only surface once there's an actual query to match against.
  const matchedCommands = lowerQuery === ''
    ? staticCommands
    : [...staticCommands, ...accountCommands, ...categoryCommands].filter((c) =>
        c.label.toLowerCase().includes(lowerQuery)
      );

  // Transaction descriptions only search once the person has typed
  // something meaningful — showing every transaction by default would
  // drown out the more useful navigation/action commands.
  const matchedTransactions = lowerQuery.length >= 2
    ? transactions
        .filter((t) => (t.description || '').toLowerCase().includes(lowerQuery))
        .slice(0, 5)
        .map((t) => ({
          id: `tx-${t.id}`,
          label: t.description || '(no description)',
          meta: `${Number(t.amount) < 0 ? '−' : '+'}£${Math.abs(Number(t.amount)).toFixed(2)}`,
          group: 'Transactions',
          action: () => navigate(`/transactions?account=${t.account_id}`),
        }))
    : [];

  const results = [...matchedCommands, ...matchedTransactions];

  useEffect(() => {
    setHighlighted(0);
  }, [query, isOpen]);

  function handleKeyNav(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[highlighted];
      if (item) {
        item.action();
        close();
      }
    }
  }

  if (!isOpen) return null;

  // Group results for section headers, preserving the order they
  // appear in `results` so keyboard index and visual position match.
  const groups = [];
  results.forEach((item) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.name === item.group) {
      lastGroup.items.push(item);
    } else {
      groups.push({ name: item.group, items: [item] });
    }
  });

  let runningIndex = 0;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8,8,10,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="dark-surface"
        style={{ width: 560, maxWidth: '90vw', maxHeight: '65vh', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyNav}
          placeholder="Search pages, accounts, categories, transactions…"
          className="font-mono"
          style={{
            border: 'none', outline: 'none', background: 'transparent', color: '#eef1f3',
            fontSize: 15, padding: '18px 20px', borderBottom: '0.5px solid #262626',
            position: 'relative', zIndex: 1,
          }}
        />
        <div style={{ overflowY: 'auto', padding: '6px 0', position: 'relative', zIndex: 1 }}>
          {results.length === 0 && (
            <p className="font-mono" style={{ fontSize: 13, color: '#666', padding: '16px 20px', margin: 0 }}>
              No matches.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.name}>
              <p className="font-mono" style={{ fontSize: 11, color: '#666', letterSpacing: 0.8, textTransform: 'uppercase', margin: '10px 20px 4px', fontWeight: 700 }}>
                {group.name}
              </p>
              {group.items.map((item) => {
                const idx = runningIndex++;
                const isHighlighted = idx === highlighted;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHighlighted(idx)}
                    onClick={() => { item.action(); close(); }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 20px', cursor: 'pointer',
                      background: isHighlighted ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <span className="font-mono" style={{ fontSize: 14, color: '#eef1f3', fontWeight: 600 }}>
                      {item.label}
                    </span>
                    {item.meta && (
                      <span className="font-mono" style={{ fontSize: 13, color: '#9a9a9a', fontWeight: 700 }}>
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