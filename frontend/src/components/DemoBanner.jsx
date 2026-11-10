import { Link } from 'react-router-dom';

// Shown at the top of every page while using the demo, so nobody mistakes
// it for a real financial service. Ending the demo is done from the
// header's "End demo" button, so the banner has no button of its own.
export const DEMO_NOTICE = 'Demo mode: this account and its data are fake and reset after 24 hours. Not a real financial service.';

export default function DemoBanner() {
  return (
    <div role="region" aria-label="Demo mode" style={bannerStyle}>
      <p className="font-mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, minWidth: 0 }}>
        {DEMO_NOTICE}{' '}
        <Link to="/disclaimer" style={{ color: '#f1d9ff', textDecoration: 'underline' }}>Read the disclaimer</Link>
      </p>
    </div>
  );
}

const bannerStyle = {
  background: '#3d1a4f', color: '#ffffff', borderRadius: 10, padding: '10px 14px', marginBottom: 14,
  boxShadow: '0 4px 14px rgba(0,0,0,0.2)', position: 'relative', zIndex: 2,
};
