import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import Nav from '../components/Nav';
import { api } from '../api/client';
import { BASE_CATEGORIES } from '../constants/categories';
import { prepareImport } from '../lib/importCsv';
import { toPence, formatSignedGBP } from '../utils/money';
import { formatShortDate } from '../utils/dates';
import useIsMobile from '../hooks/useIsMobile';

const MAX_ROWS = 500;

export default function Import() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [doneCount, setDoneCount] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    api.getAccounts()
      .then((data) => !cancelled && setAccounts(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, []);

  function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setDoneCount(null);
    setRows([]);
    setRowErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > MAX_ROWS) {
          setError(`That file has ${results.data.length} rows. Import up to ${MAX_ROWS} at a time.`);
          return;
        }
        const { transactions, errors } = prepareImport(results.data);
        setRows(transactions);
        setRowErrors(errors);
        if (transactions.length === 0 && errors.length === 0) {
          setError('No rows found. The file needs Date, Description and Amount columns.');
        }
      },
      error: () => setError('That file couldn’t be read as a CSV file.'),
    });
  }

  function updateRowCategory(id, category) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category } : r)));
  }

  async function handleConfirm() {
    if (!accountId) {
      setError('Choose an account to import into first.');
      return;
    }

    setImporting(true);
    setError('');
    setProgress(0);

    let imported = 0;
    try {
      const existingCategories = await api.getCategories();
      const categoryCache = {};
      existingCategories.forEach((c) => { categoryCache[c.name.toLowerCase()] = c.id; });

      for (const row of rows) {
        const name = row.category.trim() || 'Other';
        const key = name.toLowerCase();
        if (!categoryCache[key]) {
          const created = await api.createCategory(name);
          categoryCache[key] = created.id;
        }

        await api.createTransaction({
          account_id: Number(accountId),
          category_id: categoryCache[key],
          amount: row.amount,
          description: row.description || null,
          date: row.date,
        });
        imported += 1;
        setProgress(imported);
      }

      setRows([]);
      setDoneCount(imported);
    } catch (err) {
      // Rows already imported stay imported; say exactly where it stopped.
      setRows((prev) => prev.slice(imported));
      setError(`${imported} row${imported === 1 ? '' : 's'} imported, then it stopped: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: isMobile ? 16 : '16px 32px', position: 'relative', zIndex: 1 }}>
      <Nav />

      <main className="page-container" style={{ maxWidth: 800, margin: '0 auto', paddingTop: isMobile ? 12 : 60 }}>
        <h1 className="font-mono" style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: '0 0 6px', color: '#000', textAlign: 'center' }}>Import a CSV file</h1>
        <p className="font-mono" style={{ fontSize: 13, color: '#222', margin: '0 0 8px', textAlign: 'center', lineHeight: 1.6 }}>
          Upload a CSV file with Date, Description and Amount columns. Categories are suggested for you to check before anything is saved.
        </p>
        <p className="font-mono" style={{ fontSize: 12, color: '#222', margin: '0 0 22px', textAlign: 'center', lineHeight: 1.6 }}>
          This is a demo app, not connected to any bank — please use made-up data, not a real statement.{' '}
          <a href="/sample-statement.csv" download style={{ color: '#5b2a74' }}>Download a sample file</a>.
        </p>

        <label htmlFor="import-account" className="visually-hidden">Account to import into</label>
        <select id="import-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="font-mono" style={{ ...selectStyle, marginBottom: 18 }}>
          <option value="">Select account to import into</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <label className="import-drop-zone" style={isMobile ? { ...dropZoneStyle, padding: '32px 20px' } : dropZoneStyle}>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="visually-hidden" aria-describedby="import-hint" />
          <span className="font-mono" style={{ display: 'block', fontSize: 15, color: '#e5e5e5', margin: '0 0 6px', fontWeight: 600 }}>Choose a CSV file</span>
          <span id="import-hint" className="font-mono" style={{ display: 'block', fontSize: 11, color: '#bbb', margin: 0, letterSpacing: 0.5 }}>
            DATES AS DD/MM/YYYY OR YYYY-MM-DD · UP TO {MAX_ROWS} ROWS
          </span>
        </label>

        {error && <p role="alert" style={{ color: '#8f1d1d', fontSize: 14, margin: '16px 0', textAlign: 'center' }}>{error}</p>}
        {doneCount !== null && (
          <p role="status" className="font-mono" style={{ color: '#222', fontSize: 14, margin: '16px 0 0', textAlign: 'center' }}>
            Import complete: {doneCount} transaction{doneCount === 1 ? '' : 's'} added.
          </p>
        )}

        {rowErrors.length > 0 && (
          <div role="alert" style={{ ...noticeStyle, marginTop: 18 }}>
            <p className="font-mono" style={{ fontSize: 13, color: '#8f1d1d', margin: '0 0 6px', fontWeight: 700 }}>
              {rowErrors.length} row{rowErrors.length === 1 ? '' : 's'} can’t be imported and will be skipped:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rowErrors.slice(0, 10).map((e) => <li key={e.line} style={{ fontSize: 12, color: '#222', lineHeight: 1.5 }}>{e.message}</li>)}
            </ul>
            {rowErrors.length > 10 && <p style={{ fontSize: 12, color: '#222', margin: '6px 0 0' }}>…and {rowErrors.length - 10} more.</p>}
          </div>
        )}

        {rows.length === 0 && rowErrors.length === 0 && !error && doneCount === null && (
          <div style={emptyHintStyle}>
            <p className="font-mono" style={{ fontSize: 13, color: '#222', margin: 0, lineHeight: 1.6 }}>
              Once you choose a file, a preview of every transaction will appear here — with editable categories — before anything is saved.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <h2 className="font-mono" style={{ fontSize: 14, color: '#222', margin: '24px 0 10px', fontWeight: 600 }}>
              Preview — {rows.length} row{rows.length === 1 ? '' : 's'} ready to import
            </h2>

            <ul aria-label="Rows to import" style={darkListStyle}>
              {rows.map((row, i) => {
                const pence = toPence(row.amount);
                return (
                  <li key={row.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap',
                    padding: isMobile ? '12px 14px' : '14px 18px', gap: isMobile ? 10 : 14,
                    borderBottom: i < rows.length - 1 ? '0.5px solid #262626' : 'none',
                  }}>
                    <p className="font-mono" style={{ fontSize: 14, color: '#e5e5e5', margin: 0, flex: isMobile ? '1 1 100%' : 1, minWidth: 0, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatShortDate(row.date)} · {row.description || '(no description)'}
                    </p>

                    <label htmlFor={`row-category-${row.id}`} className="visually-hidden">Category for {row.description || 'this row'}</label>
                    <select id={`row-category-${row.id}`} value={row.category} onChange={(e) => updateRowCategory(row.id, e.target.value)}
                      className="font-mono" style={isMobile ? { ...categorySelectStyle, flex: 1, width: 'auto', minWidth: 0 } : categorySelectStyle}>
                      {BASE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    <p className="font-mono" style={{
                      fontSize: 15, fontWeight: 700, margin: 0, minWidth: 100, flexShrink: 0, textAlign: 'right',
                      color: pence < 0 ? '#ff8a8a' : '#6fdba5',
                    }}>
                      {formatSignedGBP(pence)}
                    </p>
                  </li>
                );
              })}
            </ul>

            <button type="button" onClick={handleConfirm} disabled={importing} className="chrome-surface font-mono" style={confirmButtonStyle}>
              <span style={{ position: 'relative', zIndex: 1 }}>
                {importing ? `Importing… ${progress} of ${rows.length}` : `Import ${rows.length} transaction${rows.length === 1 ? '' : 's'}`}
              </span>
            </button>
          </>
        )}
      </main>
    </div>
  );
}

const darkListStyle = { listStyle: 'none', background: '#141414', borderRadius: 12, padding: 4, margin: '0 0 18px' };
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
const dropZoneStyle = {
  display: 'block', border: '1px dashed #555', borderRadius: 12, padding: 48,
  textAlign: 'center', background: '#141414', cursor: 'pointer', position: 'relative',
};
const emptyHintStyle = {
  border: '1px dashed #666', borderRadius: 12, padding: 24, marginTop: 18, textAlign: 'center',
};
const noticeStyle = {
  border: '1px solid rgba(143,29,29,0.4)', background: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: 16,
};
const confirmButtonStyle = {
  width: '100%', border: 'none', borderRadius: 10, padding: 15, fontSize: 15,
  fontWeight: 700, color: '#101112', cursor: 'pointer', marginTop: 4,
};
