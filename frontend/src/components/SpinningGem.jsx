import { Component, lazy, Suspense } from 'react';
import { useRichGraphics } from '../lib/graphics';

// Three.js and react-three-fiber are only downloaded when the animated gem
// is actually shown, so they don't weigh down the first page load.
const GemCanvas = lazy(() => import('./GemCanvas'));

// The still version: the same gem as the favicon, drawn as an SVG.
function StaticGem({ size }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      width={size}
      height={size}
      data-testid="gem-static"
      style={{ display: 'block', width: size, height: size }}
    />
  );
}

// If WebGL fails part-way (e.g. the GPU context is lost), fall back to the
// still gem rather than leaving a hole in the header.
class GemErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function SpinningGem({ size = 36, variant = 'light' }) {
  const rich = useRichGraphics();
  const still = <StaticGem size={size} />;
  if (!rich) return still;

  return (
    <GemErrorBoundary fallback={still}>
      <Suspense fallback={still}>
        <div data-testid="gem-animated" style={{ width: size, height: size }}>
          <GemCanvas size={size} variant={variant} />
        </div>
      </Suspense>
    </GemErrorBoundary>
  );
}
