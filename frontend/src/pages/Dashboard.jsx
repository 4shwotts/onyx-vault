import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import MonthPicker from '../components/MonthPicker';
import { api } from '../api/client';
import { getAvailableMonths } from '../utils/months';

// All-purple palette, light to dark. When there are more categories than
// base shades, later ones cycle through further lightened/darkened
// variants of the same hue family via shadeColor.
const THEME_HUES = ['#c9a0dc', '#a569bd', '#8e44ad', '#6c3483', '#4a235a'];

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let G = ((num >> 8) & 0x00ff) + amt;
  let B = (num & 0x0000ff) + amt;
  R = R < 255 ? (R < 0 ? 0 : R) : 255;
  G = G < 255 ? (G < 0 ? 0 : G) : 255;
  B = B < 255 ? (B < 0 ? 0 : B) : 255;
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function getCategoryColor(index) {
  const hue = THEME_HUES[index % THEME_HUES.length];
  const cycle = Math.floor(index / THEME_HUES.length);
  if (cycle === 0) return hue;
  const amount = Math.ceil(cycle / 2) * 14;
  return shadeColor(hue, cycle % 2 === 1 ? amount : -amount);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

const GAP = 14;
// Every category reserves at least this much circumference (visible arc +
// gap), regardless of how small its actual value is — this is what keeps
// tiny categories from crowding into each other.
const MIN_SLOT = GAP + 6;
const CARD_HEIGHT = 260;
const SUBHEADING_SIZE = 13;
const ACCOUNTS_PER_PAGE = 3;
const ACCOUNT_ROTATE_MS = 4000;

export default function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountPage, setAccountPage] = useState(0);

  const availableMonths = getAvailableMonths(allTransactions);

  useEffect(() => {
    async function loadInitial() {
      try {
        const [accs, txs] = await Promise.all([api.getAccounts(), api.getTransactions()]);
        setAccounts(accs);
        setAllTransactions(txs);
        const months = getAvailableMonths(txs);
        if (months.length > 0) setSelectedMonth(months[0].value);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedMonth) {
      setMonthTransactions([]);
      return;
    }
    const monthRange = availableMonths.find((m) => m.value === selectedMonth);
    if (!monthRange) return;
    setMonthTransactions(allTransactions.filter((t) => t.date >= monthRange.from && t.date <= monthRange.to));
  }, [selectedMonth, allTransactions]);

  const accountPages = chunkArray(accounts, ACCOUNTS_PER_PAGE);

  // Auto-rotate through pages of accounts (fixes the layout compression
  // that happened when many accounts wrapped into extra grid rows on
  // this fixed-height page — now it's always a single row, just cycling).
  useEffect(() => {
    if (accountPages.length <= 1) return;
    const interval = setInterval(() => {
      setAccountPage((p) => (p + 1) % accountPages.length);
    }, ACCOUNT_ROTATE_MS);
    return () => clearInterval(interval);
  }, [accountPages.length]);

  useEffect(() => {
    if (accountPage >= accountPages.length) setAccountPage(0);
  }, [accountPages.length, accountPage]);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const monthLabel = availableMonths.find((m) => m.value === selectedMonth)?.label || '';
  const shortMonthLabel = monthLabel.split(' ').map((w, i) => (i === 0 ? w.slice(0, 3) : w)).join(' ');

  const categoryTotals = {};
  monthTransactions
    .filter((t) => Number(t.amount) < 0)
    .forEach((t) => {
      const name = t.category_name || 'Uncategorized';
      categoryTotals[name] = (categoryTotals[name] || 0) + Math.abs(Number(t.amount));
    });

  const categoryList = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalSpend = categoryList.reduce((sum, [, val]) => sum + val, 0);

  // --- Previous-month comparison data, computed directly from the
  // selected month via date math (not array adjacency), so it's correct
  // even if the previous month had zero transactions or doesn't appear
  // in the months dropdown at all.
  let previousCategoryTotals = {};
  let prevTotalSpend = 0;
  let selYear, selMonthNum, daysInSelMonth, isCurrentMonth, daysElapsed;

  if (selectedMonth) {
    [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
    let prevMonthNum = selMonthNum - 1;
    let prevYear = selYear;
    if (prevMonthNum === 0) { prevMonthNum = 12; prevYear -= 1; }
    const prevFrom = new Date(prevYear, prevMonthNum - 1, 1).toISOString().slice(0, 10);
    const prevLastDay = new Date(prevYear, prevMonthNum, 0).getDate();
    const prevTo = new Date(prevYear, prevMonthNum - 1, prevLastDay).toISOString().slice(0, 10);

    const prevMonthTransactions = allTransactions.filter((t) => t.date >= prevFrom && t.date <= prevTo);
    prevMonthTransactions
      .filter((t) => Number(t.amount) < 0)
      .forEach((t) => {
        const name = t.category_name || 'Uncategorized';
        previousCategoryTotals[name] = (previousCategoryTotals[name] || 0) + Math.abs(Number(t.amount));
      });
    prevTotalSpend = Object.values(previousCategoryTotals).reduce((a, b) => a + b, 0);

    daysInSelMonth = new Date(selYear, selMonthNum, 0).getDate();
    const now = new Date();
    isCurrentMonth = selYear === now.getFullYear() && selMonthNum === now.getMonth() + 1;
    daysElapsed = isCurrentMonth ? now.getDate() : daysInSelMonth;
  }

  const projectedTotal = daysElapsed > 0 ? (totalSpend / daysElapsed) * (daysInSelMonth || 1) : totalSpend;
  const pctVsLastMonth = prevTotalSpend > 0
    ? ((projectedTotal - prevTotalSpend) / prevTotalSpend) * 100
    : (projectedTotal > 0 ? 100 : 0);

  const circumference = 2 * Math.PI * 46;

  // Two passes: first reserve a minimum slot per category (visible arc +
  // gap) so tiny categories don't get crowded out. Then, since several
  // small categories plus a couple of large ones can add up to MORE than
  // the actual circle, scale every reserved slot down proportionally so
  // the total always fits exactly within one full circle.
  const rawDashes = categoryList.map(([, value]) => {
    const fraction = totalSpend > 0 ? value / totalSpend : 0;
    return fraction * circumference;
  });
  const effectiveDashes = categoryList.map(([, value], i) => (value > 0 ? Math.max(rawDashes[i], MIN_SLOT) : 0));
  const totalEffective = effectiveDashes.reduce((a, b) => a + b, 0);
  const scale = totalEffective > circumference ? circumference / totalEffective : 1;

  let cumulativeOffset = 0;
  const arcs = categoryList.map(([name, value], i) => {
    const scaledEffective = effectiveDashes[i] * scale;
    const visibleDash = value > 0 ? Math.max(scaledEffective - GAP, 0) : 0;
    const color = getCategoryColor(i);
    const prevValue = previousCategoryTotals[name] || 0;
    const pct = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : (value > 0 ? null : 0);
    const arc = {
      name, value, color, prevValue, pct,
      dashArray: `${visibleDash} ${circumference - visibleDash}`,
      dashOffset: -(cumulativeOffset + GAP / 2),
    };
    cumulativeOffset += scaledEffective;
    return arc;
  });

  const maxBarVal = Math.max(1, ...arcs.map((a) => a.value), ...arcs.map((a) => a.prevValue));

  const recent = allTransactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const currentAccountPage = accountPages[accountPage] || [];

  return (
    <div style={{ height: '100vh', padding: '24px 32px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <Nav />

      {error && <p style={{ color: 'var(--expense)', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {loading ? (
        <p style={{ color: '#888', fontSize: 14 }}>Loading...</p>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0 }}>

          <div>
            <p className="font-mono" style={{ fontSize: 15, color: '#333', margin: '0 0 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Balance:
            </p>
            <p className="font-mono" style={{ fontSize: 44, fontWeight: 700, color: '#000', margin: 0 }}>
              £{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>

            {accounts.length === 0 ? (
              <p style={{ color: '#888', fontSize: 14, marginTop: 18 }}>No accounts yet — add one on the Accounts page.</p>
            ) : (
              <>
                <div
                  key={accountPage}
                  className="account-page-fade"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(currentAccountPage.length, 3) || 1}, 1fr)`,
                    gap: 16, marginTop: 18,
                  }}
                >
                  {currentAccountPage.map((acc) => (
                    <div key={acc.id} style={darkCardStyle}>
                      <p className="font-mono" style={{ fontSize: 13, color: '#9a9a9a', margin: '0 0 8px', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>
                        {acc.name}
                      </p>
                      <p className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: 0 }}>
                        £{Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
                {accountPages.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                    {accountPages.map((_, i) => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: i === accountPage ? '#333' : 'rgba(0,0,0,0.2)',
                        transition: 'background 0.3s ease',
                      }} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p className="font-mono" style={{ fontSize: 18, color: '#000', margin: 0, fontWeight: 700 }}>Spend by Category</p>
              {availableMonths.length > 0 && (
                <MonthPicker months={availableMonths} value={selectedMonth} onChange={setSelectedMonth} />
              )}
            </div>

            <div className="chrome-surface" style={{
              borderRadius: 16, padding: '24px 28px', height: CARD_HEIGHT,
              display: 'flex', alignItems: 'stretch', gap: 0,
            }}>
              {categoryList.length === 0 ? (
                <p style={{ color: '#3a3a3a', fontSize: 15, position: 'relative', zIndex: 1 }}>
                  {availableMonths.length === 0 ? 'No transactions yet.' : `No spending recorded for ${monthLabel}.`}
                </p>
              ) : (
                <>
                  {/* SECTION 1: donut + legend with trend arrows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1, flexShrink: 0 }}>
                    <p className="font-mono" style={{ fontSize: SUBHEADING_SIZE, color: '#2a2a2a', margin: 0, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>
                      Categories
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
                      <svg viewBox="0 0 120 120" style={{ width: 175, height: 175, flexShrink: 0, overflow: 'visible' }}>
                        <circle cx="60" cy="60" r="46" fill="none" stroke="#00000012" strokeWidth="9" />
                        {arcs.map((arc) => (
                          <circle
                            key={arc.name} cx="60" cy="60" r="46" fill="none" stroke={arc.color} strokeWidth="9"
                            strokeLinecap="round" transform="rotate(-90 60 60)"
                            style={{
                              strokeDasharray: arc.dashArray,
                              strokeDashoffset: arc.dashOffset,
                              transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease',
                            }}
                          />
                        ))}
                        <text x="60" y="56" textAnchor="middle" className="font-mono" fontWeight="700" fontSize="19" fill="#101112">
                          £{totalSpend.toFixed(0)}
                        </text>
                        <text x="60" y="74" textAnchor="middle" className="font-mono" fontSize="9" fill="#3a3a3a" fontWeight="600">
                          {shortMonthLabel.toUpperCase()}
                        </text>
                      </svg>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                        {arcs.map((arc) => (
                          <div key={arc.name} style={{
                            display: 'grid', gridTemplateColumns: '16px 138px 55px 1fr',
                            alignItems: 'center', columnGap: 10,
                          }}>
                            <span style={{
                              width: 14, height: 14, borderRadius: 4, background: arc.color,
                            }} />
                            <span className="font-mono" style={{ fontSize: 15, color: '#101112', fontWeight: 700 }}>{arc.name}</span>
                            <span className="font-mono" style={{ fontSize: 15, color: '#101112', fontWeight: 700 }}>
                              £{arc.value.toFixed(0)}
                            </span>
                            <span>
                              {arc.pct !== null && (
                                <span className="font-mono" style={{
                                  fontSize: 13, fontWeight: 700,
                                  color: arc.pct >= 0 ? '#b83232' : '#1f8a52',
                                }}>
                                  {arc.pct >= 0 ? '↑' : '↓'}{Math.abs(arc.pct).toFixed(0)}%
                                </span>
                              )}
                              {arc.pct === null && arc.value > 0 && (
                                <span className="font-mono" style={{
                                  fontSize: 12, color: '#333', fontWeight: 700,
                                  border: '1px solid #999', borderRadius: 4, padding: '1px 6px',
                                  background: 'rgba(0,0,0,0.05)',
                                }}>
                                  NEW
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* divider */}
                  <div style={{ width: 1, background: 'rgba(0,0,0,0.15)', margin: '0 26px', position: 'relative', zIndex: 1 }} />

                  {/* SECTION 2: pace / projection */}
                  <div style={{ width: 190, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', position: 'relative', zIndex: 1 }}>
                    <p className="font-mono" style={{ fontSize: SUBHEADING_SIZE, color: '#2a2a2a', margin: 0, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>
                      {isCurrentMonth ? 'On Track For' : 'Total Spend'}
                    </p>
                    <p className="font-mono" style={{ fontSize: 36, color: '#101112', margin: '14px 0 10px', fontWeight: 700 }}>
                      £{(isCurrentMonth ? projectedTotal : totalSpend).toFixed(0)}
                    </p>
                    <p className="font-mono" style={{
                      fontSize: 16, margin: 0, fontWeight: 700,
                      color: pctVsLastMonth >= 0 ? '#b83232' : '#1f8a52',
                    }}>
                      {pctVsLastMonth >= 0 ? '↑' : '↓'} {Math.abs(pctVsLastMonth).toFixed(0)}% vs last month
                    </p>
                    {isCurrentMonth && (
                      <p className="font-mono" style={{ fontSize: 13, color: '#777', margin: '12px 0 0' }}>
                        Day {daysElapsed} of {daysInSelMonth}
                      </p>
                    )}
                  </div>

                  {/* divider */}
                  <div style={{ width: 1, background: 'rgba(0,0,0,0.15)', margin: '0 26px', position: 'relative', zIndex: 1 }} />

                  {/* SECTION 3: this month vs last month bars */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 12, position: 'relative', zIndex: 1, minWidth: 0 }}>
                    <p className="font-mono" style={{ fontSize: SUBHEADING_SIZE, color: '#2a2a2a', margin: '0 0 2px', letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>
                      This Month vs Last
                    </p>
                    {arcs.map((arc) => {
                      const curPct = Math.min(100, (arc.value / maxBarVal) * 100);
                      const prevPct = Math.min(100, (arc.prevValue / maxBarVal) * 100);
                      return (
                        <div key={arc.name}>
                          <p className="font-mono" style={{ fontSize: 12, color: '#444', margin: '0 0 3px', fontWeight: 700 }}>{arc.name}</p>
                          <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.08)', width: '100%' }}>
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4,
                              width: `${curPct}%`, background: arc.color,
                            }} />
                            <div style={{
                              position: 'absolute', top: -2, bottom: -2, width: 2,
                              left: `calc(${prevPct}% - 1px)`, background: 'rgba(0,0,0,0.55)', borderRadius: 1,
                            }} title={`Last month: £${arc.prevValue.toFixed(0)}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <p className="font-mono" style={{ fontSize: 18, color: '#000', margin: '0 0 10px', fontWeight: 700 }}>Recent Transactions</p>
            {recent.length === 0 ? (
              <p style={{ color: '#888', fontSize: 14 }}>No transactions yet.</p>
            ) : (
              <div style={darkListStyle}>
                {recent.map((t, i) => (
                  <div key={t.id} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '13px 18px',
                    borderBottom: i < recent.length - 1 ? '0.5px solid #262626' : 'none',
                  }}>
                    <p className="font-mono" style={{ fontSize: 15, color: '#eef1f3', margin: 0, fontWeight: 600 }}>
                      {t.description || '(no description)'}
                    </p>
                    <p className="font-mono" style={{ fontSize: 15, fontWeight: 700, margin: 0, color: Number(t.amount) < 0 ? '#e05a5a' : '#3fbf7f' }}>
                      {Number(t.amount) < 0 ? '−' : '+'}£{Math.abs(Number(t.amount)).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

const darkCardStyle = { background: '#141414', borderRadius: 12, padding: '16px 18px' };
const darkListStyle = { background: '#141414', borderRadius: 14, padding: 4 };