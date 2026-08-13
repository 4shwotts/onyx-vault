import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import Nav from '../components/Nav';
import { api } from '../api/client';

const CATEGORY_RULES = [
  { keywords: ['tesco', 'waitrose', 'sainsbury', 'asda', 'aldi', 'lidl', 'grocery'], category: 'Groceries' },
  { keywords: ['netflix', 'spotify', 'disney', 'prime', 'subscription'], category: 'Subscriptions' },
  { keywords: ['uber', 'tfl', 'train', 'bus', 'fuel', 'petrol', 'shell', 'bp '], category: 'Transport' },
  { keywords: ['salary', 'wage', 'payroll'], category: 'Income' },
  { keywords: ['restaurant', 'cafe', 'coffee', 'mcdonald', 'kfc', 'deliveroo', 'just eat'], category: 'Eating Out' },
];

const BASE_CATEGORIES = ['Uncategorized', 'Groceries', 'Subscriptions', 'Transport', 'Income', 'Eating Out'];
const CUSTOM_OPTION = '__custom__';

function guessCategory(description) {
  const lower = (description || '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'Uncategorized';
}

export default function Import() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.getAccounts().then(setAccounts).catch((err) => setError(err.message));
  }, []);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setDone(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = results.data.map((row, i) => {
            const description = row.Description || row.description || row.Details || row.Payee || '';
            const rawAmount = row.Amount || row.amount || row.Value || '0';
            const amount = parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
            const date = row.Date || row.date || new Date().toISOString().slice(0, 10);

            return {
              id: i,
              description,
              amount: isNaN(amount) ? 0 : amount,
              date,
              category: guessCategory(description),
              // Whether this row is showing a free-text input instead of
              // the dropdown, so custom category names aren't limited to
              // the fixed list.
              isCustom: false,
            };
          });
          setRows(parsed);
        } catch (err) {
          setError('Could not read that CSV — check the column headers match Description, Amount, Date.');
        }
      },
      error: () => setError('Could not parse that file as CSV.'),
    });
  }

  function handleCategorySelect(id, value) {
    if (value === CUSTOM_OPTION) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category: '', isCustom: true } : r)));
    } else {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category: value, isCustom: false } : r)));
    }
  }

  function handleCategoryText(id, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category: value } : r)));
  }

  function revertToDropdown(id) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category: 'Uncategorized', isCustom: false } : r)));
  }

  async function handleConfirm() {
    if (!accountId) {
      setError('Select an account to import into first.');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const existingCategories = await api.getCategories();
      const categoryCache = {};
      existingCategories.forEach((c) => { categoryCache[c.name.toLowerCase()] = c.id; });

      for (const row of rows) {
        let categoryId = null;
        const trimmedCategory = row.category.trim();
        const key = trimmedCategory.toLowerCase();

        if (trimmedCategory && key !== 'uncategorized') {
          if (categoryCache[key]) {
            categoryId = categoryCache[key];
          } else {
            const created = await api.createCategory(trimmedCategory);
            categoryCache[key] = created.id;
            categoryId = created.id;
          }
        }

        await api.createTransaction({
          account_id: accountId,
          category_id: categoryId,
          amount: row.amount,
          description: row.description,
          date: row.date,
        });
      }

      setRows([]);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 32px', position: 'relative', zIndex: 1 }}>
      <Nav />

      <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', paddingTop: 90 }}>
      <p className="font-mono" style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#000', textAlign: 'center' }}>Import Statement</p>
      <p className="font-mono" style={{ fontSize: 14, color: '#666', margin: '0 0 22px', textAlign: 'center' }}>
        Upload a CSV export from your bank — we'll auto-detect categories so you can review before confirming.
      </p>

        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="font-mono" style={{ ...selectStyle, marginBottom: 18 }}>
          <option value="">Select account to import into</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <label style={dropZoneStyle}>
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          <p className="font-mono" style={{ fontSize: 15, color: '#e5e5e5', margin: '0 0 6px', fontWeight: 600 }}>Drag CSV here or click to browse</p>
          <p className="font-mono" style={{ fontSize: 11, color: '#8a8a8a', margin: 0, letterSpacing: 0.5 }}>
            SUPPORTS .CSV EXPORTS FROM MOST BANKS
          </p>
        </label>

        {error && <p style={{ color: 'var(--expense)', fontSize: 14, margin: '16px 0', textAlign: 'center' }}>{error}</p>}
        {done && (
          <p className="font-mono" style={{ color: '#666', fontSize: 14, margin: '16px 0 0', textAlign: 'center' }}>
            Import complete.
          </p>
        )}

        {rows.length === 0 && !error && !done && (
          <div style={emptyHintStyle}>
            <p className="font-mono" style={{ fontSize: 14, color: '#999', margin: 0 }}>
              Once you upload a file, a preview of every transaction will appear here — with editable categories — before anything is saved.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <p className="font-mono" style={{ fontSize: 14, color: '#333', margin: '24px 0 10px', fontWeight: 600 }}>
              Preview — {rows.length} rows detected
            </p>

            <div style={darkListStyle}>
              {rows.map((row, i) => (
                <div key={row.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 18px', gap: 14,
                  borderBottom: i < rows.length - 1 ? '0.5px solid #262626' : 'none',
                }}>
                  <p className="font-mono" style={{ fontSize: 14, color: '#e5e5e5', margin: 0, flex: 1, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.description}
                  </p>

                  {row.isCustom ? (
                    <div style={{ width: 160, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <input
                        type="text"
                        placeholder="Type category"
                        value={row.category}
                        onChange={(e) => handleCategoryText(row.id, e.target.value)}
                        className="font-mono"
                        style={customCategoryInputStyle}
                      />
                      <span
                        onClick={() => revertToDropdown(row.id)}
                        className="font-mono"
                        style={{ fontSize: 10, color: '#7a7a7a', cursor: 'pointer' }}
                      >
                        Use list instead
                      </span>
                    </div>
                  ) : (
                    <select value={row.category} onChange={(e) => handleCategorySelect(row.id, e.target.value)}
                      className="font-mono" style={categorySelectStyle}>
                      {BASE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value={CUSTOM_OPTION}>Other (type your own)</option>
                    </select>
                  )}

                  <p className="font-mono" style={{
                    fontSize: 15, fontWeight: 700, margin: 0, width: 100,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
                    lineHeight: 1,
                    color: row.amount < 0 ? 'var(--expense)' : 'var(--income)',
                  }}>
                    {row.amount < 0 ? '−' : '+'}£{Math.abs(row.amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <button onClick={handleConfirm} disabled={importing} className="chrome-surface font-mono" style={confirmButtonStyle}>
              {importing ? 'Importing...' : 'Confirm Import'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const darkListStyle = { background: '#141414', borderRadius: 12, padding: 4, marginBottom: 18 };
const selectStyle = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '0.5px solid #333',
  borderRadius: 8, padding: '12px 40px 12px 14px', fontSize: 15, color: '#e5e5e5',
  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e5e5e5' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  backgroundSize: '13px',
};
const categorySelectStyle = {
  background: '#1a1a1a', border: '0.5px solid #333', borderRadius: 6, color: '#e5e5e5',
  width: 160, padding: '8px 26px 8px 10px', fontSize: 13,
  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e5e5e5' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  backgroundSize: '11px',
};
const customCategoryInputStyle = {
  background: '#1a1a1a', border: '0.5px solid #333', borderRadius: 6, color: '#e5e5e5',
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13,
};
const dropZoneStyle = {
  display: 'block', border: '0.5px dashed #3a3a3a', borderRadius: 12, padding: 48,
  textAlign: 'center', background: '#141414', cursor: 'pointer',
};
const emptyHintStyle = {
  border: '1px dashed #999', borderRadius: 12, padding: 24, marginTop: 18, textAlign: 'center',
};
const confirmButtonStyle = {
  width: '100%', border: 'none', borderRadius: 10, padding: 15, fontSize: 15,
  fontWeight: 700, color: '#101112', cursor: 'pointer', marginTop: 4,
};