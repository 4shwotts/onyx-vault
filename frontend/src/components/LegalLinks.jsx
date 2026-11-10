import { Link } from 'react-router-dom';

// The short version of the disclaimer, shown on the sign-up page (and, in
// the demo banner's own words, on every page during a demo).
export function ShortDisclaimer({ style }) {
  return (
    <p className="font-mono" data-testid="short-disclaimer" style={{ fontSize: 11, lineHeight: 1.55, color: '#2e2e2e', margin: '14px 0 0', ...style }}>
      Onyx Vault is a portfolio project, not a real financial service. It isn’t connected to any bank, isn’t regulated by the FCA
      and isn’t financial advice. Please don’t enter real financial details.{' '}
      <Link to="/disclaimer" style={{ color: '#3d1a4f', fontWeight: 700 }}>Read the disclaimer</Link>
    </p>
  );
}

// Links to the privacy notice and disclaimer, under every signed-out card.
export default function LegalLinks({ tone = 'dark' }) {
  const color = tone === 'dark' ? '#101112' : '#f1d9ff';
  return (
    <nav aria-label="Legal" className="font-mono" style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12 }}>
      <Link to="/privacy" style={{ color, fontWeight: 700 }}>Privacy notice</Link>
      <Link to="/disclaimer" style={{ color, fontWeight: 700 }}>Disclaimer</Link>
    </nav>
  );
}
