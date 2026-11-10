import useWakeServer from '../hooks/useWakeServer';

// Shown under the sign-in card while the sleeping server wakes up. Says
// nothing for the first 2 seconds, then explains the wait; after 75
// seconds without an answer, offers to try again.
export default function WakeNotice() {
  const { status, retry } = useWakeServer();

  if (status === 'slow') {
    return (
      <p role="status" className="font-mono" style={noticeStyle}>
        Waking the server — this can take up to a minute
      </p>
    );
  }

  if (status === 'failed') {
    return (
      <div role="alert" className="font-mono" style={{ ...noticeStyle, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <span>The server didn’t wake up in time. It may be busy — please try again.</span>
        <button type="button" onClick={retry} className="font-mono" style={retryStyle}>Retry</button>
      </div>
    );
  }

  return null;
}

const noticeStyle = {
  margin: 0, padding: '10px 16px', borderRadius: 10, maxWidth: 320, boxSizing: 'border-box', width: '100%',
  background: 'rgba(20,20,20,0.86)', color: '#eaeaea', fontSize: 12, lineHeight: 1.5, textAlign: 'center',
};
const retryStyle = {
  background: '#5b2a74', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
