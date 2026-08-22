import { useState } from 'react';

// Maps a category's display name (lowercased) to the actual icon SVG
// filename on disk. Several display names intentionally share one
// icon — "Eating Out" and "Dining" both use EatingOut.svg, "Utilities"
// and "Bills" both use Bills.svg — since there's no need for visually
// distinct icons for what are effectively synonyms.
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

// Falls back to the "other" mapping (-> Individual.svg) for an empty
// name or any category not present in CATEGORY_ICON_MAP — covers
// custom categories a user creates that don't have a dedicated icon.
function resolveCategoryFile(name) {
  const trimmed = (name || '').trim();
  const key = trimmed ? trimmed.toLowerCase() : 'other';
  return CATEGORY_ICON_MAP[key] || 'Individual';
}

// Renders a category's icon as a rounded tile. If the mapped SVG fails
// to load (onError), falls back to a plain tile showing the category
// name's first letter, rather than a broken image icon.
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

// Renders a small icon for an account type (current / savings /
// credit), derived directly from the type string rather than a lookup
// map, since account type names already match their icon filenames
// once capitalised. Unlike CategoryIcon, there's no letter-avatar
// fallback here — this icon sits inline next to other UI (not as a
// standalone tile), so failing silently (rendering nothing) is the
// better fallback than an oddly-placed avatar.
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