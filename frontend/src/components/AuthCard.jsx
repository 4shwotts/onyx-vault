import SpinningGem from './SpinningGem';
import LegalLinks from './LegalLinks';

// The brushed-metal card used by every signed-out page (sign in, sign up,
// verify email, forgotten and reset password), so they all look alike.
// Fluid width: 300px on larger screens, the full width minus the page
// gutters on a 320px phone.
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 16, gap: 14,
      position: 'relative', zIndex: 1, boxSizing: 'border-box',
    }}>
      <div className="chrome-surface" style={{
        borderRadius: 12, padding: '32px 24px',
        width: '100%', maxWidth: 320, minHeight: 440,
        position: 'relative', zIndex: 1, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <SpinningGem size={64} />
          </div>
          <p className="font-mono" style={{ fontSize: 19, margin: 0, fontWeight: 700, color: '#101112' }}>Onyx Vault</p>
          <h1 className="font-mono" style={{ fontSize: 11, color: '#2e2e2e', margin: '6px 0 0', letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="font-mono" style={{ fontSize: 12, color: '#2e2e2e', margin: '8px 0 0', lineHeight: 1.5 }}>{subtitle}</p>
          )}
        </div>
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
      {footer}
      <LegalLinks />
    </main>
  );
}
