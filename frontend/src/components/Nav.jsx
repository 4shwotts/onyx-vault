import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import SpinningGem from './SpinningGem';
import useIsMobile from '../hooks/useIsMobile';

// shortLabel is used in the mobile tab bar, where four full Orbitron
// labels don't fit across a phone-width row.
const links = [
  { to: '/dashboard', label: 'Dashboard', shortLabel: 'Home' },
  { to: '/transactions', label: 'Transactions', shortLabel: 'Activity' },
  { to: '/accounts', label: 'Accounts', shortLabel: 'Accounts' },
  { to: '/import', label: 'Import', shortLabel: 'Import' },
];

export default function Nav() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      navigate('/login');
    }
  }

  function openCommandPalette() {
    window.dispatchEvent(new Event('open-command-palette'));
  }

  if (isMobile) {
    return <MobileNav onSearch={openCommandPalette} onLogout={handleLogout} />;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, width: '100%' }}>
      <div className="chrome-surface" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999,
        padding: '8px 22px', height: 52, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <SpinningGem size={36} />
        </div>
        <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.22)', margin: '0 16px', position: 'relative', zIndex: 1 }} />
        <p className="font-mono" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#101112', position: 'relative', zIndex: 1, whiteSpace: 'nowrap' }}>
          Onyx Vault
        </p>
      </div>

      <div className="dark-surface" style={{ display: 'flex', alignItems: 'center', borderRadius: 12, padding: 6, gap: 2 }}>
        <button
          type="button"
          onClick={openCommandPalette}
          className="font-mono"
          title="Search (Ctrl/Cmd + K)"
          style={{
            fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: '10px 16px', borderRadius: 8, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1,
            background: 'transparent', border: 'none',
          }}
        >
          Search
          <span style={{
            fontSize: 10, color: '#9a9a9a', background: '#1e1e1e', border: '0.5px solid #333',
            borderRadius: 4, padding: '2px 5px',
          }}>
            ⌘K
          </span>
        </button>

        <div style={{ width: 1, height: 20, background: '#333', margin: '0 6px', position: 'relative', zIndex: 1 }} />

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

        <button
          type="button"
          onClick={handleLogout}
          className="font-mono"
          style={{
            fontSize: 13, letterSpacing: 0.5, color: 'var(--text-secondary)', cursor: 'pointer',
            textTransform: 'uppercase', padding: '10px 18px', fontWeight: 600, position: 'relative', zIndex: 1,
            background: 'transparent', border: 'none',
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

// Two rows on phones: brand + icon actions on top, a full-width tab bar
// underneath, instead of the single desktop row that overflows.
function MobileNav({ onSearch, onLogout }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div className="chrome-surface" style={{
          display: 'flex', alignItems: 'center', borderRadius: 999, padding: '6px 16px', height: 44, minWidth: 0,
        }}>
          <div style={{ display: 'flex', position: 'relative', zIndex: 1, flexShrink: 0 }}>
            <SpinningGem size={28} />
          </div>
          <div style={{ width: 1, height: 22, background: 'rgba(0,0,0,0.22)', margin: '0 12px', position: 'relative', zIndex: 1 }} />
          <p className="font-mono" style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#101112', position: 'relative', zIndex: 1, whiteSpace: 'nowrap' }}>
            Onyx Vault
          </p>
        </div>

        <div className="dark-surface" style={{ display: 'flex', alignItems: 'center', borderRadius: 12, padding: 4, flexShrink: 0 }}>
          <button type="button" onClick={onSearch} aria-label="Search" style={mobileIconButtonStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 2px', position: 'relative', zIndex: 1 }} />
          <button type="button" onClick={onLogout} aria-label="Logout" style={mobileIconButtonStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
              <path d="M10 17l-5-5 5-5" />
              <path d="M5 12h11" />
            </svg>
          </button>
        </div>
      </div>

      <div className="dark-surface" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderRadius: 12, padding: 4, gap: 2 }}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `font-mono${isActive ? ' nav-tab-active' : ''}`}
            style={({ isActive }) => ({
              fontSize: 10,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              textDecoration: 'none',
              textAlign: 'center',
              padding: '11px 2px',
              borderRadius: 8,
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? '#2a2f33' : 'transparent',
              borderTop: isActive ? '0.5px solid #565c60' : '0.5px solid transparent',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              position: 'relative',
              zIndex: 1,
            })}
          >
            {link.shortLabel}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

const mobileIconButtonStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 36,
  background: 'transparent', border: 'none', borderRadius: 8, color: 'var(--text-secondary)',
  cursor: 'pointer', position: 'relative', zIndex: 1,
};
