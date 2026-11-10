// The pill shown over a blurred placeholder when there's nothing to show
// yet. role="status" so screen readers announce it.
export default function EmptyOverlay({ message, tone = 'light' }) {
  const isLight = tone === 'light';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
      <p role="status" className="font-mono" style={{
        fontSize: 13, margin: 0, padding: '9px 20px', borderRadius: 20,
        letterSpacing: 0.3, fontWeight: 600, textAlign: 'center',
        color: isLight ? '#2a2a2a' : '#d5d5d5',
        background: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(20,20,20,0.86)',
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

// The decorative placeholder behind an empty-state message: hidden from
// screen readers and not focusable, since its content is made up.
export function PlaceholderContent({ children, style }) {
  return (
    <div aria-hidden="true" inert style={{ filter: 'blur(3px)', opacity: 0.55, pointerEvents: 'none', ...style }}>
      {children}
    </div>
  );
}
