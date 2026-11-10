import { buildInsight } from '../lib/spending';

// The one-sentence description of the month's spending under the
// projection. It describes what happened; it never advises. aria-live so
// a screen reader hears it update when the month changes.
export default function InsightLine({ summary, compact = false }) {
  const insight = summary ? buildInsight(summary) : null;
  if (!insight) return null;
  return (
    <p
      className="font-mono"
      aria-live="polite"
      data-testid="insight-line"
      style={{ fontSize: compact ? 10 : 12, color: '#333', margin: compact ? '8px 0 0' : '14px 0 0', fontWeight: 600, lineHeight: 1.4 }}
    >
      {insight.text}
    </p>
  );
}
