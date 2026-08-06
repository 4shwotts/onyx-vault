import { useEffect, useRef, useState } from 'react';
import { MONTH_NAMES } from '../utils/months';

// Custom month/year picker (not a native <select>) so the layout can
// show a full year grid and support the "All Time" option. `months` is
// the list of months that actually have data — used to grey out and
// disable any month with nothing in it, rather than letting the user
// pick an empty month.
export default function MonthPicker({ months, value, onChange, allowAll = false }) {
  const [open, setOpen] = useState(false);
  const years = Array.from(new Set(months.map((m) => m.year))).sort((a, b) => b - a);
  const selected = months.find((m) => m.value === value);
  const [viewYear, setViewYear] = useState(selected ? selected.year : (years[0] || new Date().getFullYear()));
  const ref = useRef(null);

  // Closes the panel on any click outside it.
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keeps the visible year in sync if the selected value changes from
  // outside this component (e.g. a filter reset elsewhere on the page).
  useEffect(() => {
    if (selected) setViewYear(selected.year);
  }, [value]);

  const monthsInView = months.filter((m) => m.year === viewYear);
  const availableMonthNumbers = new Set(monthsInView.map((m) => m.month));
  const yearIndex = years.indexOf(viewYear);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-mono"
        style={pickerButtonStyle}
      >
        {allowAll && !value ? 'All Time' : selected ? selected.label : 'Select month'}
        <svg width="9" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span
              onClick={() => yearIndex < years.length - 1 && setViewYear(years[yearIndex + 1])}
              style={{ cursor: yearIndex < years.length - 1 ? 'pointer' : 'default', opacity: yearIndex < years.length - 1 ? 1 : 0.25, color: '#fff', fontSize: 15, padding: '2px 10px' }}
            >
              ‹
            </span>
            <span className="font-mono" style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{viewYear}</span>
            <span
              onClick={() => yearIndex > 0 && setViewYear(years[yearIndex - 1])}
              style={{ cursor: yearIndex > 0 ? 'pointer' : 'default', opacity: yearIndex > 0 ? 1 : 0.25, color: '#fff', fontSize: 15, padding: '2px 10px' }}
            >
              ›
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: allowAll ? 8 : 0 }}>
            {MONTH_NAMES.map((name, i) => {
              const isAvailable = availableMonthNumbers.has(i);
              const entry = monthsInView.find((m) => m.month === i);
              const isSelected = entry && entry.value === value;
              return (
                <button
                  key={name}
                  disabled={!isAvailable}
                  onClick={() => { onChange(entry.value); setOpen(false); }}
                  className="font-mono"
                  style={{
                    padding: '9px 0', fontSize: 12, borderRadius: 7, border: 'none', cursor: isAvailable ? 'pointer' : 'default',
                    background: isSelected ? '#2a2f33' : 'transparent',
                    color: isAvailable ? '#e5e5e5' : '#3a3a3a',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {allowAll && (
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className="font-mono"
              style={{
                width: '100%', padding: '8px 0', fontSize: 12, borderRadius: 7, border: '0.5px solid #333',
                background: !value ? '#2a2f33' : 'transparent', color: '#e5e5e5', cursor: 'pointer', fontWeight: !value ? 700 : 500,
              }}
            >
              All Time
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const pickerButtonStyle = {
  display: 'flex', alignItems: 'center', gap: 8, background: '#141414', color: '#fff',
  border: 'none', borderRadius: 20, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const panelStyle = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#141414',
  borderRadius: 16, padding: 16, width: 230, zIndex: 30,
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};