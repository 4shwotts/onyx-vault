import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Stroked chevron, bolder stroke than before for visibility against
// both the white pill badges and plain text.
function TrendArrow({ up, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ display: 'block', flexShrink: 0 }}>
      <path
        d={up ? 'M2.5 7.5 L6 4 L9.5 7.5' : 'M2.5 4.5 L6 8 L9.5 4.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const GAP = 14;
// Every category reserves at least this much circumference (visible arc +
// gap), regardless of how small its actual value is — this is what keeps
// tiny categories from crowding into each other.
const MIN_SLOT = GAP + 6;
const CARD_PADDING_Y = 20;
const SUBHEADING_SIZE = 15;
const ACCOUNTS_PER_PAGE = 3;
const ACCOUNT_ROTATE_MS = 4000;

// Fixed card height — doesn't grow or shrink with category count or
// viewport. Bumped slightly (300 -> 320) to make room for larger
// subheading and bar-row text without reintroducing the Shopping /
// Subscriptions clipping that happened at the smaller size. The legend
// and bar rows still scale their own spacing down at higher category
// counts (getLegendSizing / getBarSizing).
const CARD_HEIGHT = 320;

function getLegendSizing(count) {
  if (count <= 6) return { fontSize: 16, swatch: 15 };
  if (count <= 8) return { fontSize: 14, swatch: 13 };
  if (count <= 10) return { fontSize: 13, swatch: 12 };
  return { fontSize: 11.5, swatch: 11 };
}

// Bar rows carry their own label font size (rather than reusing
// legendSizing) since the "This Month vs Last" column has noticeably
// less vertical room than the legend column for the same category
// count. Sizes bumped up a step from before for readability, budgeted
// against the taller CARD_HEIGHT so 8-9 categories still fit without
// clipping.
function getBarSizing(count) {
  if (count <= 6) return { gap: 11, barHeight: 9, labelMB: 6, labelFontSize: 14 };
  if (count <= 8) return { gap: 6, barHeight: 7, labelMB: 4, labelFontSize: 12 };
  if (count <= 10) return { gap: 4, barHeight: 5, labelMB: 3, labelFontSize: 11 };
  return { gap: 3, barHeight: 4, labelMB: 2, labelFontSize: 10 };
}

// The donut's centre total was a fixed font size regardless of how
// many digits the number has — fine for "£633" but a 6-digit total
// just ran straight out past the ring. Scales down as digits grow so
// it always stays inside the circle.
function getDonutValueFontSize(value) {
  const digits = Math.max(1, Math.round(Math.abs(value))).toString().length;
  if (digits <= 3) return 19;
  if (digits === 4) return 17;
  if (digits === 5) return 14;
  if (digits === 6) return 12;
  return 10;
}

const FAKE_ACCOUNTS = [
  { id: 'ghost-1', name: 'Current', balance: 1240 },
  { id: 'ghost-2', name: 'Savings', balance: 3820 },
  { id: 'ghost-3', name: 'Credit', balance: -180 },
];
const FAKE_CATEGORY_LIST = [['Groceries', 420], ['Transport', 180], ['Dining', 150], ['Utilities', 95], ['Shopping', 60]];
const FAKE_RECENT = [
  { id: 'ghost-1', description: 'Tesco', amount: -42.10 },
  { id: 'ghost-2', description: 'Salary', amount: 2100 },
  { id: 'ghost-3', description: 'Netflix', amount: -11.99 },
  { id: 'ghost-4', description: 'Costa Coffee', amount: -4.50 },
  { id: 'ghost-5', description: 'Amazon', amount: -28.99 },
];

function buildArcs(list, totalSpend, previousTotals, circumference) {
  const rawDashes = list.map(([, value]) => {
    const fraction = totalSpend > 0 ? value / totalSpend : 0;
    return fraction * circumference;
  });
  const effectiveDashes = list.map(([, value], i) => (value > 0 ? Math.max(rawDashes[i], MIN_SLOT) : 0));
  const totalEffective = effectiveDashes.reduce((a, b) => a + b, 0);
  const scale = totalEffective > circumference ? circumference / totalEffective : 1;

  let cumulativeOffset = 0;
  return list.map(([name, value], i) => {
    const scaledEffective = effectiveDashes[i] * scale;
    const visibleDash = value > 0 ? Math.max(scaledEffective - GAP, 0) : 0;
    const color = getCategoryColor(i);
    const prevValue = previousTotals[name] || 0;
    const pct = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : (value > 0 ? null : 0);
    const arc = {
      name, value, color, prevValue, pct,
      dashArray: `${visibleDash} ${circumference - visibleDash}`,
      dashOffset: -(cumulativeOffset + GAP / 2),
    };
    cumulativeOffset += scaledEffective;
    return arc;
  });
}

function EmptyOverlay({ message, tone = 'light' }) {
  const isLight = tone === 'light';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
      <p className="font-mono" style={{
        fontSize: 13, margin: 0, padding: '9px 20px', borderRadius: 20,
        letterSpacing: 0.3, fontWeight: 600,
        color: isLight ? '#2a2a2a' : '#d5d5d5',
        background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(20,20,20,0.78)',
        border: isLight ? '0.5px solid rgba(0,0,0,0.08)' : '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: isLight ? '0 6px 18px rgba(0,0,0,0.10)' : '0 6px 18px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        {message}
      </p>
    </div>
  );
}

function AnimatedNumber({ value, formatter, duration = 700 }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return undefined;
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{formatter(display)}</>;
}

function DashboardSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
      <div>
        <div className="skeleton-block" style={{ width: 140, height: 15, marginBottom: 4 }} />
        <div className="skeleton-block" style={{ width: 220, height: 44, marginBottom: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-block-dark" style={{ height: 84, borderRadius: 12 }} />
          ))}
        </div>
      </div>
      <div>
        <div className="skeleton-block" style={{ width: 180, height: 18, marginBottom: 8 }} />
        <div className="skeleton-block" style={{ height: CARD_HEIGHT, borderRadius: 16 }} />
      </div>
      <div>
        <div className="skeleton-block" style={{ width: 170, height: 18, marginBottom: 8 }} />
        <div className="skeleton-block-dark" style={{ height: 250, borderRadius: 14 }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountPage, setAccountPage] = useState(0);
  const [chartsMounted, setChartsMounted] = useState(false);

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

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => setChartsMounted(true), 60);
    return () => clearTimeout(timer);
  }, [loading]);

  const hasAccounts = accounts.length > 0;
  const accountPages = chunkArray(accounts, ACCOUNTS_PER_PAGE);

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
      const name = t.category_name || 'Other';
      categoryTotals[name] = (categoryTotals[name] || 0) + Math.abs(Number(t.amount));
    });

  const categoryList = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const totalSpend = categoryList.reduce((sum, [, val]) => sum + val, 0);
  const hasSpendData = categoryList.length > 0;
  const legendSizing = getLegendSizing(categoryList.length || FAKE_CATEGORY_LIST.length);
  const barSizing = getBarSizing(categoryList.length || FAKE_CATEGORY_LIST.length);

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
        const name = t.category_name || 'Other';
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
  const arcs = buildArcs(categoryList, totalSpend, previousCategoryTotals, circumference);

  const fakeTotalSpend = FAKE_CATEGORY_LIST.reduce((sum, [, v]) => sum + v, 0);
  const fakeArcs = buildArcs(FAKE_CATEGORY_LIST, fakeTotalSpend, {}, circumference);

  const displayArcs = hasSpendData ? arcs : fakeArcs;
  const displayTotalSpend = hasSpendData ? totalSpend : fakeTotalSpend;
  const displayProjected = hasSpendData ? projectedTotal : displayTotalSpend * 1.5;
  const displayPctVsLastMonth = hasSpendData ? pctVsLastMonth : -8;
  const displayIsCurrentMonth = hasSpendData ? isCurrentMonth : true;
  const displayDaysElapsed = hasSpendData ? daysElapsed : 14;
  const displayDaysInMonth = hasSpendData ? daysInSelMonth : 30;
  const displayMaxBarVal = hasSpendData ? Math.max(1, ...arcs.map((a) => a.value), ...arcs.map((a) => a.prevValue)) : Math.max(1, ...fakeArcs.map((a) => a.value));
  const displayShortMonthLabel = hasSpendData ? shortMonthLabel : 'THIS MONTH';

  function buildInsight(insightArcs) {
    const withIncrease = insightArcs.filter((a) => a.pct !== null && a.pct > 5).sort((a, b) => b.pct - a.pct);
    const withDecrease = insightArcs.filter((a) => a.pct !== null && a.pct < -5).sort((a, b) => a.pct - b.pct);

    if (withIncrease.length > 0) {
      const top = withIncrease[0];
      return { text: `You're spending ${Math.round(top.pct)}% more on ${top.name} than last month.`, tone: 'warn' };
    }
    if (withDecrease.length > 0) {
      const top = withDecrease[0];
      return { text: `Nice — ${top.name} spending is down ${Math.round(Math.abs(top.pct))}% from last month.`, tone: 'good' };
    }
    if (insightArcs.length > 0) {
      const top = insightArcs.slice().sort((a, b) => b.value - a.value)[0];
      const dayNote = isCurrentMonth ? ` (day ${daysElapsed} of ${daysInSelMonth})` : '';
      return { text: `${top.name} is your biggest category so far this month${dayNote}.`, tone: 'neutral' };
    }
    return null;
  }

  const insight = hasSpendData ? buildInsight(arcs) : null;

  const recent = allTransactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const hasRecent = recent.length > 0;
  const currentAccountPage = accountPages[accountPage] || [];

  const revealArcs = chartsMounted ? displayArcs : displayArcs.map((a) => ({ ...a, dashArray: `0 ${circumference}` }));
  const revealMaxBar = chartsMounted ? displayMaxBarVal : displayMaxBarVal;

  function goToCategory(name) {
    if (!hasSpendData) return;
    const params = new URLSearchParams({ category: name });
    if (selectedMonth) params.set('month', selectedMonth);
    navigate(`/transactions?${params.toString()}`);
  }

  const insightColor = insight?.tone === 'warn' ? '#b83232' : insight?.tone === 'good' ? '#1f8a52' : '#555';

  return (
    <div style={{ height: '100vh', padding: '16px 32px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <Nav />

      {error && <p style={{ color: 'var(--expense)', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overflow: 'hidden' }}>

          {/* Total Balance section. flexShrink:0 — only Recent
              Transactions below is designed to absorb space pressure. */}
          <div style={{ flexShrink: 0 }}>
            <p className="font-mono" style={{ fontSize: 15, color: '#333', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Balance:
            </p>
            <p className="font-mono" style={{ fontSize: 44, fontWeight: 700, color: '#000', margin: 0, letterSpacing: -0.5 }}>
              £<AnimatedNumber value={totalBalance} formatter={(v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
            </p>

            <div style={{ position: 'relative', minHeight: 84, marginTop: 8 }}>
              <div
                key={hasAccounts ? accountPage : 'empty'}
                className={hasAccounts ? 'account-page-fade' : ''}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min((hasAccounts ? currentAccountPage.length : FAKE_ACCOUNTS.length) || 1, 3)}, 1fr)`,
                  gap: 16,
                  filter: hasAccounts ? 'none' : 'blur(3px)',
                  opacity: hasAccounts ? 1 : 0.55,
                  pointerEvents: hasAccounts ? 'auto' : 'none',
                }}
              >
                {(hasAccounts ? currentAccountPage : FAKE_ACCOUNTS).map((acc) => (
                  <div key={acc.id} className="dark-surface" style={darkCardStyle}>
                    <p className="font-mono" style={{ fontSize: 12, color: '#8a8a8a', margin: '0 0 6px', letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, position: 'relative', zIndex: 1 }}>
                      {acc.name}
                    </p>
                    <p className="font-mono" style={{ fontSize: 25, fontWeight: 700, color: '#f3f3f3', margin: 0, letterSpacing: -0.4, position: 'relative', zIndex: 1 }}>
                      £<AnimatedNumber value={Number(acc.balance)} formatter={(v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                    </p>
                  </div>
                ))}
              </div>
              {!hasAccounts && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, transform: 'translateY(-6px)' }}>
                  <p className="font-mono" style={{
                    fontSize: 13, margin: 0, padding: '9px 20px', borderRadius: 20,
                    letterSpacing: 0.3, fontWeight: 600, color: '#d5d5d5',
                    background: 'rgba(20,20,20,0.78)', border: '0.5px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  }}>
                    No accounts yet — add one on the Accounts page.
                  </p>
                </div>
              )}
            </div>
            {hasAccounts && accountPages.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                {accountPages.map((_, i) => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: i === accountPage ? '#333' : 'rgba(0,0,0,0.2)',
                    transition: 'background 0.3s ease',
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Spend by Category — fixed-size card (CARD_HEIGHT), the
              same size regardless of category count or viewport. The
              legend and bar rows inside scale their own spacing down
              at higher counts instead of the card itself resizing.
              flexShrink:0 — only Recent Transactions below is designed
              to absorb space pressure, so this can't get squeezed
              smaller than its fixed inner height and visually overlap
              the section below it. */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p className="font-mono" style={{ fontSize: 18, color: '#000', margin: 0, fontWeight: 700 }}>Spend by Category</p>
              {availableMonths.length > 0 && (
                <MonthPicker months={availableMonths} value={selectedMonth} onChange={setSelectedMonth} />
              )}
            </div>

            <div className="chrome-surface" style={{
              borderRadius: 16, padding: `${CARD_PADDING_Y}px 28px`, height: CARD_HEIGHT,
              position: 'relative', display: 'flex', alignItems: 'stretch', gap: 0, overflow: 'hidden',
              boxShadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.35) inset, 0 2px 6px rgba(0,0,0,0.18)',
            }}>
              <div style={{
                display: 'flex', width: '100%', height: '100%', gap: 0,
                filter: hasSpendData ? 'none' : 'blur(3px)',
                opacity: hasSpendData ? 1 : 0.55,
                pointerEvents: hasSpendData ? 'auto' : 'none',
              }}>
                {/* SECTION 1: donut + legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1, flexShrink: 0, height: '100%' }}>
                  <p className="font-mono" style={{ fontSize: SUBHEADING_SIZE, color: '#2a2a2a', margin: 0, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                    Categories
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 26, flex: 1, minHeight: 0 }}>
                    <svg viewBox="0 0 120 120" style={{ width: 175, height: 175, flexShrink: 0, overflow: 'visible' }}>
                      <defs>
                        <filter id="donutArcShadow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#000000" floodOpacity="0.28" />
                        </filter>
                        <filter id="donutTrackShadow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.22" />
                        </filter>
                      </defs>
                      <circle cx="60" cy="60" r="46" fill="none" stroke="#00000020" strokeWidth="9" filter="url(#donutTrackShadow)" />
                      {revealArcs.map((arc) => (
                        <circle
                          key={arc.name} cx="60" cy="60" r="46" fill="none" stroke={arc.color} strokeWidth="9"
                          strokeLinecap="round" transform="rotate(-90 60 60)" filter="url(#donutArcShadow)"
                          style={{
                            strokeDasharray: arc.dashArray,
                            strokeDashoffset: arc.dashOffset,
                            transition: 'stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1), stroke-dashoffset 0.5s ease',
                          }}
                        />
                      ))}
                      <text x="60" y="56" textAnchor="middle" className="font-mono" fontWeight="700" fontSize={getDonutValueFontSize(displayTotalSpend)} fill="#101112">
                        £{displayTotalSpend.toFixed(0)}
                      </text>
                      <text x="60" y="74" textAnchor="middle" className="font-mono" fontSize="9" fill="#3a3a3a" fontWeight="600">
                        {displayShortMonthLabel.toUpperCase()}
                      </text>
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', height: '100%' }}>
                      {displayArcs.map((arc) => {
                        const arrowSize = Math.max(10, legendSizing.fontSize - 3);
                        // minWidth (not a fixed width) — a fixed width
                        // broke completely on unusually large values
                        // (a 6-digit £ amount or a 4+ digit percentage
                        // just overflowed straight out of the pill).
                        // minWidth keeps the normal-case look uniform
                        // while letting outliers grow instead of
                        // breaking.
                        const badgeFontSize = legendSizing.fontSize - 1;
                        const badgeMinWidth = Math.round(badgeFontSize * 4.2);
                        return (
                          <div key={arc.name} style={{
                            display: 'grid', gridTemplateColumns: `${legendSizing.swatch}px 138px minmax(48px, auto) minmax(0, 1fr)`,
                            alignItems: 'center', columnGap: 10,
                          }}>
                            <span style={{
                              width: legendSizing.swatch, height: legendSizing.swatch, borderRadius: 4, background: arc.color,
                              border: '0.5px solid rgba(0,0,0,0.18)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
                            }} />
                            <span
                              onClick={() => goToCategory(arc.name)}
                              className="font-mono"
                              style={{
                                fontSize: legendSizing.fontSize, color: '#101112', fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textDecorationColor: 'rgba(0,0,0,0.15)',
                                textUnderlineOffset: 3,
                              }}
                            >
                              {arc.name}
                            </span>
                            <span className="font-mono" style={{ fontSize: legendSizing.fontSize, color: '#101112', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              £{arc.value.toFixed(0)}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                              {arc.pct !== null && (
                                <span className="font-mono" style={{
                                  fontSize: badgeFontSize, fontWeight: 700, lineHeight: 1,
                                  color: arc.pct >= 0 ? '#b83232' : '#1f8a52',
                                  background: '#ffffff',
                                  border: '0.5px solid rgba(0,0,0,0.08)',
                                  padding: '4px 8px', borderRadius: 5, minWidth: badgeMinWidth, justifyContent: 'center',
                                  display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap',
                                }}>
                                  <TrendArrow up={arc.pct >= 0} size={arrowSize} />
                                  {Math.abs(arc.pct).toFixed(0)}%
                                </span>
                              )}
                              {arc.pct === null && arc.value > 0 && (
                                <span className="font-mono" style={{
                                  fontSize: badgeFontSize, fontWeight: 700, lineHeight: 1,
                                  color: '#6c3483',
                                  background: '#ffffff',
                                  border: '0.5px solid #b98be0', borderRadius: 5, padding: '4px 8px', minWidth: badgeMinWidth, justifyContent: 'center',
                                  display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
                                }}>
                                  NEW
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* divider */}
                <div style={{ width: 1, background: 'rgba(0,0,0,0.15)', margin: '0 26px', position: 'relative', zIndex: 1 }} />

                {/* SECTION 2: pace / projection */}
                <div style={{ width: 190, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', position: 'relative', zIndex: 1, height: '100%' }}>
                  <p className="font-mono" style={{ fontSize: SUBHEADING_SIZE, color: '#2a2a2a', margin: 0, letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>
                    {displayIsCurrentMonth ? 'On Track For' : 'Total Spend'}
                  </p>
                  <p className="font-mono" style={{ fontSize: 36, color: '#101112', margin: '14px 0 10px', fontWeight: 700, letterSpacing: -0.5 }}>
                    £<AnimatedNumber value={displayIsCurrentMonth ? displayProjected : displayTotalSpend} formatter={(v) => v.toFixed(0)} />
                  </p>
                  <p className="font-mono" style={{
                    fontSize: 16, margin: 0, fontWeight: 700,
                    color: displayPctVsLastMonth >= 0 ? '#b83232' : '#1f8a52',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <TrendArrow up={displayPctVsLastMonth >= 0} size={13} />
                      {Math.abs(displayPctVsLastMonth).toFixed(0)}%
                    </span>
                    {' '}vs last month
                  </p>
                  {displayIsCurrentMonth && (
                    <p className="font-mono" style={{ fontSize: 13, color: '#777', margin: '12px 0 0' }}>
                      Day {displayDaysElapsed} of {displayDaysInMonth}
                    </p>
                  )}
                  {insight && (
                    <p className="font-mono" style={{ fontSize: 12, color: insightColor, margin: '14px 0 0', fontWeight: 600, lineHeight: 1.4 }}>
                      {insight.text}
                    </p>
                  )}
                </div>

                {/* divider */}
                <div style={{ width: 1, background: 'rgba(0,0,0,0.15)', margin: '0 26px', position: 'relative', zIndex: 1 }} />

                {/* SECTION 3: this month vs last month bars */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden', height: '100%' }}>
                  <p className="font-mono" style={{ fontSize: SUBHEADING_SIZE, color: '#2a2a2a', margin: '0 0 10px', letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                    This Month vs Last
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: barSizing.gap, flex: 1, minHeight: 0, minWidth: 0 }}>
                    {displayArcs.map((arc) => {
                      const curPct = chartsMounted ? Math.min(100, (arc.value / revealMaxBar) * 100) : 0;
                      const prevPct = Math.min(100, (arc.prevValue / revealMaxBar) * 100);
                      return (
                        <div key={arc.name} style={{ minWidth: 0 }}>
                          <p className="font-mono" style={{
                            fontSize: barSizing.labelFontSize, color: '#444', margin: `0 0 ${barSizing.labelMB}px`, fontWeight: 700,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{arc.name}</p>
                          <div style={{ position: 'relative', height: barSizing.barHeight, borderRadius: 4, background: 'rgba(0,0,0,0.08)', width: '100%' }}>
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4,
                              width: `${curPct}%`, background: arc.color,
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.15)',
                              transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
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
                </div>
              </div>

              {!hasSpendData && (
                <EmptyOverlay message={availableMonths.length === 0 ? 'No transactions yet.' : `No spending recorded for ${monthLabel}.`} tone="light" />
              )}
            </div>
          </div>

          {/* Recent Transactions — flex:1, not a guessed fixed height. */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <p className="font-mono" style={{ fontSize: 18, color: '#000', margin: '0 0 8px', fontWeight: 700, flexShrink: 0 }}>Recent Transactions</p>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <div className="dark-surface" style={{
                ...darkListStyle,
                height: '100%',
                filter: hasRecent ? 'none' : 'blur(3px)',
                opacity: hasRecent ? 1 : 0.55,
                pointerEvents: hasRecent ? 'auto' : 'none',
              }}>
                {(hasRecent ? recent : FAKE_RECENT).map((t, i, arr) => {
                  const isExpense = Number(t.amount) < 0;
                  const dotColor = isExpense ? '#e05a5a' : '#3fbf7f';
                  return (
                    <div key={t.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px',
                      borderBottom: i < arr.length - 1 ? '0.5px solid #262626' : 'none',
                      position: 'relative', zIndex: 1,
                    }}>
                      <p className="font-mono" style={{ fontSize: 15, color: '#eef1f3', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', background: dotColor,
                          boxShadow: `0 0 6px ${dotColor}99`, flexShrink: 0,
                        }} />
                        {t.description || '(no description)'}
                      </p>
                      <p className="font-mono" style={{ fontSize: 15, fontWeight: 700, margin: 0, color: dotColor, flexShrink: 0, marginLeft: 12 }}>
                        {isExpense ? '−' : '+'}£{Math.abs(Number(t.amount)).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
              {!hasRecent && <EmptyOverlay message="No transactions yet." tone="dark" />}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

const darkCardStyle = {
  borderRadius: 12, padding: '16px 18px',
  boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 -1px 0 rgba(0,0,0,0.6) inset, 0 2px 6px rgba(0,0,0,0.25)',
};
const darkListStyle = {
  borderRadius: 14, padding: 4, overflow: 'hidden',
  boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 -1px 0 rgba(0,0,0,0.6) inset, 0 2px 6px rgba(0,0,0,0.25)',
};