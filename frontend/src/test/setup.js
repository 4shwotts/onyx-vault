// Adds DOM matchers (toBeInTheDocument, toHaveAccessibleName, …), fills
// in browser APIs jsdom doesn't have, and cleans up after each test.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());

  // matchMedia: desktop width, no reduced-motion preference, unless a
  // test overrides window.__mediaMatches.
  window.__mediaMatches = {};
  window.matchMedia = vi.fn((query) => ({
    matches: Boolean(window.__mediaMatches[query]),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));

  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // jsdom has no WebGL: report "not available" quietly, as a browser
  // without WebGL would.
  HTMLCanvasElement.prototype.getContext = () => null;
}
