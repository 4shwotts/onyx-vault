import { useState } from 'react';

// Category icons load from /public/icons/*.svg by convention. "Other"
// (the real category every uncategorised transaction now gets assigned
// to server-side, never left null) and "Individual" (a real selectable
// category for payments to a person rather than a business) both use
// the same Individual.svg — a person represents "unspecified/personal"
// better than a generic folder icon. Anything else unmapped falls back
// to Individual.svg too, and if even that fails to load, back to the
// original letter-in-a-circle treatment.
const CATEGORY_ICON_MAP = {
  groceries: 'Groceries',
  transport: 'Transport',
  'eating out': 'EatingOut',
  dining: 'EatingOut',
  subscriptions: 'Subscriptions',
  entertainment: 'Entertainment',
  utilities: 'Bills',
  bills: 'Bills',
  shopping: 'Shopping',
  income: 'Income',
  individual: 'Individual',
  other: 'Individual',
};

function resolveCategoryFile(name) {
  const trimmed = (name || '').trim();
  const key = trimmed ? trimmed.toLowerCase() : 'other';
  return CATEGORY_ICON_MAP[key] || 'Individual';
}

export function CategoryIcon({ name, size = 46 }) {
  const [failed, setFailed] = useState(false);
  const filename = resolveCategoryFile(name);
  const src = `/icons/${filename}.svg`;

  if (failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: size * 0.24, background: '#141414',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ color: '#9a9a9a', fontSize: size * 0.4 }}>{(name || '?')[0]?.toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.24, background: '#141414',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
    }}>
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: size * 0.66, height: size * 0.66, objectFit: 'contain' }}
      />
    </div>
  );
}

// No account-type icon files exist yet (current/savings/credit), so
// this quietly renders nothing rather than a placeholder — same
// graceful-fallback approach, just with "nothing" as the fallback
// instead of a letter circle, since the account cards don't currently
// have an icon slot at all without this.
export function AccountTypeIcon({ type, size = 20 }) {
  const [failed, setFailed] = useState(false);
  const filename = (type || '').charAt(0).toUpperCase() + (type || '').slice(1).toLowerCase();
  const src = `/icons/${filename}.svg`;

  if (failed || !filename) {
    return null;
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}