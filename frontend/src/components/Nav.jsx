import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/import', label: 'Import' },
];

// Gem-cut diamond mark: outer rhombus outline + one horizontal facet
// line. Drawn twice — a faint light duplicate offset slightly below-right
// underneath, then the dark line on top — that offset pair is what reads
// as etched/engraved into the chrome rather than printed on top of it.
function OnyxMark({ size = 32, lineColor = '#101112', offsetColor = 'rgba(255,255,255,0.6)' }) {
  const gemPath = 'M12 3 L22 9 L12 21 L2 9 Z';
  const facetLine = 'M2 9 L22 9';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <g transform="translate(0.6,0.8)">
        <path d={gemPath} stroke={offsetColor} strokeWidth="2" strokeLinejoin="round" />
        <path d={facetLine} stroke={offsetColor} strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <path d={gemPath} stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
      <path d={facetLine} stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Nav() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      navigate('/login');
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, width: '100%' }}>
      <div className="chrome-surface" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999,
        padding: '8px 22px', height: 52, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <OnyxMark size={36} />
        </div>
        <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.22)', margin: '0 16px', position: 'relative', zIndex: 1 }} />
        <p className="font-mono" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#101112', position: 'relative', zIndex: 1, whiteSpace: 'nowrap' }}>
          Onyx Vault
        </p>
      </div>

      <div className="dark-surface" style={{ display: 'flex', alignItems: 'center', borderRadius: 12, padding: 6, gap: 2 }}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `font-mono${isActive ? ' nav-tab-active' : ''}`}
            style={({ isActive }) => ({
              fontSize: 13,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              textDecoration: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? '#2a2f33' : 'transparent',
              borderTop: isActive ? '0.5px solid #565c60' : '0.5px solid transparent',
              fontWeight: 600,
              position: 'relative',
              zIndex: 1,
            })}
          >
            {link.label}
          </NavLink>
        ))}

        <div style={{ width: 1, height: 20, background: '#333', margin: '0 6px', position: 'relative', zIndex: 1 }} />

        <span
          onClick={handleLogout}
          className="font-mono"
          style={{ fontSize: 13, letterSpacing: 0.5, color: 'var(--text-secondary)', cursor: 'pointer', textTransform: 'uppercase', padding: '10px 18px', fontWeight: 600, position: 'relative', zIndex: 1 }}
        >
          Logout
        </span>
      </div>
    </div>
  );
}