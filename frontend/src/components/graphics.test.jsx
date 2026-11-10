// @vitest-environment jsdom
// The WebGL extras fall back to still versions without WebGL, or when the
// visitor prefers reduced motion.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpinningGem from './SpinningGem';
import PageBackground from './PageBackground';
import { REDUCED_MOTION_QUERY, resetGraphicsCacheForTests, hasWebGL } from '../lib/graphics';

const realGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  resetGraphicsCacheForTests();
  window.__mediaMatches = {};
  HTMLCanvasElement.prototype.getContext = realGetContext;
});

function fakeWebGL() {
  HTMLCanvasElement.prototype.getContext = (type) => (type === 'webgl2' || type === 'webgl' ? { getExtension: () => null } : null);
}

describe('graphics fallbacks', () => {
  it('detects missing WebGL', () => {
    expect(hasWebGL()).toBe(false);
  });

  it('without WebGL: a still gem and a still CSS background', () => {
    render(<><PageBackground /><SpinningGem size={40} /></>);
    expect(screen.getByTestId('gem-static')).toHaveAttribute('src', '/favicon.svg');
    expect(screen.getByTestId('page-background')).toHaveAttribute('data-mode', 'static');
    expect(screen.queryByTestId('gem-animated')).toBeNull();
  });

  it('with WebGL but reduced motion preferred: still versions, no animation', () => {
    fakeWebGL();
    window.__mediaMatches = { [REDUCED_MOTION_QUERY]: true };
    render(<><PageBackground /><SpinningGem size={40} /></>);
    expect(screen.getByTestId('gem-static')).toBeInTheDocument();
    expect(screen.getByTestId('page-background')).toHaveAttribute('data-mode', 'static');
  });

  it('with WebGL and no reduced-motion preference: the animated versions are used', () => {
    fakeWebGL();
    render(<><PageBackground /><SpinningGem size={40} /></>);
    expect(screen.getByTestId('page-background')).toHaveAttribute('data-mode', 'animated');
    // The gem's WebGL code loads lazily; until it arrives the still gem stands in.
    expect(screen.getByTestId('gem-static')).toBeInTheDocument();
  });

  it('the still gem is decorative (empty alt text)', () => {
    render(<SpinningGem size={40} />);
    expect(screen.getByTestId('gem-static')).toHaveAttribute('alt', '');
  });
});
