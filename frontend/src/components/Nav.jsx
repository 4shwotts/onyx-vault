import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import SpinningGem from './SpinningGem';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/import', label: 'Import' },
];

export default function Nav() {
  const navigate = useNavigate();

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