import { useEffect, useState } from 'react';

// When to use the phone layout (two-row navigation, page scrolls
// normally). Pages use inline styles, which CSS media queries can't
// override, so layout switches on this instead.
//
// - Narrower than 1100px: the desktop navigation bar needs 1067px
//   (measured in Chromium; 1064px in WebKit) including page padding, so
//   below 1100px it would run off the screen (bug 18). The ~30px margin
//   covers font-rendering differences between browsers.
// - Short landscape screens (a phone held sideways): the one-screen
//   desktop dashboard can't fit in ~400px of height.
export const MOBILE_QUERY = '(max-width: 1099px), (max-height: 500px) and (orientation: landscape)';

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const handleChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
