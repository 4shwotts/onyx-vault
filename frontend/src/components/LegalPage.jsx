import { Link } from 'react-router-dom';
import SpinningGem from './SpinningGem';

// Layout for the privacy notice and the disclaimer: readable without
// signing in, plain dark text on a light panel for easy reading, in the
// app's style.
export default function LegalPage({ title, updated, children }) {
  return (
    <div style={{ minHeight: '100vh', padding: 16, position: 'relative', zIndex: 1, boxSizing: 'border-box' }}>
      <header style={{ maxWidth: 760, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link to="/login" className="chrome-surface font-mono" style={brandStyle}>
          <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}><SpinningGem size={28} /></span>
          <span style={{ position: 'relative', zIndex: 1 }}>Onyx Vault</span>
        </Link>
        <nav aria-label="Legal" className="font-mono" style={{ display: 'flex', gap: 14, fontSize: 13, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link to="/privacy" style={navLinkStyle}>Privacy</Link>
          <Link to="/disclaimer" style={navLinkStyle}>Disclaimer</Link>
        </nav>
      </header>
      <main style={{ maxWidth: 760, margin: '0 auto' }}>
        <article style={articleStyle}>
          <h1 className="font-mono" style={{ fontSize: 24, margin: '0 0 6px', color: '#101112' }}>{title}</h1>
          <p style={{ fontSize: 13, color: '#444', margin: '0 0 24px' }}>Last updated: {updated}</p>
          <div className="legal-body">{children}</div>
        </article>
        <p className="font-mono" style={{ fontSize: 13, textAlign: 'center', margin: '18px 0 8px' }}>
          <Link to="/login" style={navLinkStyle}>Sign in</Link>
          {' · '}
          <Link to="/demo" style={navLinkStyle}>Try the demo</Link>
        </p>
      </main>
    </div>
  );
}

const brandStyle = {
  display: 'flex', alignItems: 'center', gap: 10, borderRadius: 999, padding: '6px 16px', height: 44,
  boxSizing: 'border-box', textDecoration: 'none', color: '#101112', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
};
const navLinkStyle = { color: '#3d1a4f', fontWeight: 700 };
const articleStyle = {
  background: '#fbfbfc', color: '#1a1a1a', borderRadius: 14, padding: 'clamp(18px, 4vw, 36px)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.08)', lineHeight: 1.65, fontSize: 15,
  overflowWrap: 'break-word',
};
