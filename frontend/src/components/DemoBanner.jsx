import { Link } from 'react-router-dom';

// Shown at the top of every page while using the demo, so nobody mistakes
// it for a real financial service.
export const DEMO_NOTICE = 'Demo mode: this account and its data are fake and reset after 24 hours. Not a real financial service.';

export default function DemoBanner({ onEndDemo, ending = false }) {
  return (
    <div role="region" aria-label="Demo mode" style={bannerStyle}>
      <p className="font-mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, minWidth: 0 }}>
        {DEMO_NOTICE}{' '}
        <Link to="/disclaimer" style={{ color: '#f1d9ff', textDecoration: 'underline' }}>Read the disclaimer</Link>
      </p>
      <button type="button" onClick={onEndDemo} disabled={ending} className="font-mono" style={buttonStyle}>
        {ending ? 'Ending…' : 'End demo'}
      </button>
    </div>
  );
}

const bannerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
  background: '#3d1a4f', color: '#ffffff', borderRadius: 10, padding: '10px 14px', marginBottom: 14,
  boxShadow: '0 4px 14px rgba(0,0,0,0.2)', position: 'relative', zIndex: 2,
};
const buttonStyle = {
  background: '#ffffff', color: '#3d1a4f', border: 'none', borderRadius: 8, padding: '8px 14px',
  fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
};
