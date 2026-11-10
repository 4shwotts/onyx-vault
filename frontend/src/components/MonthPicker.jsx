import { useEffect, useId, useRef, useState } from 'react';
import { MONTH_NAMES } from '../utils/months';
import { MONTH_NAMES_LONG } from '../utils/dates';

// Custom month/year picker (not a native <select>) so the layout can
// show a full year grid and support the "All Time" option. `months` is
// the list of months that actually have data — used to disable any month
// with nothing in it, rather than letting the user pick an empty month.
//
// The panel is a small non-modal dialog: it opens from a button that
// reports aria-expanded, closes on Escape or on a click or tap outside,
// and every control in it is a real button with a spoken name.
export default function MonthPicker({ months, value, onChange, allowAll = false, fullWidth = false }) {
  const [open, setOpen] = useState(false);
  const years = Array.from(new Set(months.map((m) => m.year))).sort((a, b) => b - a);
  const selected = months.find((m) => m.value === value);
  const [viewYear, setViewYear] = useState(selected ? selected.year : (years[0] || new Date().getFullYear()));
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();

  // Closes on a click or tap outside, or on Escape (returning focus to
  // the button that opened it).
  useEffect(() => {
    if (!open) return undefined;
    function handlePointer(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function toggle() {
    // Each time it opens, show the year of the current selection.
    if (!open && selected) setViewYear(selected.year);
    setOpen((o) => !o);
  }

  function choose(newValue) {
    onChange(newValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const monthsInView = months.filter((m) => m.year === viewYear);
  const availableMonthNumbers = new Set(monthsInView.map((m) => m.month));
  const yearIndex = years.indexOf(viewYear);
  const canGoEarlier = yearIndex < years.length - 1;
  const canGoLater = yearIndex > 0;
  const triggerLabel = allowAll && !value ? 'All Time' : selected ? selected.label : 'Select month';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Month: ${triggerLabel}`}
        className="font-mono"
        style={fullWidth ? { ...pickerButtonStyle, width: '100%', justifyContent: 'space-between' } : pickerButtonStyle}
      >
        {triggerLabel}
        <svg aria-hidden="true" width="9" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div id={panelId} role="dialog" aria-label="Choose a month" style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => canGoEarlier && setViewYear(years[yearIndex + 1])}
              disabled={!canGoEarlier}
              aria-label="Previous year"
              style={{ ...yearButtonStyle, opacity: canGoEarlier ? 1 : 0.3, cursor: canGoEarlier ? 'pointer' : 'default' }}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <span className="font-mono" aria-live="polite" style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{viewYear}</span>
            <button
              type="button"
              onClick={() => canGoLater && setViewYear(years[yearIndex - 1])}
              disabled={!canGoLater}
              aria-label="Next year"
              style={{ ...yearButtonStyle, opacity: canGoLater ? 1 : 0.3, cursor: canGoLater ? 'pointer' : 'default' }}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: allowAll ? 8 : 0 }}>
            {MONTH_NAMES.map((name, i) => {
              const isAvailable = availableMonthNumbers.has(i);
              const entry = monthsInView.find((m) => m.month === i);
              const isSelected = Boolean(entry && entry.value === value);
              return (
                <button
                  key={name}
                  type="button"
                  disabled={!isAvailable}
                  aria-pressed={isSelected}
                  title={`${MONTH_NAMES_LONG[i]} ${viewYear}${isAvailable ? '' : ' (no transactions)'}`}
                  onClick={() => choose(entry.value)}
                  className="font-mono"
                  style={{
                    padding: '10px 0', fontSize: 12, borderRadius: 7, border: 'none', cursor: isAvailable ? 'pointer' : 'default',
                    background: isSelected ? '#2a2f33' : 'transparent',
                    color: isAvailable ? '#e5e5e5' : '#5a5a5a',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {name}
                  {/* The year makes the spoken name unambiguous ("Jan 2026");
                      the visible text stays first, as speech-control users
                      say what they see. Disabled months are announced as
                      unavailable. */}
                  <span className="visually-hidden"> {viewYear}</span>
                </button>
              );
            })}
          </div>

          {allowAll && (
            <button
              type="button"
              onClick={() => choose('')}
              aria-pressed={!value}
              className="font-mono"
              style={{
                width: '100%', padding: '9px 0', fontSize: 12, borderRadius: 7, border: '0.5px solid #333',
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
  whiteSpace: 'nowrap',
};

const yearButtonStyle = {
  background: 'transparent', border: 'none', color: '#fff', fontSize: 18, padding: '2px 12px', borderRadius: 6, lineHeight: 1,
};

const panelStyle = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#141414',
  borderRadius: 16, padding: 16, width: 230, maxWidth: 'calc(100vw - 32px)', zIndex: 30,
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};
